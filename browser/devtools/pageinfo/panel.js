/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci, Cu, Cr } = require("chrome");
const promise = require("sdk/core/promise");
const EventEmitter = require("devtools/shared/event-emitter");
const { PageInfoFront } = require("devtools/server/actors/pageinfo");

function PageInfoPanel(iframeWindow, toolbox) {
  this.panelWin = iframeWindow;
  this._toolbox = toolbox;
  this._destroyer = null;

  EventEmitter.decorate(this);
};

exports.PageInfoPanel = PageInfoPanel;

PageInfoPanel.prototype = {
  open: function() {
    let targetPromise;

    // Local debugging needs to make the target remote.
    if (!this.target.isRemote) {
      targetPromise = this.target.makeRemote();
    } else {
      targetPromise = promise.resolve(this.target);
    }

    return targetPromise
      .then(() => {
        this.panelWin.gToolbox = this._toolbox;
        this.panelWin.gTarget = this.target;
        this.panelWin.gFront = new PageInfoFront(this.target.client, this.target.form);
      })
      .then(() => {
        this.isReady = true;
        dump("ok:ready");
        this.emit("ready");
        return this;
      })
      .then(null, function onError(aReason) {
        Cu.reportError("PageInfoPanel open failed. " +
                       aReason.error + ": " + aReason.message);
      });
  },

  // DevToolPanel API

  get target() this._toolbox.target,

  destroy: function() {
    if (!this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.emit("destroyed");
  }
};
