/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const {Cc, Ci, Cu} = require("chrome");
const protocol = require("devtools/server/protocol");
const promise = require("sdk/core/promise");
const {setTimeout} = require("sdk/timers")
const {Arg, method, RetVal} = protocol;

exports.register = function(handle) {
  handle.addTabActor(PageInfo, "pageinfo");
};

exports.unregister = function(handle) {
  handle.removeTabActor(PageInfo);
};

let PageInfo = protocol.ActorClass({
  typeName: "pageinfo",
  initialize: function(conn, tabActor) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this.tabActor = tabActor;
  },

  getVersions: method(function() {
    let versions = [];
    for (let v in Implementations) versions.push(v);
    return versions;
  }, {request: {},response: { value: RetVal("array:string")}}),

  getInfo: method(function(version) {
    if (!(version in Implementations)) {
      throw Error("Unknown pageinfo implementation version.");
    }
    return Implementations[version](this.tabActor.window);
  }, {request: {value: Arg(0)}, response: { value: RetVal("json")}}),
});

exports.PageInfoFront = protocol.FrontClass(PageInfo, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.pageinfo;
    client.addActorPool(this);
    this.manage(this);
  },
});


Cu.import("resource://gre/modules/jsdebugger.jsm");
Cu.import('resource://gre/modules/devtools/dbg-server.jsm');

addDebuggerToGlobal(this);

const Implementations = {
  "1.0": function(gWindow) {

    // FIXME: wait until page is loaded

    let deferred = promise.defer();
    let json = {};

    let DOMUtils = gWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    let docShell = gWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShell);
    let eventListenerService = Cc["@mozilla.org/eventlistenerservice;1"].getService(Ci.nsIEventListenerService);
    Cu.import("resource://gre/modules/PlacesUtils.jsm");
    Cu.import("resource://gre/modules/Services.jsm");
    let dbg = new Debugger(gWindow);
    let chromeWindow = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);

    // Basic
    json.title = gWindow.document.title;
    json.url = gWindow.location.href;
    json.contentType = gWindow.document.contentType;
    json.characterSet = gWindow.document.characterSet;
    json.quirksMode = gWindow.document.compatMode == "BackCompat";

    // <iframe mozapp mozbrowser>
    json.isBrowser = docShell.isBrowserElement;
    json.isApp = docShell.isApp;
    if (json.isApp) json.manifestURL = docShell.appManifestURL;

    // Mixed content
    json.hasMixedContent = docShell.hasMixedActiveContentLoaded ||
                           docShell.hasMixedActiveContentBlocked ||
                           docShell.hasMixedDisplayContentLoaded ||
                           docShell.hasMixedDisplayContentBlocked;

    // Security
    (function getSecuState() {
      let ui = docShell.securityUI;
      let isBroken = (ui.state & Ci.nsIWebProgressListener.STATE_IS_BROKEN);
      let isInsecure = (ui.state & Ci.nsIWebProgressListener.STATE_IS_INSECURE);
      let isEV = (ui.state & Ci.nsIWebProgressListener.STATE_IDENTITY_EV_TOPLEVEL);
      ui.QueryInterface(Ci.nsISSLStatusProvider);
      let status = ui.SSLStatus;

      let hostName = null;
      try {
        hostName = gWindow.location.host;
      } catch (e) { }

      if (!isInsecure && status) {
        status.QueryInterface(Ci.nsISSLStatus);
        let cert = status.serverCert;
        let issuerName = cert.issuerOrganization || cert.issuerName;
        json.security = {
          hostName : hostName,
          cAName : issuerName,
          encryptionAlgorithm : undefined,
          encryptionStrength : undefined,
          isBroken : isBroken,
          isEV : isEV,
          isDomainMismatch: status.isDomainMismatch,
          isNotValidAtThisTime: status.isNotValidAtThisTime,
          isUntrusted: status.isUntrusted
        };

        try {
          json.security.encryptionAlgorithm = status.cipherName;
          json.security.encryptionStrength = status.secretKeyLength;
        } catch (e) { }
      } else {
        json.security = {
          hostName : hostName,
          isBroken : isBroken,
          isEV : isEV,
        };
      }
    })()

    // Viewport
    json.viewportInfo = {
      defaultZoom: {},
      allowZoom: {},
      minZoom: {},
      maxZoom: {},
      width: {},
      height: {},
      autoSize: {}
    };

    DOMUtils.getViewportInfo(gWindow.screen.width, gWindow.screen.height,
        json.viewportInfo.defaultZoom,
        json.viewportInfo.allowZoom,
        json.viewportInfo.minZoom,
        json.viewportInfo.maxZoom,
        json.viewportInfo.width,
        json.viewportInfo.height,
        json.viewportInfo.autoSize);

    for (let k in json.viewportInfo) json.viewportInfo[k] = json.viewportInfo[k].value;

    // Size
    json.size = {width: gWindow.document.documentElement.scrollWidth, height: gWindow.document.documentElement.scrollHeight};

    // Pixels
    json.screenPixelsPerCSSPixel = DOMUtils.screenPixelsPerCSSPixel;
    json.displayDPI = DOMUtils.displayDPI;

    // DocShells
    json.docShellCount = 0;
    json.docShells = (function getSubDocShells(docShell) {
      json.docShellCount++;
      docShell.QueryInterface(Ci.nsIDocShell);
      docShell.QueryInterface(Ci.nsIDocShellTreeNode);
      let res = {};
      res.url = docShell.contentViewer.DOMDocument.location.href;
      res.isChrome = docShell.itemType == docShell.typeChrome;


      res.child = [];
      for (let i = 0; i < docShell.childCount; i++) {
        let child = docShell.getChildAt(i);
        res.child.push(getSubDocShells(child));
      }
      return res;
    })(docShell)

    // Meta
    let metanodes = gWindow.document.querySelectorAll("head > meta");
    metanodes = Array.prototype.slice.call(metanodes);
    json.metaNodes = metanodes.map((m) => ({name: m.name, content: m.content, httpEquiv: m.httpEquiv}));

    // Scripts
    json.scripts = [s for (s of new Set(dbg.findScripts().map(s => s.url)))];

    // StyleSheets
    if (gWindow.document.styleSheets) {
      let ssheets = gWindow.document.styleSheets;
      ssheets = Array.prototype.slice.call(ssheets);
      json.ssheets = ssheets.map((s) => s.href?s.href:"inline");
    }

    // Plugins
    if (gWindow.document.plugins) {
      let plugins = gWindow.document.plugins;
      plugins = Array.prototype.slice.call(plugins);
      json.plugins = plugins.map((p) => ({tag: p.tagName, src: p.src}));
    }

    // Cached console messages
    (function getCachedConsoleMessages() {
      let {ConsoleServiceListener, ConsoleAPIListener} = require("devtools/toolkit/webconsole/utils");

      let consoleServiceListener = new ConsoleServiceListener(gWindow);
      let consoleAPIListener = new ConsoleAPIListener(gWindow);

      // FIXME: what do with this?
    })()

    // Colors

    // FIXME: chromeWindow not always available

    let canvas = chromeWindow.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    let contentWidth = json.size.width;
    let contentHeight = json.size.height;
    canvas.width = contentWidth;
    canvas.height = contentHeight;
    let context = canvas.getContext("2d"); 
    context.drawWindow(gWindow, gWindow.scrollX, gWindow.scrollY, contentWidth, contentHeight, "white");
    let pixels = context.getImageData(0, 0, contentWidth, contentHeight).data;

    let colorPromise = promise.defer();
    let worker = new chromeWindow.Worker("resource://gre/modules/devtools/color-analyzer/analyzer-worker.js");
    worker.onmessage = function(event) {
      dump("message");
      let colors = event.data.colors;
      json.colors = colors;
      colorPromise.resolve(json);
    };
    worker.onerror = function(event) {
      dump("error");
      colorPromise.reject("worker error");
    };
    worker.postMessage({pixels: pixels, width: contentWidth, height: contentHeight});

    // Favicon
    let faviconPromise = promise.defer();
    let uri = Services.io.newURI(gWindow.location, null, null);
    PlacesUtils.favicons.getFaviconURLForPage(uri, (uri) => {
      if (uri) {
        json.favicon = PlacesUtils.favicons.getFaviconLinkForIcon(uri).spec;
      } else {
        json.favicon = PlacesUtils.favicons.defaultFavicon.spec;
      }
      faviconPromise.resolve();
    });


    return colorPromise.promise;
  }
};



