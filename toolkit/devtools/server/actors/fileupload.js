/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;
let CC = Components.Constructor;

/**
 * Creates a FileUploadActor. This actor allows to upload a file
 * from the client to the server.
 */
function FileUploadActor(aConnection) {
  Cu.import("resource://gre/modules/FileUtils.jsm");

  this._uploads = [];
  this.conn = aConnection;
  this._actorPool = new ActorPool(this.conn);
  this.conn.addActorPool(this._actorPool);
}

FileUploadActor.prototype = {
  actorPrefix: "fileUpload",

  /**
   * First method to call in order to create a temporary file
   * An optional `name` argument can be given in order
   * to have a precise file name.
   */
  upload: function (aRequest) {
    let name = aRequest.name || "tmp-file";
    let size = aRequest.size;

    // Create a common temporary folder for all actor instances
    let tmpDir = FileUtils.getDir("TmpD", ["file-upload"], true, false);
    if (!tmpDir.exists() || !tmpDir.isDirectory()) {
      return {error: "fileAccessError",
              message: "Unable to create temporary folder"};
    }

    // Create a unique temporary file for this particular upload
    let tmpFile = tmpDir;
    tmpFile.append(name);
    tmpFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0666", 8));
    if (!tmpFile.exists() || !tmpDir.isFile()) {
      return {error: "fileAccessError",
              message: "Unable to create temporary file"};
    }

    let actor = new UploadActor(tmpFile);
    this._actorPool.addActor(actor);
    this._uploads.push(actor);

    return { actor: actor.actorID };
  },

  disconnect: function () {
    // When we stop using this actor, we should ensure removing all files.
    for (let upload of this._uploads) {
      upload.remove();
    }
    this._uploads = null;

    this.conn.removeActorPool(this._actorPool);
    this._actorPool = null;
    this.conn = null;
  }
};

FileUploadActor.prototype.requestTypes = {
  "upload": FileUploadActor.prototype.upload,
};

function UploadActor(aFile) {
  this._file = aFile;
  this.size = 0;
  this._ostream = FileUtils.openSafeFileOutputStream(aFile);
}

UploadActor.prototype = {
  actorPrefix: "uploadActor",

  /**
   * This method isn't exposed to the client.
   * It is meant to be called by server code, in order to get
   * access to the temporary file out of the actor ID.
   */
  getFile: function () {
    return this._file.clone();
  },

  /**
   * This method allows you to upload a piece of file.
   * It expects a chunk argument that is the a string to write to the file.
   */
  chunk: function (aRequest) {
    let chunk = aRequest.chunk;
    if (!chunk || chunk.length <= 0) {
      return {error: "parameterError",
              message: "Missing or invalid chunk argument"};
    }

    let written = this._ostream.write(chunk, chunk.length);
    this.size += written;

    return {
      written: written,
      size: this.size
    };
  },

  /**
   * This method needs to be called, when you are done uploading
   * chunks, before trying to access/use the temporary file.
   * Otherwise, the file may be partially written
   * and also be locked.
   */
  done: function (aRequest) {
    FileUtils.closeSafeFileOutputStream(this._ostream);

    return {};
  },

  /**
   * This method allows you to delete the temporary file,
   * when you are done using it.
   */
  remove: function (aRequest) {
    this._cleanupFile();

    return {};
  },

  _cleanupFile: function () {
    try {
      this._ostream.finish();
    } catch(e) {}
    if (this._file.exists()) {
      try {
        this._file.remove(false);
      } catch(e) {}
    }
  }
};

/**
 * The request types this actor can handle.
 */
UploadActor.prototype.requestTypes = {
  "chunk": UploadActor.prototype.chunk,
  "done": UploadActor.prototype.done,
  "remove": UploadActor.prototype.remove
};

DebuggerServer.addGlobalActor(FileUploadActor, "fileUploadActor");
