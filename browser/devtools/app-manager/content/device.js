const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;

const {ConnectionsManager} = require("devtools/client/connections-manager");
const {getDeviceFront} = require("devtools/server/actors/device");
const EventEmitter = require("devtools/shared/event-emitter");
const DeviceStore = require("devtools/app-manager/device-store");
const WebappsStore = require("devtools/app-manager/webapps-store");
const promise = require("sdk/core/promise");

window.addEventListener("message", function(event) {
  try {
    let json = JSON.parse(event.data);
    if (json.name == "connection") {
      let cid = +json.cid;
      for (let c of ConnectionsManager.connections) {
        if (c.uid == cid) {
          UI.connection = c;
          UI.onNewConnection();
          break;
        }
      }
    }
  } catch(e) {}
}, false);

let UI = {
  init: function() {
    this.setTab("apps");
    if (this.connection) {
      this.onNewConnection();
    } else {
      this.hide();
    }
  },

  hide: function() {
    document.body.classList.add("notconnected");
  },

  show: function() {
    document.body.classList.remove("notconnected");
  },

  onNewConnection: function() {
    this.connection.on("status-changed", () => this._onConnectionStatusChange());

    this.store = this._mergeStores({
      "device": new DeviceStore(this.connection),
      "apps": new WebappsStore(this.connection),
    });

    this.store.on("set", (e,p,v) => console.log(p.join(".")));

    this.template = new Template(document, this.store, (property, args) => {
      return this._solvel10n(property, args);
    });

    this.template.start();
    this._onConnectionStatusChange();
  },

  _mergeStores: function(stores) {
    let finalStore = {object:{}};
    EventEmitter.decorate(finalStore);
    for (let key in stores) {
      (function(key) {
        finalStore.object[key] = stores[key].object,
        stores[key].on("set", function(event, path, value) {
          finalStore.emit("set", [key].concat(path), value);
        });
      })(key);
    }
    return finalStore;
  },

  _onConnectionStatusChange: function() {
    if (this.connection.status != this.connection.CONNECTED) {
      this.hide();
      this.listTabsResponse = null;
    } else {
      this.show();
      this.connection.client.listTabs(
        response => this.listTabsResponse = response
      );
    }
  },

  _solvel10n: function(property, args = []) {
    if (!this._strings) {
      this._strings = Services.strings.createBundle("chrome://browser/locale/devtools/app-manager.properties");
    }
    if (args && args.length > 0) {
      return this._strings.formatStringFromName(property, args, args.length);
    } else {
      return this._strings.GetStringFromName(property);
    }
  },

  setTab: function(name) {
    var tab = document.querySelector(".tab.selected");
    var panel = document.querySelector(".tabpanel.selected");

    if (tab) tab.classList.remove("selected");
    if (panel) panel.classList.remove("selected");

    var tab = document.querySelector(".tab." + name);
    var panel = document.querySelector(".tabpanel." + name);

    if (tab) tab.classList.add("selected");
    if (panel) panel.classList.add("selected");
  },

  screenshot: function() {
    if (!this.listTabsResponse)
      return;
    let front = getDeviceFront(this.connection.client, this.listTabsResponse);
    front.screenshotToBlob().then(blob => window.open(blob));
  },

  _getTargetForApp: function(manifest) {
    if (!this.listTabsResponse)
      return;
    let actor = this.listTabsResponse.webappsActor;
    let deferred = promise.defer();
    let request = {
      to: actor,
      type: "getAppActor",
      manifestURL: manifest,
    }
    this.connection.client.request(request, (res) => {
      if (res.error) {
        return deferred.reject(res.error);
      }
      let options = {
        form: res.actor,
        client: this.connection.client,
        chrome: false
      };

      devtools.TargetFactory.forRemoteTab(options).then((target) => {
        deferred.resolve(target)
      }, (error) => {
        deferred.reject(error);
      });
    });
    return deferred.promise;
  },

  openToolbox: function(manifest) {
    this._getTargetForApp(manifest).then((target) => {
      gDevTools.showToolbox(target,
                            null,
                            devtools.Toolbox.HostType.WINDOW,
                            this.connection.uid);
    }, console.error);
  },

  startApp: function(manifest) {
    let deferred = promise.defer();

    if (!this.listTabsResponse) {
      deferred.reject();
    } else {
      let actor = this.listTabsResponse.webappsActor;
      let request = {
        to: actor,
        type: "launch",
        manifestURL: manifest,
      }
      this.connection.client.request(request, (res) => {
        deferred.resolve()
      });
    }
    return deferred.promise;
  },

  stopApp: function(manifest) {
    let deferred = promise.defer();

    if (!this.listTabsResponse) {
      deferred.reject();
    } else {
      let actor = this.listTabsResponse.webappsActor;
      let request = {
        to: actor,
        type: "close",
        manifestURL: manifest,
      }
      this.connection.client.request(request, (res) => {
        deferred.resolve()
      });
    }
    return deferred.promise;
  },
}
