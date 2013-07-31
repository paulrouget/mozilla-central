const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;
const {ConnectionsManager} = require("devtools/client/connections-manager");
const {DeviceClient} = require("devtools/app-manager/device-client");


let UI = {
  init: function() {
    this.onConnectionChanged = this.onConnectionChanged.bind(this);
    window.onhashchange = () => this.processHash();
    this.processHash();
    window.onunload = () => this.onunload();
  },

  processHash: function() {
    let hash = window.location.hash;
    if (!hash) {
      console.error("Not a valid URL");
      this.showCantConnect();
      return;
    }

    let res = (/cid=(.+)&url=(.+)/).exec(hash)
    if (!res) {
      console.error("Not a valid URL");
      this.showCantConnect();
      return;
    }

    let [,cid,url] = res;

    if (!cid || !url) {
      console.error("Not a valid URL");
      this.showCantConnect();
      return;
    }

    this.cid = cid;
    this.manifestURL = url;

    this.attachToConnection(cid);
  },

  showCantConnect: function() {
    console.log("Can't connect");
  },

  attachToConnection: function(cid) {
    if (!this.connection || this.connection.uid != cid) {
      let connections = ConnectionsManager.getConnections();
      let connection = connections.filter((({uid}) => uid == cid))[0];
      if (!connection) {
        console.error("Can't find connection");
        return;
      }
      if (this.connection) {
        this.connection.off("status-changed", this.onConnectionChanged);
      }
      this.connection = connection;
      this.connection.on("status-changed", this.onConnectionChanged);
      console.log("Connection " + cid + " found");

      this.onConnectionChanged();

      let iframe = document.querySelector("#device-inspector-iframe");
      let url = "chrome://browser/content/devtools/app-manager/device-inspector.xhtml";
      iframe.src = url + "#cid=" + cid;
    }
  },

  onConnectionChanged: function() {
    if (this.connection.status == this.connection.CONNECTED) {
      this.showToolbox();
    } else {
      this.showCantConnect();
    }
  },

  onunload: function() {
    console.log("app-toolbox-host.xhtml is closing");
    if (this.connection) {
      this.connection.off("status-changed", this.onConnectionChanged);
      this.connection = null;
    }
  },

  showToolbox: function() {
    let iframe = document.querySelector("#toolbox-iframe");
    let deviceClient = new DeviceClient(this.connection);
    deviceClient.getTargetForApp(this.manifestURL).then((target) => {
      gDevTools.showToolbox(target, "webconsole", devtools.Toolbox.HostType.WINDOW);
    }, (error) => {
      console.log("Error: " + error);
    });

  },
}
