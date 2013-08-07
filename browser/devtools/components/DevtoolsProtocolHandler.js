/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const SCHEME = "devtools";
const URLS = {
  "devtools:app-manager": "chrome://browser/content/devtools/app-manager/app-manager.xhtml",
  "devtools:device-inspector": "chrome://browser/content/devtools/app-manager/device-inspector.xhtml",
}

function DevtoolsProtocolHandler() {}

DevtoolsProtocolHandler.prototype = {
  scheme: SCHEME,
  defaultPort: -1,
  protocolFlags: Ci.nsIProtocolHandler.URI_IS_UI_RESOURCE |
                 Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE,

  newURI: function PPH_newURI(aSpec, aOriginCharset, aBaseUri) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },

  newChannel: function PPH_newChannel(aUri) {
    let spec = aUri.spec;
    if (spec in URLS) {
      let chan = NetUtil.newChannel(URLS[spec]);
      chan.originalURI = aUri;
      return chan;
    }
    throw Cr.NS_ERROR_ILLEGAL_VALUE;
  },

  allowPort: function PPH_allowPort(aPort, aScheme) {
    return false;
  },

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIProtocolHandler
  ]),

  classID: Components.ID("{50382038-ff68-11e2-a867-0050b60bc0ff}")
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([DevtoolsProtocolHandler]);

