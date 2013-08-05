/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu} = require("chrome");
const protocol = require("devtools/server/protocol");
const {Arg, Option, method, RetVal, types} = protocol;
const promise = require("sdk/core/promise");
const {LongStringActor} = require("devtools/server/actors/string");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PermissionsTable.jsm")

exports.register = function(handle) {
  handle.addGlobalActor(DeviceActor, "deviceActor");
};

exports.unregister = function(handle) {
};

let DeviceActor = protocol.ActorClass({
  typeName: "device",

  _getSetting: function(name, defaultValue=null) {
    let deferred = promise.defer();
    if (Services.settings) {
      let req = Services.settings.createLock().get(name, {
        handle: (name, value) => deferred.resolve(value || defaultValue),
        handleError: () => deferred.resolve(defaultValue)
      });
    } else {
      deferred.resolve(defaultValue);
    }
    return deferred.promise;
  },

  getDescription: method(function() {
    let window = Services.appShell.hiddenDOMWindow;
    let utils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);

    let res = {};

    res.dpi = utils.displayDPI;
    res.width = window.screen.width;
    res.height = window.screen.height;
    res.channel = "undefined";
    // app.update.channel is not alway available
    try {
      res.channel = Services.prefs.getCharPref('app.update.channel');
    } catch(e) {}
    res.buildID = Services.appinfo.platformBuildID;
    res.geckoVersion = Services.appinfo.platformVersion;
    res.name = Services.appinfo.name;

    return this._getSetting("deviceinfo.os", Services.appinfo.version)
    .then(v => res.version = v)
    .then(() => this._getSetting("deviceinfo.hardware"))
    .then(v => {res.hardware = v; return res});

  }, {request: {},response: { value: RetVal("json")}}),

  screenshotToDataURL: method(function() {
    console.log("screenshotToDataURL");
    let window = Services.wm.getMostRecentWindow("navigator:browser");
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
  }, {request: {},response: { value: RetVal("json")}}),

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

