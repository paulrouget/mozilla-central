/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");

let UI = {
  setupDevice: function() {
    document.body.setAttribute("show", "device-page");
  },

  setupSimulator: function() {
    document.body.setAttribute("show", "simulator-page");
  },

  skip: function() {
    let dontask = document.querySelector("#dontask").checked;
    Services.prefs.setBoolPref("devtools.appmanager.showFirstrun", !dontask);
    window.location = "chrome://browser/content/devtools/app-manager/index.xul";
  },
}
