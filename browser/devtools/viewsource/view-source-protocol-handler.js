/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

const SCHEME = "view-source";

const VIEWER_URL = "chrome://browser/content/devtools/view-source.xul";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function DevtoolsViewSource() {
}

DevtoolsViewSource.prototype = {
  classID: Components.ID("{57bf62a0-3f92-49ff-9e89-4769e347c446}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler]),

  scheme: SCHEME,
  protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE |
                 Ci.nsIProtocolHandler.URI_NOAUTH |
                 Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,

  newURI: function(aSpec, aOriginCharset, aBaseURI) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },

  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let uri = ios.newURI(VIEWER_URL, null, null);
    let channel = ios.newChannelFromURI(uri, null);
    return channel;
  },
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([DevtoolsViewSource]);
