const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;

const {ConnectionsManager} = require("devtools/client/connections-manager");
const {DeviceClient} = require("devtools/app-manager/device-client");

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

    this.deviceClient = new DeviceClient(this.connection);

    let pre = document.querySelector("#logs > pre");
    pre.textContent = this.connection.logs;
    this.connection.on("newlog", (event, str) => {
      pre.textContent += str + "\n";
    });

    this.template = new Template(document, this.deviceClient.store, (property, args) => {
      return this._solvel10n(property, args);
    });
    this.template.start();
  },

  _onConnectionStatusChange: function() {
    if (this.connection.status != this.connection.CONNECTED) {
      document.body.classList.remove("expanded");
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
    this.deviceClient.screenshot().then(longstr => {
      longstr.string().then(dataURL => {
        longstr.release().then(null, console.error);
        let req = new XMLHttpRequest();
        req.open("GET", dataURL, true);
        req.responseType = "blob";
        req.onload = () => {
          let blob = req.response;
          window.open(window.URL.createObjectURL(blob));
        };
        req.send();
      });
    });
  },

  openToolbox: function(button) {
    let manifest = button.getAttribute("manifest");
    this.deviceClient.getTargetForApp(manifest).then((target) => {
      gDevTools.showToolbox(target, "webconsole", devtools.Toolbox.HostType.WINDOW);
    });
  },
}
