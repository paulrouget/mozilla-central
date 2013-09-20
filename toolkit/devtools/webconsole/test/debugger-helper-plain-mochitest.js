/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm");
const { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm");

const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");

let gClient, gActor;

function connect(onDone) {
  DebuggerServer.init();
  DebuggerServer.addBrowserActors();
  gClient = new DebuggerClient(DebuggerServer.connectPipe());
  gClient.connect(function onConnect() {
    gClient.listTabs(function onListTabs(aResponse) {
      gActor = aResponse.webappsActor;
      if (gActor)
        onDone();
    });
  });

}


