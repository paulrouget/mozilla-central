/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu, Cm} = require("chrome");
const protocol = require("devtools/server/protocol");
const {method, RetVal} = protocol;
const promise = require("sdk/core/promise");
const {LongStringActor} = require("devtools/server/actors/string");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PermissionsTable.jsm")
Cu.import('resource://gre/modules/devtools/dbg-server.jsm');

exports.register = function(handle) {
  handle.addGlobalActor(DeviceActor, "deviceActor");
};

exports.unregister = function(handle) {
};

let DeviceActor = protocol.ActorClass({
  typeName: "device",

  _desc: null,

  getAppIniString : function(section, key) {
    var directoryService = Services.dirsvc;
    var inifile = Services.dirsvc.get("GreD", Ci.nsIFile);
    inifile.append("application.ini");

    if (!inifile.exists()) {
      inifile = Services.dirsvc.get("CurProcD", Ci.nsIFile);
      inifile.append("application.ini");
    }

    let iniParser = Cm.getClassObjectByContractID("@mozilla.org/xpcom/ini-parser-factory;1", Ci.nsIINIParserFactory).createINIParser(inifile);
    try {
      return iniParser.getString(section, key);
    } catch (e) {
      return undefined;
    }
  },

  getDescription: method(function() {
    // Most of this code is inspired from Nightly Tester Tools:
    // https://wiki.mozilla.org/Auto-tools/Projects/NightlyTesterTools

    let appInfo = Services.appinfo;
    let win = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);
    let utils = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);

    // Static data

    if (!this._desc) {
      this._desc = {
        appid: appInfo.ID,
        vendor: appInfo.vendor,
        name: appInfo.name,
        version: appInfo.version,
        appbuildid: appInfo.appBuildID,
        platformbuildid: appInfo.platformBuildID,
        platformversion: appInfo.platformVersion,
        geckobuildid: appInfo.platformBuildID,
        geckoversion: appInfo.platformVersion,
        changeset: this.getAppIniString("App", "SourceStamp"),
        useragent: win.navigator.userAgent,
        locale: Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global"),
        os: appInfo.OS,
        processor: appInfo.XPCOMABI.split("-")[0],
        compiler: appInfo.XPCOMABI.split("-")[1],
        dpi: utils.displayDPI,
        brandShortName: null,
        brandFullName: null,
        channel: null,
        profile: null,
        width: null,
        height: null,
      }

      // brandname
      let bundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");
      if (bundle) {
        this._desc.brandShortName = bundle.GetStringFromName("brandShortName");
        this._desc.brandFullName = bundle.GetStringFromName("brandFullName");
      }

      // Profile
      let profd = Services.dirsvc.get("ProfD", Ci.nsILocalFile);
      let profservice = Cc["@mozilla.org/toolkit/profile-service;1"].getService(Ci.nsIToolkitProfileService);
      var profiles = profservice.profiles;
      while (profiles.hasMoreElements()) {
        let profile = profiles.getNext().QueryInterface(Ci.nsIToolkitProfile);
        if (profile.rootDir.path == profd.path) {
          this._desc.profile = profile.name;
          break;
        }
      }

      if (!this._desc.profile) {
        this._desc.profile = profd.leafName;
      }

      // Channel
      try {
        this._desc.channel = Services.prefs.getCharPref('app.update.channel');
      } catch(e) {}

    }

    // Dynamic data
    this._desc.width = win.screen.width;
    this._desc.height = win.screen.height;

    return this._desc;
  }, {request: {},response: { value: RetVal("json")}}),

  screenshotToDataURL: method(function() {
    let window = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);
    let canvas = window.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    let context = canvas.getContext('2d');
    let flags =
          context.DRAWWINDOW_DRAW_CARET |
          context.DRAWWINDOW_DRAW_VIEW |
          context.DRAWWINDOW_USE_WIDGET_LAYERS;
    context.drawWindow(window, 0, 0, width, height, 'rgb(255,255,255)', flags);
    let dataURL = canvas.toDataURL('image/png')
    return new LongStringActor(this.conn, dataURL);
  }, {request: {},response: { value: RetVal("longstring")}}),

  getPermissionsTable: method(function() {
    return {
      permissionsTable: PermissionsTable,
      UNKNOWN_ACTION: Ci.nsIPermissionManager.UNKNOWN_ACTION,
      ALLOW_ACTION: Ci.nsIPermissionManager.ALLOW_ACTION,
      DENY_ACTION: Ci.nsIPermissionManager.DENY_ACTION,
      PROMPT_ACTION: Ci.nsIPermissionManager.PROMPT_ACTION
    };
  }, {request: {},response: { value: RetVal("json")}})
});

let DeviceFront = protocol.FrontClass(DeviceActor, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.deviceActor;
    client.addActorPool(this);
    this.manage(this);
  },

  screenshotToBlob: function() {
    let deferred = promise.defer();
    this.screenshotToDataURL().then(longstr => {
      longstr.string().then(dataURL => {
        longstr.release().then(null, console.error);
        let win = Services.appShell.hiddenDOMWindow;
        let req = new win.XMLHttpRequest();
        req.open("GET", dataURL, true);
        req.responseType = "blob";
        req.onload = () => {
          let blob = req.response;
          deferred.resolve(win.URL.createObjectURL(blob));
        };
        req.onerror = () => {
          return deferred.reject();
        }
        req.send();
      });
    });
    return deferred.promise;
  },
});

const _knownDeviceFronts = new WeakMap();

exports.getDeviceFront = function(client, form) {
  if (_knownDeviceFronts.has(client))
    return _knownDeviceFronts.get(client);

  let front = new DeviceFront(client, form);
  _knownDeviceFronts.set(client, front);
  return front;
}
