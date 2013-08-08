/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu} = require("chrome");
const protocol = require("devtools/server/protocol");
const {Arg, method, RetVal} = protocol;
const promise = require("sdk/core/promise");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://gre/modules/devtools/dbg-server.jsm');

exports.register = function(handle) {
  handle.addGlobalActor(MozSettingsActor, "mozSettingsActor");
};

exports.unregister = function(handle) {
};

let MozSettingsActor = protocol.ActorClass({
  typeName: "mozSettings",

  get mozSettings() {
    let win = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);
    return win.navigator.mozSettings;
  },

  getSettings: method(function(name) {
    let deferred = promise.defer();
    let lock = this.mozSettings.createLock();
    let request = lock.get(name);
    request.onsuccess = function(e) {
      deferred.resolve(request.result);
    };
    return deferred.promise;
  }, {request: {
    name: Arg(0, "string")
  }, response: { value: RetVal("json")}}),

  setSetting: method(function(name, value) {
    let win = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);
    let lock = this.mozSettings.createLock();
    let set = {};
    set[name] = value;
    lock.set(set);
  }, {request: {
    name: Arg(0, "string"),
    value: Arg(1, "string")
  },response: {}}),

});

let MozSettingsFront = protocol.FrontClass(MozSettingsActor, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.mozSettingsActor;
    client.addActorPool(this);
    this.manage(this);
  },
});

const _knownMozSettingsFronts = new WeakMap();

exports.getMozSettingsFront = function(client, form) {
  if (_knownMozSettingsFronts.has(client))
    return _knownMozSettingsFronts.get(client);

  let front = new MozSettingsFront(client, form);
  _knownMozSettingsFronts.set(client, front);
  return front;
}
