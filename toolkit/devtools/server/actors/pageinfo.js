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


Cu.import("resource://gre/modules/jsdebugger.jsm");
Cu.import('resource://gre/modules/devtools/dbg-server.jsm');
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");

addDebuggerToGlobal(this);

let PageInfo = protocol.ActorClass({
  typeName: "pageinfo",
  initialize: function(conn, tabActor) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this.tabActor = tabActor;
  },

  getInfo: method(function() {
    let window = this.tabActor.window;

    // FIXME: wait until page is loaded

    let deferred = promise.defer();
    let json = {};

    let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    let docShell = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShell);
    let eventListenerService = Cc["@mozilla.org/eventlistenerservice;1"].getService(Ci.nsIEventListenerService);
    let DOMUtils = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
    let dbg = new Debugger(window);

    // Basic
    json.title = window.document.title;
    json.url = window.location.href;
    json.contentType = window.document.contentType;
    json.characterSet = window.document.characterSet;
    json.quirksMode = window.document.compatMode == "BackCompat";

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
        hostName = window.location.host;
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

    domWindowUtils.getViewportInfo(window.screen.width, window.screen.height,
        json.viewportInfo.defaultZoom,
        json.viewportInfo.allowZoom,
        json.viewportInfo.minZoom,
        json.viewportInfo.maxZoom,
        json.viewportInfo.width,
        json.viewportInfo.height,
        json.viewportInfo.autoSize);

    for (let k in json.viewportInfo) json.viewportInfo[k] = json.viewportInfo[k].value;

    // Size
    json.size = {width: window.document.documentElement.scrollWidth, height: window.document.documentElement.scrollHeight};

    // Pixels
    json.screenPixelsPerCSSPixel = domWindowUtils.screenPixelsPerCSSPixel;
    json.displayDPI = domWindowUtils.displayDPI;

    // DocShells
    json.docShellCount = 0;
    json.docShells = (function getSubDocShells(docShell) {
      json.docShellCount++;
      docShell.QueryInterface(Ci.nsIDocShell);
      docShell.QueryInterface(Ci.nsIDocShellTreeNode);
      let res = {};
      if (docShell.contentViewer) {
        res.url = docShell.contentViewer.DOMDocument.location.href;
      }
      res.isChrome = docShell.itemType == docShell.typeChrome;


      res.child = [];
      for (let i = 0; i < docShell.childCount; i++) {
        let child = docShell.getChildAt(i);
        res.child.push(getSubDocShells(child));
      }
      return res;
    })(docShell)

    // Meta
    let metanodes = window.document.querySelectorAll("head > meta");
    metanodes = Array.prototype.slice.call(metanodes);
    json.metaNodes = metanodes.map((m) => ({name: m.name, content: m.content, httpEquiv: m.httpEquiv}));

    // Scripts
    json.scripts = [s for (s of new Set(dbg.findScripts().map(s => s.url)))];

    // StyleSheets
    if (window.document.styleSheets) {
      let ssheets = window.document.styleSheets;
      ssheets = Array.prototype.slice.call(ssheets);
      json.ssheets = ssheets.map((s) => s.href?s.href:"inline");
    }

    // Plugins
    if (window.document.plugins) {
      let plugins = window.document.plugins;
      plugins = Array.prototype.slice.call(plugins);
      json.plugins = plugins.map((p) => ({tag: p.tagName, src: p.src}));
    }

    // Cached console messages
    (function getCachedConsoleMessages() {

      const CATEGORY_NETWORK = 0;
      const CATEGORY_CSS = 1;
      const CATEGORY_JS = 2;
      const CATEGORY_WEBDEV = 3;
      const CATEGORY_INPUT = 4;
      const CATEGORY_OUTPUT = 5;
      const CATEGORY_SECURITY = 6;

      const SEVERITY_ERROR = 0;
      const SEVERITY_WARNING = 1;
      const SEVERITY_INFO = 2;
      const SEVERITY_LOG = 3;

      function categoryToString(category) {
        if (category == CATEGORY_NETWORK) return "network";
        if (category == CATEGORY_CSS) return "css";
        if (category == CATEGORY_JS) return "js";
        if (category == CATEGORY_WEBDEV) return "webdev";
        if (category == CATEGORY_INPUT) return "input";
        if (category == CATEGORY_OUTPUT) return "output";
        if (category == CATEGORY_SECURITY) return "security";
      }

      function severityToString(severity) {
        if (severity == SEVERITY_ERROR) return "error";
        if (severity == SEVERITY_WARNING) return "warning";
        if (severity == SEVERITY_INFO) return "info";
        if (severity == SEVERITY_LOG) return "log";
      }

      function categoryForScriptError(aScriptError) {
        switch (aScriptError.category) {
          case "CSS Parser":
          case "CSS Loader":
            return CATEGORY_CSS;

          case "Mixed Content Blocker":
          case "Mixed Content Message":
          case "CSP":
          case "Invalid HSTS Headers":
          case "Insecure Password Field":
          case "SSL":
            return CATEGORY_SECURITY;

          default:
            return CATEGORY_JS;
        }
      }

      let WebConsoleUtils = require("devtools/toolkit/webconsole/utils").Utils;
      let {ConsoleServiceListener, ConsoleAPIListener} = require("devtools/toolkit/webconsole/utils");


      let messages = [];


      let consoleAPIListener = new ConsoleAPIListener(window);
      let cacheConsoleAPI = consoleAPIListener.getCachedMessages(true);
      cacheConsoleAPI.forEach((aMessage) => {
        let message = WebConsoleUtils.cloneObject(aMessage);
        message._type = "ConsoleAPI";
        delete message.wrappedJSObject;
        delete message.ID;
        delete message.innerID;
        message.message = Array.prototype.join.call(aMessage.arguments, ",");
        messages.push(message);
      });

      let consoleServiceListener = new ConsoleServiceListener(window);
      let cacheConsoleService = consoleServiceListener.getCachedMessages(true);
      cacheConsoleService.forEach((aMessage) => {
        let message = null;
        if (aMessage instanceof Ci.nsIScriptError) {
          message = {
            errorMessage: aMessage.errorMessage,
            sourceName: aMessage.sourceName,
            lineNumber: aMessage.lineNumber,
            category: aMessage.category,
            warning: !!(aMessage.flags & aMessage.warningFlag),
            error: !!(aMessage.flags & aMessage.errorFlag),
            exception: !!(aMessage.flags & aMessage.exceptionFlag),
            strict: !!(aMessage.flags & aMessage.strictFlag),
          };

          message._type = "PageError";
        } else {
          message = {
            _type: "LogMessage",
            message: aMessage.message,
            timeStamp: aMessage.timeStamp,
          };
        }
        messages.push(message);
      });

      messages = messages.filter((aMessage) => {
        return !(aMessage._type == "ConsoleAPI" &&
                 aMessage.level != "warn" &&
                 aMessage.level != "error");
      });

      messages = messages.map((aMessage) => {
        switch (aMessage._type) {
          case "PageError":
            let category = categoryForScriptError(aMessage);
            let severity = SEVERITY_ERROR;
            if (aMessage.warning || aMessage.strict) {
              severity = SEVERITY_WARNING;
            }
            return {
              category: categoryToString(category),
              severity: severityToString(severity),
              message: aMessage.errorMessage,
              sourceName: aMessage.sourceName,
              lineNumber: aMessage.lineNumber
            }
          case "LogMessage": // FIXME: skip?
            let msg = aPacket.message;
            return {
              category: categoryToString(CATEGORY_JS),
              severity: severityToString(SEVERITY_LOG),
              message: aPacket.message
            }
          case "ConsoleAPI":
            let level = aMessage.level;
            if (level == "warn")
              level = SEVERITY_WARNING;
            else
              level = SEVERITY_ERROR;
            return {
              category: categoryToString(CATEGORY_WEBDEV),
              severity: severityToString(level),
              message: aMessage.message,
              sourceName: aMessage.filename,
              lineNumber: aMessage.lineNumber
            }
        }
      });

      json.messages = messages;

    })()

    // Fonts
    let rng = window.document.createRange();
    rng.selectNode(window.document.documentElement);
    let fonts = DOMUtils.getUsedFontFaces(rng);
    let fontsArray = [];
    for (let i = 0; i < fonts.length; i++) {
      fontsArray.push(fonts.item(i));
    }
    fontsArray = fontsArray.sort(function(a, b) {
      return a.srcIndex < b.srcIndex;
    });
    json.fonts = fontsArray.map((font) => {
      let jsonFont = {
        name: font.name,
        CSSFamilyName: font.CSSFamilyName,
        format: font.format,
        isRemote: font.srcIndex != -1
      }
      if (font.rule) {
        // This is the @font-face{…} code.
        jsonFont.cssText = font.rule.style.parentRule.cssText;
        let origin = font.rule.style.parentRule.parentStyleSheet.href;
        if (!origin) { // Inline stylesheet
          origin = window.location.href;
        }
        // We remove the last part of the URL to get a correct base.
        jsonFont.base = origin.replace(/\/[^\/]*$/,"/");
        jsonFont.origin = origin;
      }
      return jsonFont;
    });

    // Favicon
    let faviconDefered = promise.defer();
    let uri = Services.io.newURI(window.location, null, null);
    PlacesUtils.favicons.getFaviconURLForPage(uri, (uri) => {
      if (uri) {
        json.favicon = PlacesUtils.favicons.getFaviconLinkForIcon(uri).spec;
      } else {
        json.favicon = PlacesUtils.favicons.defaultFavicon.spec;
      }
      faviconDefered.resolve();
    });

    return faviconDefered.promise.then(() => json);

  }, {request: {}, response: { value: RetVal("json")}}),

  getColorProfile: method(function() {
    let window = this.tabActor.window;
    let chromeWindow = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);

    // FIXME: chromeWindow not always available

    let canvas = chromeWindow.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    let contentWidth = window.document.documentElement.scrollWidth;
    let contentHeight = window.document.documentElement.scrollHeight;
    canvas.width = contentWidth;
    canvas.height = contentHeight;
    let context = canvas.getContext("2d"); 
    context.drawWindow(window, window.scrollX, window.scrollY, contentWidth, contentHeight, "white");
    let pixels = context.getImageData(0, 0, contentWidth, contentHeight).data;

    let colorDeferred = promise.defer();
    let worker = new chromeWindow.Worker("resource://gre/modules/devtools/color-analyzer/analyzer-worker.js");
    worker.onmessage = function(event) {
      colorDeferred.resolve(event.data.colors);
    };
    worker.onerror = function(event) {
      colorDeferred.reject("worker error");
    };
    worker.postMessage({pixels: pixels, width: contentWidth, height: contentHeight});

    return colorDeferred.promise;

  }, {request: {}, response: { value: RetVal("json")}}),

});

exports.PageInfoFront = protocol.FrontClass(PageInfo, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.pageinfo;
    client.addActorPool(this);
    this.manage(this);
  },
});


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

let allNodes = window.document.querySelectorAll("*");
json.nodeCount = allNodes.length;
for (let node of allNodes) {
  analyseOneNode(node);
}

json.nodes = [];
for (let [, info] of NOI) {
  json.nodes.push(info);
}
*/
