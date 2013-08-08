const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;

const {ConnectionsManager} = require("devtools/client/connections-manager");
const EventEmitter = require("devtools/shared/event-emitter");
const ConnectionStore = require("devtools/app-manager/connection-store");
const DeviceStore = require("devtools/app-manager/device-store");

let UI = {
  init: function() {
    let connections = ConnectionsManager.connections;
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
    window.parent.postMessage(JSON.stringify({name:"connection",cid:this.connection.uid}), "*");

    let connectionStore = new ConnectionStore(this.connection);
    let deviceStore = new DeviceStore(this.connection);
    this.store = this._mergeStores({
      "device": new DeviceStore(this.connection),
      "connection": new ConnectionStore(this.connection),
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


  _solvel10n: function(property, args = []) {
    if (!this._strings) {
      this._strings = Services.strings.createBundle("chrome://browser/locale/devtools/connection-footer.properties");
    }
    if (args && args.length > 0) {
      return this._strings.formatStringFromName(property, args, args.length);
    } else {
      return this._strings.GetStringFromName(property);
    }
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
}
