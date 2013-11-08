/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const {setTimeout} = require("sdk/timers")

const TIMEOUT = 300;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

gDevTools.on("toolbox-ready", (event, toolbox) => {
  let target = toolbox.target;

  if (!("animationclock" in target.form)) {
    // not supported
    return;
  }

  let topWindow = toolbox.frame.ownerDocument.defaultView;

  let {AnimationClockFront} = devtools.require("devtools/server/actors/animation-clock");
  let front = new AnimationClockFront(target.client, target.form);

  let l10n = Services.strings.createBundle("chrome://browser/locale/devtools/toolbox.properties");
  let PlatformKeys = Services.strings.createBundle("chrome://global-platform/locale/platformKeys.properties");

  let button = toolbox.doc.createElement("toolbarbutton");
  button.id = "toolbox-button-animclock";
  button.className = "command-button";
  let alt = PlatformKeys.GetStringFromName("VK_ALT");
  let shift = PlatformKeys.GetStringFromName("VK_SHIFT");
  button.setAttribute("tooltiptext", l10n.formatStringFromName("animclock.tooltip", [alt, shift], 1));

  let container = toolbox.doc.querySelector("#toolbox-buttons");
  container.appendChild(button);

  function onclick() {
    if (button.getAttribute("checked") != "true") {
      button.setAttribute("motion", "pause");
      front.startControl().then(() => {
        attachKeys();
        button.setAttribute("checked", "true");
      }, console.error);
    } else {
      detachKeys();
      button.removeAttribute("motion");
      front.stopControl();
      button.removeAttribute("checked", "true");
    }
  }

  target.once("close", () => {
    detachKeys();
    front.stopControl();
  });

  button.addEventListener("command", onclick);

  function attachKeys() {
    topWindow.addEventListener("keyup", onKeyUp);
    topWindow.addEventListener("keydown", onKeyDown);
  }

  function detachKeys() {
    topWindow.removeEventListener("keyup", onKeyUp);
    topWindow.removeEventListener("keydown", onKeyDown);
  }

  let keyBackCode = Ci.nsIDOMKeyEvent["DOM_" + l10n.GetStringFromName("animclock.backwardKeycode")];
  let keyForwardCode = Ci.nsIDOMKeyEvent["DOM_" + l10n.GetStringFromName("animclock.forwardKeycode")];

  let isKeyBackPressed = false;
  let isKeyForwardPressed = false;

  let isPlaying = false;

  function onKeyDown(e) {
    if (e.keyCode == keyBackCode) {
      e.stopPropagation();
      e.preventDefault();
      isKeyBackPressed = true;
      isKeyForwardPressed = false;
      setTimeout(function() {
        if (isKeyBackPressed) {
          isPlaying = true;
          if (e.altKey) {
            button.setAttribute("motion", "backward-slow");
            front.playBackwardSlow();
          } else if (e.shiftKey) {
            button.setAttribute("motion", "backward-fast");
            front.playBackwardFast();
          } else {
            button.setAttribute("motion", "backward");
            front.playBackward();
          }
        }
      }, TIMEOUT);
    }

    if (e.keyCode == keyForwardCode) {
      e.stopPropagation();
      e.preventDefault();
      isKeyForwardPressed = true;
      isKeyBackPressed = false;
      setTimeout(function() {
        if (isKeyForwardPressed) {
          isPlaying = true;
          if (e.altKey) {
            button.setAttribute("motion", "forward-slow");
            front.playForwardSlow();
          } else if (e.shiftKey) {
            button.setAttribute("motion", "forward-fast");
            front.playForwardFast();
          } else {
            button.setAttribute("motion", "forward");
            front.playForward();
          }
        }
      }, TIMEOUT);
    }
  }

  function onKeyUp(e) {
    if (e.keyCode == keyBackCode) {
      e.stopPropagation();
      e.preventDefault();
      isKeyBackPressed = false;
      if (isPlaying) {
        button.setAttribute("motion", "pause");
        front.pause();
        isPlaying = false;
      } else {
        front.tickBackward();
      }
    }

    if (e.keyCode == keyForwardCode) {
      e.stopPropagation();
      e.preventDefault();
      isKeyForwardPressed = false;
      if (isPlaying) {
        button.setAttribute("motion", "pause");
        front.pause();
        isPlaying = false;
      } else {
        front.tickForward();
      }
    }
  }
});

