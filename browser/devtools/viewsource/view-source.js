/* vim:set ts=2 sw=2 sts=2 et:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

const require   = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
const promise   = require("sdk/core/promise");
const Editor    = require("devtools/sourceeditor/editor");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

const SCHEME = "view-source";

/**
 * The scratchpad object handles the Scratchpad window functionality.
 */
let ViewSource = {
  init: function() {
    ViewSource.href = document.location.href.substr(SCHEME.length + 1); // remove "SCHEME:"

    console.log("fetching " + ViewSource.href);
    let channel = Services.io.newChannel(ViewSource.href, null, null);
    let chunks = [];
    let channelCharset = "";
    let streamListener = { // nsIStreamListener inherits nsIRequestObserver
      onStartRequest: (aRequest, aContext, aStatusCode) => {
        if (!Components.isSuccessCode(aStatusCode)) {
          ViewSource._onSourceLoad(LOAD_ERROR);
        }
      },
      onDataAvailable: (aRequest, aContext, aStream, aOffset, aCount) => {
        let channel = aRequest.QueryInterface(Ci.nsIChannel);
        if (!channelCharset) {
          channelCharset = channel.contentCharset;
        }
        chunks.push(NetUtil.readInputStreamToString(aStream, aCount));
      },
      onStopRequest: (aRequest, aContext, aStatusCode) => {
        if (!Components.isSuccessCode(aStatusCode)) {
          ViewSource._onSourceLoad(LOAD_ERROR);
          return;
        }
        let source = chunks.join("");
        ViewSource._onSourceLoad(null, source, channelCharset);
      }
    };

    channel.loadGroup = window.QueryInterface(Ci.nsIInterfaceRequestor)
                              .getInterface(Ci.nsIWebNavigation)
                              .QueryInterface(Ci.nsIDocumentLoader)
                              .loadGroup;
    channel.loadFlags = channel.LOAD_FROM_CACHE;
    channel.asyncOpen(streamListener, null);
  },

  _sourceReady: false,
  _onSourceLoad: function(error, source, channelCharset) {
    ViewSource._sourceLoadResult = {
      error: error,
      source: source,
      channelCharset: channelCharset
    }
    ViewSource._sourceReady = true;
    if (ViewSource._editorReady) {
      ViewSource.showSource();
    }
  },

  _editorReady: false,
  onLoad: function() {
    ViewSource.editor = new Editor({
      mode: Editor.modes.html,
      readOnly: true,
      value: "Fetching " + ViewSource.href,
      lineNumbers: true,
    });

    ViewSource.editor.appendTo(document.querySelector("#view-source-editor"))
    .then(() => {
      ViewSource.editor.focus();
      ViewSource._editorReady = true;
      if (ViewSource._sourceReady) {
        ViewSource.showSource();
      }
    }).then(null, (err) => console.log(err.message));
  },

  showSource: function() {
    ViewSource.editor.setText(this._sourceLoadResult.source);
  },

};

ViewSource.init();

function goToLine(line) {
  ViewSource.editor.setCursor({line: line, ch: 0}, "center");
}
