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
    res.channel = Services.prefs.getCharPref('app.update.channel');
    res.buildID = Services.appinfo.platformBuildID;
    res.geckoVersion = Services.appinfo.platformVersion;
    res.name = Services.appinfo.name;

    try {
      let radioInterfaceLayer = Cc["@mozilla.org/ril;1"].getService(Ci.nsIRadioInterfaceLayer);
      res.phoneNumber = radioInterfaceLayer.getMsisdn() || "unknown";
    } catch(e) {}

    let deferred = promise.defer();

    this._getSetting("deviceinfo.os", Services.appinfo.version)
      .then((v) => res.version = v)
      .then(() => this._getSetting("deviceinfo.hardware"))
      .then((v) => {res.hardware = v; deferred.resolve(res)});

    return deferred.promise;

  }, {request: {},response: { value: RetVal("json")}}),

  screenshot: method(function() {
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

exports.DeviceFront = protocol.FrontClass(DeviceActor, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.deviceActor;
    client.addActorPool(this);
    this.manage(this);
  }
});
