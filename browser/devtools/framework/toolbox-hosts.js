/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cu} = require("chrome");

let promise = require("sdk/core/promise");
let EventEmitter = require("devtools/shared/event-emitter");

Cu.import("resource://gre/modules/Services.jsm");

/**
 * A toolbox host represents an object that contains a toolbox (e.g. the
 * sidebar or a separate window). Any host object should implement the
 * following functions:
 *
 * create() - create the UI and emit a 'ready' event when the UI is ready to use
 * destroy() - destroy the host's UI
 */

exports.Hosts = {
  "bottom": BottomHost,
  "side": SidebarHost,
  "window": WindowHost,
  "tab": TabHost
}

/**
 * Host object for the dock on the bottom of the browser
 */
function BottomHost(hostTab) {
  this.hostTab = hostTab;

  EventEmitter.decorate(this);
}

BottomHost.prototype = {
  type: "bottom",

  heightPref: "devtools.toolbox.footer.height",

  /**
   * Create a box at the bottom of the host tab.
   */
  create: function BH_create() {
    let deferred = promise.defer();

    let gBrowser = this.hostTab.ownerDocument.defaultView.gBrowser;
    let ownerDocument = gBrowser.ownerDocument;

    this._splitter = ownerDocument.createElement("splitter");
    this._splitter.setAttribute("class", "devtools-horizontal-splitter");

    this.frame = ownerDocument.createElement("iframe");
    this.frame.className = "devtools-toolbox-bottom-iframe";
    this.frame.height = Services.prefs.getIntPref(this.heightPref);

    this._nbox = gBrowser.getNotificationBox(this.hostTab.linkedBrowser);
    this._nbox.appendChild(this._splitter);
    this._nbox.appendChild(this.frame);

    let frameLoad = function() {
      this.frame.removeEventListener("DOMContentLoaded", frameLoad, true);
      this.emit("ready", this.frame);

      deferred.resolve(this.frame);
    }.bind(this);

    this.frame.tooltip = "aHTMLTooltip";
    this.frame.addEventListener("DOMContentLoaded", frameLoad, true);

    // we have to load something so we can switch documents if we have to
    this.frame.setAttribute("src", "about:blank");

    focusTab(this.hostTab);

    return deferred.promise;
  },

  /**
   * Raise the host.
   */
  raise: function BH_raise() {
    focusTab(this.hostTab);
  },

  /**
   * Set the toolbox title.
   */
  setTitle: function BH_setTitle(title) {
    // Nothing to do for this host type.
  },

  /**
   * Destroy the bottom dock.
   */
  destroy: function BH_destroy() {
    if (!this._destroyed) {
      this._destroyed = true;

      Services.prefs.setIntPref(this.heightPref, this.frame.height);
      this._nbox.removeChild(this._splitter);
      this._nbox.removeChild(this.frame);
    }

    return promise.resolve(null);
  }
}


/**
 * Host object for the in-browser sidebar
 */
function SidebarHost(hostTab) {
  this.hostTab = hostTab;

  EventEmitter.decorate(this);
}

SidebarHost.prototype = {
  type: "side",

  widthPref: "devtools.toolbox.sidebar.width",

  /**
   * Create a box in the sidebar of the host tab.
   */
  create: function SH_create() {
    let deferred = promise.defer();

    let gBrowser = this.hostTab.ownerDocument.defaultView.gBrowser;
    let ownerDocument = gBrowser.ownerDocument;

    this._splitter = ownerDocument.createElement("splitter");
    this._splitter.setAttribute("class", "devtools-side-splitter");

    this.frame = ownerDocument.createElement("iframe");
    this.frame.className = "devtools-toolbox-side-iframe";
    this.frame.width = Services.prefs.getIntPref(this.widthPref);

    this._sidebar = gBrowser.getSidebarContainer(this.hostTab.linkedBrowser);
    this._sidebar.appendChild(this._splitter);
    this._sidebar.appendChild(this.frame);

    let frameLoad = function() {
      this.frame.removeEventListener("DOMContentLoaded", frameLoad, true);
      this.emit("ready", this.frame);

      deferred.resolve(this.frame);
    }.bind(this);

    this.frame.addEventListener("DOMContentLoaded", frameLoad, true);
    this.frame.tooltip = "aHTMLTooltip";
    this.frame.setAttribute("src", "about:blank");

    focusTab(this.hostTab);

    return deferred.promise;
  },

  /**
   * Raise the host.
   */
  raise: function SH_raise() {
    focusTab(this.hostTab);
  },

  /**
   * Set the toolbox title.
   */
  setTitle: function SH_setTitle(title) {
    // Nothing to do for this host type.
  },

  /**
   * Destroy the sidebar.
   */
  destroy: function SH_destroy() {
    if (!this._destroyed) {
      this._destroyed = true;

      Services.prefs.setIntPref(this.widthPref, this.frame.width);
      this._sidebar.removeChild(this._splitter);
      this._sidebar.removeChild(this.frame);
    }

    return promise.resolve(null);
  }
}

