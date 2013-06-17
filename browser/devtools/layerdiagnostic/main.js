/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

gDevTools.on("toolbox-ready", (event, toolbox) => {
  let promise;
  if (toolbox.target.isRemote) {
    promise = Promise.resolve(toolbox.target);
  } else {
    promise = toolbox.target.makeRemote();
  }

  promise.then(() => {
    let front = devtools.require("devtools/server/actors/paintflashing");
    let client = front.PaintFlashingFront(toolbox.target.client, toolbox.target.form);

    let toolbarbutton = toolbox.doc.createElement("toolbarbutton");
    toolbarbutton.id = "command-button-layerdiag";
    toolbarbutton.className = "command-button";
    toolbarbutton.setAttribute("type", "menu-button");

    let menupopup = toolbox.doc.createElement("menupopup");

    let item1 = toolbox.doc.createElement("menuitem");
    item1.setAttribute("label", "Paint");
    item1.setAttribute("type", "checkbox");
    item1.setAttribute("autocheck", "false");
    item1.setAttribute("checked", "false");

    let item2 = toolbox.doc.createElement("menuitem");
    item2.setAttribute("label", "Layers");
    item2.setAttribute("type", "checkbox");
    item2.setAttribute("autocheck", "false");
    item2.setAttribute("checked", "false");

    let item3 = toolbox.doc.createElement("menuitem");
    item3.setAttribute("label", "Grid");
    item3.setAttribute("type", "checkbox");
    item3.setAttribute("autocheck", "false");
    item3.setAttribute("checked", "false");

    menupopup.appendChild(item1);
    menupopup.appendChild(item2);
    menupopup.appendChild(item3);

    toolbarbutton.appendChild(menupopup);

    let container = toolbox.doc.querySelector("#toolbox-buttons");
    container.appendChild(toolbarbutton);

    /* ------------------ */

    function updateUI(state) {
      for (let [m,s] of [
            [toolbarbutton, state.global],
            [menuitem1,     state.paintFlashing],
            [menuitem2,     state.layersFlashing],
            [menuitem3,     state.gridFlashing]]) {
        s ?  m.setAttribute("checked", "true") : m.removeAttribute("checked");
      }
    }

    function update(aEvent) {
      let target = aEvent.target;
      let tagName = target.tagName;
      if (tagName != aEvent.currentTarget.tagName) {
        return;
      }

      switch (tagName) {
        case "toolbarbutton": {
          let originalTarget = aEvent.originalTarget;
          let classes = originalTarget.classList;

          if (originalTarget.localName !== "toolbarbutton") {
            // Oddly enough, the click event is sent to the menu button when
            // selecting a menu item with the mouse. Detect this case and bail
            // out.
            break;
          }

          if (!classes.contains("toolbarbutton-menubutton-button") &&
              originalTarget.getAttribute("type") === "menu-button") {
            // This is a filter button with a drop-down. The user clicked the
            // drop-down, so do nothing. (The menu will automatically appear
            // without our intervention.)
            break;
          }

          let newState = !target.hasAttribute("checked");
          if (newState) {
            target.setAttribute("checked", "true");
          } else {
            target.removeAttribute("checked");
          }
          break;
        }
        case "menuitem": {
          let newState = !target.hasAttribute("checked");
          if (newState) {
            target.setAttribute("checked", "true");
          } else {
            target.removeAttribute("checked");
          }
          break;
        }
      }
    }

    toolbarbutton.addEventListener("click", update, true);
    item1.addEventListener("click", update, true);
    item2.addEventListener("click", update, true);
    item3.addEventListener("click", update, true);
  })
});
