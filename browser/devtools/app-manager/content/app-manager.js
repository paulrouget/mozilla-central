const Cu = Components.utils;
const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;
const {ConnectionsManager} = require("devtools/client/connections-manager");
const {DeviceClient} = require("devtools/app-manager/device-client");

let UI = {

  onload: function() {
    this.setupDeviceInspector((cid) => this.onNewConnection(cid));
  },

  setupDeviceInspector: function(onNewConnection) {
    let iframe = document.querySelector("#device-inspector-iframe");
    iframe.src = "device-inspector.xhtml";
    window.onmessage = function(event) {
      let message = JSON.parse(event.data);
      if ("height" in message) {
        iframe.style.height = message.height + "px";
      }
      if ("expanded" in message) {
        if (message.expanded)
          iframe.classList.add("expanded");
        else {
          iframe.classList.remove("expanded");
        }
      }
      if ("connection" in message) {
        onNewConnection(message.connection);
      }
    }
  },

  onNewConnection: function(cid) {
    if (cid == this.cid)
      return;

    this.cid = cid;
    let connections = ConnectionsManager.getConnections();
    let connection = connections.filter((({uid}) => uid == cid))[0];

    if (connection) {
      this.connection = connection;
      console.log("Connection object available:");
      console.log(connection);
    } else {
      console.error("Unknown connection: " + cid);
    }
  },
}
