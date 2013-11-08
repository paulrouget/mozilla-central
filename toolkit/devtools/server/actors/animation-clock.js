/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const {Ci, Cu,} = require("chrome");
const protocol = require("devtools/server/protocol");
const {Arg, Option, method, RetVal, types} = protocol;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://gre/modules/devtools/dbg-server.jsm');

exports.register = function(handle) {
  handle.addTabActor(AnimationClock, "animationclock");
};

exports.unregister = function(handle) {
  handle.removeTabActor(AnimationClock);
};

const MIN_TICK_DELAY = 1000 / 60; // 60 FPS
const DEFAULT_SPEED_FACTOR = 4;

let AnimationClock = protocol.ActorClass({
  typeName: "animationclock",

  _tickDelay: MIN_TICK_DELAY,
  _speedFactor: DEFAULT_SPEED_FACTOR,

  initialize: function(conn, tabActor, options) {
    this._onNotControlledWindowTick = this._onNotControlledWindowTick.bind(this);

    protocol.Actor.prototype.initialize.call(this, conn);
    this.wUtils = tabActor.window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);

    this.notControlledWindow = Services.wm.getMostRecentWindow(DebuggerServer.chromeWindowType);

    /*
    this.progressListener = ProgressListener(tabActor);
    events.on(this.progressListener, "windowchange-start", this.onFrameUnload);
    events.on(this.progressListener, "windowchange-stop", this.onFrameLoad);
    */
  },

  destroy: function() {
    this.stopControl();
    protocol.Actor.prototype.destroy.call(this);
  },

  _syncClocks: false,
  _lastTimestamp: null,
  _onNotControlledWindowTick: function(timestamp) {
    if (this._lastTimestamp == null) {
      this._lastTimestamp = timestamp;
    } else {
      let delta = timestamp - this._lastTimestamp;
      this._lastTimestamp = timestamp;
      this.wUtils.advanceTimeAndRefresh(delta * this._syncFactor);
    }
    if (this._syncClocks) {
      this.notControlledWindow.requestAnimationFrame(this._onNotControlledWindowTick);
    } else {
      this._lastTimestamp = null;
    }
  },

  _sync: function(factor) {
    this._syncFactor = factor;
    if (!this._syncClocks) {
      this._syncClocks = true;
      this.notControlledWindow.requestAnimationFrame(this._onNotControlledWindowTick);
    }
  },

  _stopSyncing: function() {
    this._syncClocks = false;
  },

  startControl: method(function() {
    this.wUtils.advanceTimeAndRefresh(0);
  }),

  stopControl: method(function() {
    this._stopSyncing();
    this.wUtils.restoreNormalRefresh();
  }),

  setTickDelay: method(function(delay) {
    let delay = parseFloat(delay);
    this._tickDelay = Math.max(MIN_TICK_DELAY, delay);
  }, { request: { value: Arg(0) }, response: {} }),

  setSpeedFactor: method(function(speedFactor) {
    this._speedFactor = parseFloat(speedFactor);
  }, { request: { value: Arg(0) }, response: {} }),

  getTickDelay: method(function() {
    return this._tickDelay;
  }, {request: {},response: { value: RetVal("number")}}),

  getSpeedFactor: method(function() {
    return this._speedFactor;
  }, {request: {},response: { value: RetVal("number")}}),

  tickForward: method(function() {
    this.wUtils.advanceTimeAndRefresh(this._tickDelay);
  }),

  tickBackward: method(function() {
    this.wUtils.advanceTimeAndRefresh(-this._tickDelay);
  }),

  pause: method(function() {
    this._stopSyncing();
  }),

  playForward: method(function() {
    this._sync(1);
  }),

  playBackward: method(function() {
    this._sync(-1);
  }),

  playForwardFast: method(function() {
    this._sync(this._speedFactor);
  }),

  playBackwardFast: method(function() {
    this._sync(-this._speedFactor);
  }),

  playForwardSlow: method(function() {
    this._sync(1 / this._speedFactor);
  }),

  playBackwardSlow: method(function() {
    this._sync(-1 / this._speedFactor);
  }),
});

exports.AnimationClockFront = protocol.FrontClass(AnimationClock, {
  initialize: function(client, form) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = form.animationclock;
    client.addActorPool(this);
    this.manage(this);
  },
});
