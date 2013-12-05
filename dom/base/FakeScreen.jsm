/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

this.EXPORTED_SYMBOLS = ["FakeScreenManager", "FakeScreenManagerClient"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "uuidgen",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");

const {Promise} = Cu.import("resource://gre/modules/Promise.jsm", {});

const ALLOWED_ORIENTATIONS = ["landscape-primary", "landscape-secondary", "portrait-primary",  "portrait-secondary"];

/********************
 *
 * Parent process:
 *
 *   FakeScreenManager: Singleton. Keep track of existing FakeScreenMaster.
 *
 *      Listen to:
 *
 *      > "FakeScreen:GetConfiguration" // Request a new fake screen
 *      > {
 *      >   id: XXX // a fake screen id,
 *      >   initialConfiguration: {configuration} // initial configuration if a new fake screen needs to be created.
 *      > }
 *
 *      Will send:
 *
 *      < "FakeScreen:ScreenConfiguration" // A new screen is available
 *      < @param: {
 *      <           id: XXX // the id of the managed fake screen
 *      <           configuration: {configuration} // the fake screen configuration
 *      <         }
 *
 *   FakeScreenMaster: Class. Holds info about a fake screen.
 *
 *     listen to:
 *
 *      > "FakeScreen:{UUID}:LockScreenOrientation" (sync) // lock screen
 *      > @param: <String> orientation ( landscape-primary, landscape-secondary, portrait-primary or portrait-secondary)
 *
 *      > "FakeScreen:{UUID}:UnlockScreenOrientation" (sync) // Unlock screen
 *
 *     Will send:
 *
 *      < "FakeScreen:{UUID}:Update" // Screen configuration has changed
 *      < @param: configuration // the new fake screen configuration
 *
 * Child process:
 *
 *    FakeScreenManagerClient: Singleton. Keep track of existing FakeScreenClient.
 *
 ********************/

XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");


const FakeScreenMasterMap = new Map();

this.FakeScreenManager = {
  _initialized: false,
  init: function() {
    if (this._initialized) {
      return;
    }
    ppmm.addMessageListener("FakeScreen:GetConfiguration", this);
    this._initialized = true;
  },

  receiveMessage: function(message) {
    let childMM = message.target.QueryInterface(Ci.nsIMessageSender);
    switch (message.name) {
      case "FakeScreen:GetConfiguration":
        let id = message.data.id;
        if (!FakeScreenMasterMap.has(id)) {
          let screen = new FakeScreenMaster(id, message.data.initialConfiguration);
          FakeScreenMasterMap.set(id, screen);
        }

        let screen = FakeScreen.get(id);
        screen.addChild(childMM);
        childMM.sendAsyncMessage("FakeScreen:GetConfiguration:Response", {
          id: id,
          configuration: screen.getConfiguration()
        });
        break;
    }
  },

}

function FakeScreenMaster(id, initialConfiguration) {
  this.id = id;
  this._messagePrefix = "FakeScreen:" + id + ":";
  let nativeConfiguration = GetNativeScreenConfiguration();
  this.updateConfiguration(initialConfiguration, nativeConfiguration);
  ppmm.addMessageListener("LockScreenOrientation", this);
  ppmm.addMessageListener("UnlockScreenOrientation", this);
}

FakeScreenMaster.prototype = {
  children: new Set(),
  getConfiguration: function() {
    return {
      width: this._width,
      height: this._height,
      mozOrientation: this._mozOrientation
    }
  },

  updateConfiguration: function(configuration, fallback) {
    for (let prop of ["width", "height", "mozOrientation"]) {
      if (prop in initialConfiguration) {
        this["_" + prop] = initialConfiguration[prop];
      } else {
        if (fallback) {
          this["_" + prop] = fallback[prop];
        }
      }
    }
  },

  toString: function() {
    let str = "SCREEN: " + this.id + "\n";
    str += "  Connected childs: " + this.children.size + "\n";
    str += "  Configuration: " + JSON.stringify(this.getConfiguration, null, 4) + "\n";
    return str;
  },

  addChild: function(child) {
    this.children.add(child);
  },

  receiveMessage: function(message) {
    switch (message.name) {
      case this._messagePrefix + "LockScreenOrientation":
        return this.lockScreenOrientation(message.data);
        break;
      case this._messagePrefix + "UnlockScreenOrientation":
        return this.unlockScreenOrientation();
        break;
    }
  },

  invalidateConfiguration: function() {
    let configuration = this.getConfiguration();
    for (let child of this.children) {
      child.sendAsyncMessage(this._messagePrefix + "Update", configuration);
    }
  },

  _orientationIsLocked: false,
  isOrientationLocked: function() {
    return this._orientationIsLocked;
  },

  changeOrientation: function(orientation) {
    switch (/[^-]+/.exec(orientation)) {
      "landscape":
        this._width = Math.max(this._height, this.width);
        this._height = Math.min(this._height, this.width);
        break;
      "portrait":
        this._width = Math.min(this._height, this.width);
        this._height = Math.max(this._height, this.width);
        break;
      "default":
        throw new Error("Unexpected value");
    }
    this._mozOrientation = orientation;
    this.invalidateConfiguration();
  },

  lockScreenOrientation: function(orientation) {
    if (!IsOrientationValueValid(orientation)) {
      return false;
    }

    if (this._mozOrientation != orientation) {
      this.changeOrientation(orientation);
    }

    this._orientationIsLocked = true;

    return true;
  },

  unlockScreenOrientation: function() {
    this._orientationIsLocked = false;
    return true;
  },

}

/********************
 *
 * Child process
 *
 ********************/

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
                                   "@mozilla.org/childprocessmessagemanager;1",
                                   "nsIMessageSender");


