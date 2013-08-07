/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {mix} = require("sdk/core/heritage");
const ObservableObject = require("devtools/shared/observable-object");
const {getDeviceFront} = require("devtools/server/actors/device");
const promise = require("sdk/core/promise");

const {Cu} = require("chrome");
const dbgClient = Cu.import("resource://gre/modules/devtools/dbg-client.jsm");
dbgClient.UnsolicitedNotifications.appOpen = "appOpen";
dbgClient.UnsolicitedNotifications.appClose = "appClose"

const _knownDeviceStores = new WeakMap();

module.exports = DeviceStore = function(connection) {
  // If we already know about this connection,
  // let's re-use the existing store.

  if (_knownDeviceStores.has(connection)) {
    return _knownDeviceStores.get(connection);
  }

  _knownDeviceStores.set(connection, this);

  ObservableObject.call(this, {});

  this._resetStore();

  this._destroy = this._destroy.bind(this);
  this._onStatusChanged = this._onStatusChanged.bind(this);

  this._connection = connection;
  this._connection.once("destroyed", this._destroy);
  this._connection.on("status-changed", this._onStatusChanged);
  this._onStatusChanged();
}

DeviceStore.prototype = {
  _destroy: function() {
    this._connection.off("status-changed", this._onStatusChanged);
    _knownDeviceStores.delete(this._connection);
    this._connection = null;
  },

  _resetStore: function() {
    this.object.description = {};
    this.object.permissions = [];
    this.object.apps = {all: [], running: []}
    this.object.settings = [];
  },

  _getAppFromManifest: function(manifest) {
    return this.object.apps.all.filter(a => {
      return a.manifestURL == manifest;
    })[0];
  },

  _onStatusChanged: function() {
    if (this._connection.status == this._connection.CONNECTED) {
      this._listTabs();
    } else {
      this._resetStore();
    }
  },

  _listTabs: function() {
    this._connection.client.listTabs((resp) => {
      this._deviceFront = getDeviceFront(this._connection.client, resp);
      this._webAppsActor = resp.webappsActor;
      this._feedStore();
    });
  },

  _feedStore: function(deviceFront, webAppsActor) {
    this._getDeviceDescription();
    this._getDevicePermissionsTable();
    this._listenToApps();
    this._getAllSettings();
    this._getAllApps()
    .then(this._getRunningApps.bind(this))
    .then(this._getAppsIcons.bind(this))
  },

  _getDeviceDescription: function() {
    return this._deviceFront.getDescription()
    .then(json => {
      json.dpi = ~~json.dpi;
      this.object.description = json;
    });
  },

  _getDevicePermissionsTable: function() {
    return this._deviceFront.getPermissionsTable()
    .then(json => {
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
      this.object.permissions = permissionsArray;
    });
  },

  _getAllSettings: function() {
    return this._deviceFront.getAllSettings()
    .then(json => {
      let array = [];
      for (let key in  json) {
        let oneSetting = {};
        oneSetting.name = key;
        oneSetting.value = json[key];

        let type = typeof json[key];
        oneSetting.type = type;
        if (type == "string" && json[key].indexOf("data:") == 0) {
          oneSetting.type = "url";
        }
        array.push(oneSetting);
      }
      this.object.settings = array;
    });
  },

  _listenToApps: function() {
    let deferred = promise.defer();
    let client = this._connection.client;

    let request = {
      to: this._webAppsActor,
      type: "watchApps"
    };

    client.request(request, (res) => {
      if (res.error) {
        return deferred.reject(res.error);
      }

      client.addListener("appOpen", (type, { manifestURL }) => {
        this._onAppOpen(manifestURL);
      });

      client.addListener("appClose", (type, { manifestURL }) => {
        this._onAppClose(manifestURL);
      });

      return deferred.resolve();
    })
    return deferred.promise;
  },

  _getAllApps: function() {
    let deferred = promise.defer();
    let request = {
      to: this._webAppsActor,
      type: "getAll"
    };

    this._connection.client.request(request, (res) => {
      if (res.error) {
        return deferred.reject(res.error);
      }
      let apps = res.apps;
      for (let a of apps) {
        a.running = false;
      }
      this.object.apps.all = apps;
      return deferred.resolve();
    });
    return deferred.promise;
  },

  _getRunningApps: function() {
    let deferred = promise.defer();
    let request = {
      to: this._webAppsActor,
      type: "listRunningApps"
    };

    this._connection.client.request(request, (res) => {
      if (res.error) {
        return deferred.reject(res.error);
      }

      let manifests = res.apps;
      this.object.apps.running = manifests;

      for (let m of manifests) {
        let a = this._getAppFromManifest(m);
        if (a) {
          a.running = true;
        } else {
          return deferred.reject("Unexpected manifest: " + m);
        }
      }

      return deferred.resolve();
    });
    return deferred.promise;
  },

  _getAppsIcons: function() {
    let deferred = promise.defer();

    let allApps = this.object.apps.all;

    let count = allApps.length;


    let request = {
      to: this._webAppsActor,
      type: "getIconAsDataURL"
    };
    let client = this._connection.client;

    (function getIcon() {
      if (!count) {
        return deferred.resolve();
      }
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

    return deferred.promise;
  },

  _onAppOpen: function(manifest) {
    let a = this._getAppFromManifest(manifest);
    a.running = true;
    let running = this.object.apps.running;
    if (running.indexOf(manifest) < 0) {
      this.object.apps.running.push(manifest);
    }
  },

  _onAppClose: function(manifest) {
    let a = this._getAppFromManifest(manifest);
    a.running = false;
    let running = this.object.apps.running;
    this.object.apps.running = running.filter((m) => {
      return m != manifest;
    });
  },
}