/**
 * Host object for the toolbox in a separate window
 */
function WindowHost() {
  this._boundUnload = this._boundUnload.bind(this);

  EventEmitter.decorate(this);
}

WindowHost.prototype = {
  type: "window",

  WINDOW_URL: "chrome://browser/content/devtools/framework/toolbox-window.xul",

  /**
   * Create a new xul window to contain the toolbox.
   */
  create: function WH_create() {
    let deferred = promise.defer();

    let flags = "chrome,centerscreen,resizable,dialog=no";
    let win = Services.ww.openWindow(null, this.WINDOW_URL, "_blank",
                                     flags, null);

    let frameLoad = function(event) {
      win.removeEventListener("load", frameLoad, true);
      this.frame = win.document.getElementById("toolbox-iframe");
      this.emit("ready", this.frame);

      deferred.resolve(this.frame);
    }.bind(this);

    win.addEventListener("load", frameLoad, true);
    win.addEventListener("unload", this._boundUnload);

    win.focus();

    this._window = win;

    return deferred.promise;
  },

  /**
   * Catch the user closing the window.
   */
  _boundUnload: function(event) {
    if (event.target.location != this.WINDOW_URL) {
      return;
    }
    this._window.removeEventListener("unload", this._boundUnload);

    this.emit("window-closed");
  },

  /**
   * Raise the host.
   */
  raise: function RH_raise() {
    this._window.focus();
  },

  /**
   * Set the toolbox title.
   */
  setTitle: function WH_setTitle(title) {
    this._window.document.title = title;
  },

  /**
   * Destroy the window.
   */
  destroy: function WH_destroy() {
    if (!this._destroyed) {
      this._destroyed = true;

      this._window.removeEventListener("unload", this._boundUnload);
      this._window.close();
    }

    return promise.resolve(null);
  }
}

/**
 * Host object for the toolbox in its own tab
 */
function TabHost(hostTab, cid) {
  this.cid = cid;
  EventEmitter.decorate(this);
}


TabHost.prototype = {
  type: "tab",

  WINDOW_URL: "chrome://browser/content/devtools/framework/toolbox-window.xul",

  /**
   * Create a new xul window to contain the toolbox.
   */
  create: function WH_create() {
    let deferred = promise.defer();

    let args = "";
    if (Number.isInteger(this.cid)) {
      args = "#cid=" + this.cid;
    }

    let gBrowser = Services.wm.getMostRecentWindow("navigator:browser").gBrowser;
    this.tab = gBrowser.selectedTab = gBrowser.addTab(this.WINDOW_URL + args);
    let browser = this.tab.linkedBrowser;

    let onLoad = function() {
      browser.removeEventListener("load", onLoad, true);
      this.frame = browser.contentWindow.document.getElementById("toolbox-iframe");
      this.emit("ready", this.frame);
      deferred.resolve(this.frame);
    }.bind(this);

    browser.addEventListener("load", onLoad, this);

    return deferred.promise;
  },

  /**
   * Raise the host.
   */
  raise: function RH_raise() {
    let gBrowser = this.tab.ownerDocument.defaultView.gBrowser
    gBrowser.selectedTab = this.tab;
  },

  /**
   * Set the toolbox title.
   */
  setTitle: function WH_setTitle(title) {
    this.tab.contentWindow.title = title;
  },

  /**
   * Destroy the window.
   */
  destroy: function WH_destroy() {
    if (!this._destroyed) {
      this._destroyed = true;

      let gBrowser = this.tab.ownerDocument.defaultView.gBrowser
      gBrowser.removeTab(this.tab);
    }

    return promise.resolve(null);
  }
}

/**
 *  Switch to the given tab in a browser and focus the browser window
 */
function focusTab(tab) {
  let browserWindow = tab.ownerDocument.defaultView;
  browserWindow.focus();
  browserWindow.gBrowser.selectedTab = tab;
}