const FakeScreenClientMap = new Map();

this.FakeScreenManagerClient = {
  init: function() {
    cpmm.addMessageListener("FakeScreen:ScreenConfiguration", this);
  },

  receiveMessage: function(message) {
    let parentMM = message.target.QueryInterface(Ci.nsIMessageSender);
    switch (message.name) {
      case "FakeScreen:ScreenConfiguration":
        let id = message.data.id;
        let screen = new FakeScreenClient(id, message.data, parentMM);
        FakeScreenClientMap.set(id, screen);

        if (this._createRequests.has(id)) {
          let deferred = this._createRequests.get(id);
          this._createRequests.remove(id);
          deferred.resolve(screen);
        } else {
          Cu.reportError(new Error("Got a screen configuration for an unknow request"));
        }
        break;
    }
  },

  _createRequests: new Map(),
  createFakeScreenForDocShell: function(docShell) {
    let deferred = Promise.defer();
    let id = docShell.fakeScreenID;

    if (id < 0) {
      return deferred.reject("Docshell screen is not a fake screen (fakeScreenID < 0)");
    }

    if (FakeScreenClientMap.has(id)) {
      return deferred.reject("Fake screen already created");
    }

    if (this._createRequests.has(id)) {
      let deferred = this._createRequests.get(id);
      return deferred.promise;
    }

    this._createRequests.set(id, deferred);
    ppmm.sendAsyncMessage("FakeScreen:GetFakeScreenConfiguration", {id:id})

    return deferred.promise;
  },

  getFakeScreenForDocShell: function(docShell) {
    let id = docShell.fakeScreenID;

    if (id < 0) {
      throw new Error("Docshell screen is not a fake screen (fakeScreenID < 0)");
    }

    return FakeScreenClientMap.get(id);
  },
}

function FakeScreenClient(id, configuration, parentMM) {
  this.id = id;
  this.parentMM = parentMM;
  this._messagePrefix = "FakeScreen:" + id + ":";
  this._configuration = configuration;
  cpmm.addMessageListener(this._messagePrefix + "Update", this);
}

FakeScreenClient.prototype = { // Used by nsScreen.cpp
  getPixelDepth: function() {
    return this._configuration.pixelDepth;
  },

  getWidth: function() {
    return this._configuration.width;
  },

  getHeight: function() {
    return this._configuration.height;
  },

  lockScreenOrientation: function(orientation) {
    return this.parentMM.sendSyncMessage(this._messagePrefix + "LockScreenOrientation", orientation);
  },

  unlockScreenOrientation: function() {
    return this.parentMM.sendSyncMessage(this._messagePrefix + "UnlockScreenOrientation");
  },

  updateConfiguration: function(newConfiguration) {
    let oldOrientation = this._configuration.mozOrientation;

    let requireMediaQueriesRefresh = false;
    let requireOrientationNotification = false;

    for (let prop of ["width", "height", "mozOrientation"]) {
      if (prop in newConfiguration) {
        let val = newConfiguration[prop];
        if (val != this._configuration[prop]) {
          this._configuration[prop] = val;
          requireMediaQueriesRefresh = true;
          if (prop == "mozOrientation") {
            requireOrientationNotification = true;
          }
        }
      }
    }

    if (requireOrientationNotification) {
      // FIXME: Call presContext::MediaFeatureValuesChanged()
    }

    if (this._configuration.mozOrientation != oldOrientation) {
      // FIXME: notify nsScreen
    }
  },

  receiveMessage: function(message) {
    switch (message.name) {
      case this._messagePrefix + "Update":
        this.updateConfiguration(message.data);
        break;
    }
  }
}

/* HELPER */


function GetNativeScreenConfiguration() {
  let nativeScreen = Cc["@mozilla.org/gfx/screenmanager;1"].getService(Ci.nsIScreenManager).primaryScreen;

  let nativeConfiguration = {
    width: {},
    height: {},
  };

  nativeScreen.GetRect({}, {}, nativeConfiguration.width, nativeConfiguration.height);

  for (let k in nativeConfiguration) {
    nativeConfiguration[k] = nativeConfiguration[k].value;
  }

  nativeConfiguration.pixelDepth = nativeScreen.pixelDepth;
  nativeConfiguration.colorDepth = nativeScreen.colorDepth;

  nativeConfiguration.mozOrientation = GuessMozOrientation(nativeConfiguration);

  return nativeConfiguration;
}

function GuessMozOrientation(configuration) {
  if (configuration.width > configuration.height) {
    return "landscape-primary";
  }
  return "portrait-primary";
}

function IsOrientationValueValid(orientation) {
  return ALLOWED_ORIENTATIONS.indexOf(orientation) > -1;
}
