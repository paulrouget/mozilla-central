const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;

const {ConnectionsManager} = require("devtools/client/connections-manager");
const EventEmitter = require("devtools/shared/event-emitter");
const DeviceStore = require("devtools/app-manager/device-store");
const {getDeviceFront} = require("devtools/server/actors/device");
const ConnectionStore = require("devtools/app-manager/connection-store");
const promise = require("sdk/core/promise");

let UI = {
  init: function() {
    UI.setTab("apps");

    let connections = ConnectionsManager.getConnections();
    if (connections.length > 0) {
      let hash = window.location.hash;
      if (hash) {
        let res = (/cid=([^&]+)/).exec(hash)
        if (res) {
          let [,cid] = res;
          this.connection = connections.filter((({uid}) => uid == cid))[0];
        }
      }
      if (!this.connection) {
        // We take the first connection available.
        this.connection = connections[0];
      }
    } else {
      let host = Services.prefs.getCharPref("devtools.debugger.remote-host");
      let port = Services.prefs.getIntPref("devtools.debugger.remote-port");
      this.connection = ConnectionsManager.createConnection(host, port);
    }

    window.location.hash = "cid=" + this.connection.uid;

    this.connection.on("status-changed", () => this._onConnectionStatusChange());

    let deviceStore = new DeviceStore(this.connection);
    let connectionStore = new ConnectionStore(this.connection);

    this.store = this._mergeStores({
      "device": deviceStore,
      "connection": connectionStore,
    });

    let pre = document.querySelector("#logs > pre");
    pre.textContent = this.connection.logs;
    this.connection.on("newlog", (event, str) => {
      pre.textContent += "\n" + str;
    });

    this.template = new Template(document, this.store, (property, args) => {
      return this._solvel10n(property, args);
    });
    this.template.start();

    this._sendHeightToParent();
    this._sendConnectionIDToParent();
  },

  _sendHeightToParent: function() {
    let banner = document.querySelector("#banners-and-logs");
    let height = banner.getBoundingClientRect().height;
    window.parent.postMessage(JSON.stringify({height:height}), "*");
  },

  _sendExpandedStatusToParent: function() {
    let expanded = document.body.classList.contains("expanded");
    window.parent.postMessage(JSON.stringify({expanded:expanded}), "*");
  },

  _sendConnectionIDToParent: function() {
    window.parent.postMessage(JSON.stringify({connection:this.connection.uid}), "*");
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
      document.body.classList.remove("expanded");
      this.listTabsResponse = null;
    } else {
      this.connection.client.listTabs(
        response => this.listTabsResponse = response
      );
    }
  },

  _solvel10n: function(property, args = []) {
    if (!this._strings) {
      this._strings = Services.strings.createBundle("chrome://browser/locale/devtools/device-inspector.properties");
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

  toggleDeviceInspector: function() {
    document.body.classList.toggle("expanded");
    this._sendExpandedStatusToParent();
  },

  disconnect: function() {
    this.connection.disconnect();
  },

  connect: function() {
    this.connection.connect();
  },

  editConnectionParameters: function() {
    document.body.classList.add("edit-connection");
  },

  saveConnectionInfo: function() {
    document.body.classList.remove("edit-connection");
    let host = document.querySelector("input.host").value;
    let port = Math.abs(document.querySelector("input.port").value);
    if (!!port) {
      this.connection.port = port;
    }
    this.connection.host = host;
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
    }, (error) => {
      deferred.reject(error);
    });
    return deferred.promise;
  },

  updateSetting: function(input) {
    let name = input.parentNode.parentNode.querySelector(".setting-name").value;
    let value;
    console.log(input);
    if (input.type == "checkbox") {
      value = input.checked;
    } else {
      value = input.value;
    }
    let front = getDeviceFront(this.connection.client, this.listTabsResponse);
    front.setSetting(name, value);
  },

  filterSettings: function(value = "") {
    let settings = document.querySelectorAll(".setting");
    for (let s of settings) {
      if (s.dataset.name.indexOf(value) > -1) {
        s.removeAttribute("hidden");
      } else {
        s.setAttribute("hidden", "true");
      }
    }
  },

  openToolbox: function(button) {
    let manifest = button.getAttribute("manifest");
    this._getTargetForApp(manifest).then((target) => {
      gDevTools.showToolbox(target,
                            null,
                            devtools.Toolbox.HostType.WINDOW,
                            this.connection.uid);
    }, console.error);
  },
}
