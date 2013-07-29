// FIXME: remove listeners (_connection & client)
// FIXME: request(), no error?
// FIXME: if getTargetForApp() is called and the actors are not fetched yet, BOOM!

const {Cu} = require("chrome");
const {ObservableObject} = require("devtools/shared/observable-object");
const {DeviceFront} = require("devtools/server/actors/device");
const promise = require("sdk/core/promise");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});

const dbgClient = Cu.import("resource://gre/modules/devtools/dbg-client.jsm");
dbgClient.UnsolicitedNotifications.appOpen = "appOpen";
dbgClient.UnsolicitedNotifications.appClose = "appClose"

const _knownDeviceClients = new WeakMap();

function DeviceClient(connection) {

  // If we already know about this connection,
  // let's reuse the existing device client.

  if (_knownDeviceClients.has(connection)) {
    return _knownDeviceClients.get(connection);
  }

  _knownDeviceClients.set(connection, this);

  // "store" is an ObservableObject.
  // Its life time is the same as DeviceClient.

  this._store = new ObservableObject({})
  this._resetStore();

  // Listen to connection events
  this._connection = connection;
  this._connection.once("destroyed", () => this._destroy());
  this._connection.on("status-changed", () => this._feedStoreFromConnection());
  this._connection.on("port-changed",   () => this._feedStoreFromConnection());
  this._connection.on("host-changed",   () => this._feedStoreFromConnection());
  this._feedStoreFromConnection();

  // Feed the store with data from the client
  if (this._connection.status == this._connection.CONNECTED) {
    this._feedStoreFromClient();
  }
  this._connection.on("connected", () => this._feedStoreFromClient());

  return this;
}

exports.DeviceClient = DeviceClient;

DeviceClient.prototype = {
  get client() {
    return this._connection.client;
  },

  get store() {
    return this._store;
  },

  screenshot: function() {
    if (this._deviceFront) {
      return this._deviceFront.screenshot();
    }
    throw new Error("not connected");
  },

  getTargetForApp: function(manifest) {
    let deferred = promise.defer();
    let request = {
      to: this._webAppsActor,
      type: "getAppActor",
      manifestURL: manifest,
    }
    this.client.request(request, (res) => {
      if (res.error) {
        return deferred.reject(res.error);
      }
      let options = {
        form: res.actor,
        client: this.client,
        chrome: false
      };

      devtools.TargetFactory.forRemoteTab(options).then((target) => {
        deferred.resolve(target)
      }, (error) => {
        deferred.reject(error);
      });
    }, (error) => {
      deferred.reject(error);
    });
    return deferred.promise;
  },

  _destroy: function() {
    _knownDeviceClients.delete(this._connection);
    if (this._deviceFront) {
      this._deviceFront = null;
    }
  },

  _feedStoreFromClient: function() {
    this.client.listTabs((resp) => {
      this._deviceFront = new DeviceFront(this.client, resp);
      this._webAppsActor = resp.webappsActor;
      this._feedStoreFromActors();
    })
  },

  _feedStoreFromConnection: function() {
    this.store.object.connection = {
      status: this._connection.status,
      host:   this._connection.host,
      port:   this._connection.port,
    }
    if (this._connection.status != this._connection.CONNECTED) {
      this._resetStore();
    }
  },

  _feedStoreFromActors: function() {
    let s = this.store.object;
    let d = this._deviceFront;

    // Device Front
    d.getDescription().then((json) => {
      json.dpi = ~~json.dpi;
      s.description = json;
    })
    .then(() => d.getPermissionsTable())
    .then((json) => {
      let permissionsTable = json.permissionsTable;
      let permissionsArray = [];
      for (let name in permissionsTable) {
        permissionsArray.push({
          name: name,
          app: permissionsTable[name].app,
          privileged: permissionsTable[name].privileged,
          certified: permissionsTable[name].certified,
        });
      }
      s.permissions = permissionsArray;
    });

    // Web Apps Actor
    let request = {
      to: this._webAppsActor,
      type: "getAll"
    };

    this.client.request(request, (res) => {
      let apps = res.apps;
      s.apps.all = apps;
      this._listenToAppsStatus();
    });
  },

  _listenToAppsStatus: function() {
    let request = {
      to: this._webAppsActor,
      type: "watchApps"
    };

    this.client.request(request, () => {

      this.client.addListener("appOpen", (type, { manifestURL }) => {
        this._onAppOpen(manifestURL);
      });
      this.client.addListener("appClose", (type, { manifestURL }) => {
        this._onAppClose(manifestURL);
      });

      let request = {
        to: this._webAppsActor,
        type: "listRunningApps"
      };

      for (let a of this.store.object.apps.all) {
        a.status = "notrunning";
      }

      this.client.request(request, ({apps}) => {
        this.store.object.apps.running = apps;
        for (let m of apps) {
          let a = this._getAppFromManifest(m);
          if (a) {
            a.status = "running";
          } else {
            dump("Unexpected manifest: " + m + "\n");
          }
        }
        this._fetchIcons();
      });
    });
  },

  _fetchIcons: function() {
    let allApps = this.store.object.apps.all;
    let count = allApps.length;
    let request = {
      to: this._webAppsActor,
      type: "getIconAsDataURL"
    };
    let client = this.client;
    (function getIcon() {
      if (!count)
        return;
      count--;
      let a = allApps[count];
      request.manifestURL = a.manifestURL;
      client.request(request, (res) => {
        if (res.url) {
          a.iconURL = res.url;
        }
        getIcon();
      });
    })();
  },

  _resetStore: function() {
    this.store.object.description  = {};
    this.store.object.permissions = [];
    this.store.object.activities = [];
    this.store.object.apps = {all: [], running: []}
  },

  _getAppFromManifest: function(manifest) {
    return this.store.object.apps.all.filter(a => {
      return a.manifestURL == manifest;
    })[0];
  },

  _onAppOpen: function(manifest) {
    let a = this._getAppFromManifest(manifest);
    a.status = "running";
    let running = this.store.object.apps.running;
    if (running.indexOf(manifest) < 0) {
      this.store.object.apps.running.push(manifest);
    }
  },

  _onAppClose: function(manifest) {
    let a = this._getAppFromManifest(manifest);
    a.status = "notrunning";
    let running = this.store.object.apps.running;
    this.store.object.apps.running = running.filter((m) => {
      return m != manifest;
    });
  },
}