/*
let NOI = new Map();
function getNodeName(node) {
  let nodeName = (node.nodeName + "").toLowerCase();
  if (node.id) nodeName += "#" + node.id;
  if (node.className) nodeName += "." + node.className;
  if (nodeName == "undefined") nodeName = "window " + node.document.location.href; // FIXME
  return nodeName;
}
function addInfoToNode(node, key, value) {
  if (!NOI.has(node)) {
      let info = {
          selector: getNodeName(node),
          data: {},
      }
      NOI.set(node, info);
  }
  NOI.get(node).data[key] = value;
}
function analyseOneNode(node) {
  // Event Listeners
  let handlers = eventListenerService.getListenerInfoFor(node);
  let listeners = [];
  for (let handler of handlers) {
    if (handler.listenerObject) {
      listeners.push({
          name: handler.type,
          capturing: handler.capturing,
          allowsUntrusted: handler.allowsUntrusted,
          inSystemEventGroup: handler.inSystemEventGroup
      });
    }
  }
  if (listeners.length > 0) {
    addInfoToNode(node, "listeners", listeners);
  }
}

let allNodes = gWindow.document.querySelectorAll("*");
json.nodeCount = allNodes.length;
for (let node of allNodes) {
  analyseOneNode(node);
}

json.nodes = [];
for (let [, info] of NOI) {
  json.nodes.push(info);
}
*/
