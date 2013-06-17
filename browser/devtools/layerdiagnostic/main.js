/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

gDevTools.on("toolbox-ready", (event, toolbox) => {
  let container = toolbox.doc.querySelector("#toolbox-buttons");
  let toolbarbutton = toolbox.doc.createElement("toolbarbutton");
  toolbarbutton.id = "command-button-layerdiag";
  toolbarbutton.className = "command-button";
  container.appendChild(toolbarbutton);

  let promise;
  if (toolbox.target.isRemote) {
    promise = Promise.resolve(toolbox.target);
  } else {
    promise = toolbox.target.makeRemote();
  }

  promise.then(() => {
    let front = devtools.require("devtools/server/actors/paintflashing");
    let client = front.PaintFlashingFront(toolbox.target.client, toolbox.target.form);

    let setButtonState = value => {
      if (value) {
        toolbarbutton.setAttribute("checked", "true");
      } else {
        toolbarbutton.removeAttribute("checked");
      }
    }

    client.getPaintFlashing().then(currentValue => {
      setButtonState(currentValue);
    });

    toolbarbutton.addEventListener("click", () => {
      client.getPaintFlashing().then(currentValue => {
        client.setPaintFlashing(!currentValue).then(() => {
          setButtonState(!currentValue);
        });
      });
    }, false);
  })
});
