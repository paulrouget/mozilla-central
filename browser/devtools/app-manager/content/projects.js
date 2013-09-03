/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;
Cu.import("resource:///modules/devtools/gDevTools.jsm");
const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;
const {ConnectionManager, Connection} = require("devtools/client/connection-manager");
const {AppProjects} = require("devtools/app-manager/app-projects");
const {AppValidator} = require("devtools/app-manager/app-validator");
const {Services} = Cu.import("resource://gre/modules/Services.jsm");
const {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm");
const promise = require("sdk/core/promise");

window.addEventListener("message", function(event) {
  try {
    let json = JSON.parse(event.data);
    if (json.name == "connection") {
      let cid = +json.cid;
      for (let c of ConnectionManager.connections) {
        if (c.uid == cid) {
          UI.connection = c;
          UI.onNewConnection();
          break;
        }
      }
    }
  } catch(e) {}
}, false);

let UI = {

  onload: function() {
    this.template = new Template(document.body, AppProjects.store, Utils.l10n);
    this.template.start();

    AppProjects.store.on("set", (event,path,value) => {
      if (path == "projects") {
        AppProjects.store.object.projects.forEach(UI.validate);
      }
    });
  },

  onNewConnection: function() {
    this.connection.on(Connection.Events.STATUS_CHANGED, () => this._onConnectionStatusChange());
    this._onConnectionStatusChange();
  },

  _onConnectionStatusChange: function() {
    if (this.connection.status != Connection.Status.CONNECTED) {
      document.body.classList.remove("connected");
      this.listTabsResponse = null;
    } else {
      document.body.classList.add("connected");
      this.connection.client.listTabs(
        response => {this.listTabsResponse = response}
      );
    }
  },

  _selectFolder: function() {
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window, "Select a webapp folder", Ci.nsIFilePicker.modeGetFolder);
    let res = fp.show();
    if (res != Ci.nsIFilePicker.returnCancel)
      return fp.file;
    return null;
  },

  addPackaged: function() {
    let folder = this._selectFolder();
    if (!folder)
      return;
    AppProjects.addPackaged(folder)
               .then(function (project) {
                 UI.validate(project);
                 UI.select(project.location);
               });
  },

  addHosted: function() {
    let urlInput = document.querySelector("#hosted-manifest-url");
    let manifestURL = urlInput.value;
    AppProjects.addHosted(manifestURL)
               .then(function (project) {
                 UI.validate(project);
               });
  },

  _getLocalIconURL: function(project, manifest) {
    let icon;
    if (manifest.icons) {
      let size = Object.keys(manifest.icons).sort(function(a, b) b - a)[0];
      if (size) {
        icon = manifest.icons[size];
      }
    }
    if (!icon)
      return null;
    if (project.type == "hosted") {
      let manifestURL = Services.io.newURI(project.location, null, null);
      let origin = Services.io.newURI(manifestURL.prePath, null, null);
      return Services.io.newURI(icon, null, origin).spec;
    } else if (project.type == "packaged") {
      let projectFolder = FileUtils.File(project.location);
      let folderURI = Services.io.newFileURI(projectFolder).spec;
      return folderURI + icon.replace(/^\/|\\/, "");
    }
  },

  validate: function(project) {
    let validation = new AppValidator(project);
    validation.validate()
              .then(function () {
                if (validation.manifest) {
                  project.name = validation.manifest.name;
                  project.icon = UI._getLocalIconURL(project, validation.manifest);
                  project.manifest = validation.manifest;
                  project.manifestAsString = JSON.stringify(validation.manifest);
                }

                project.validationStatus = "valid";

                if (validation.errors.length > 0) {
                  project.errorsCount = validation.errors.length;
                  project.errors = validation.errors.join(",\n ");
                  project.validationStatus = "error";
                } else {
                  project.errors = "";
                }

                if (validation.warnings.length > 0) {
                  project.warningsCount = validation.warnings.length;
                  project.warnings = validation.warnings.join(",\n ");
                  project.validationStatus = "warning";
                } else {
                  project.warnings = "";
                }
              });

  },

  update: function(location) {
    let project = AppProjects.get(location);
    this.validate(project);
  },

  remove: function(location) {
    AppProjects.remove(location);
  },

  _getProjectManifestURL: function (project) {
    if (project.type == "packaged") {
      return "app://" + project.packagedAppOrigin + "/manifest.webapp";
    } else if (project.type == "hosted") {
      return project.location;
    }
  },

  start: function(location) {
    let project = AppProjects.get(location);
    let request = {
      to: this.listTabsResponse.webappsActor,
      type: "launch",
      manifestURL: this._getProjectManifestURL(project)
    };
    this.connection.client.request(request, (res) => {

    });
  },

  stop: function(location) {
    let project = AppProjects.get(location);
    let request = {
      to: this.listTabsResponse.webappsActor,
      type: "close",
      manifestURL: this._getProjectManifestURL(project)
    };
    this.connection.client.request(request, (res) => {

    });
  },

  _getTargetForApp: function(manifest) { // FIXME <- already in device.js
    if (!this.listTabsResponse)
      return null;
    let actor = this.listTabsResponse.webappsActor;
    let deferred = promise.defer();
    let request = {
      to: actor,
      type: "getAppActor",
      manifestURL: manifest,
    }
    this.connection.client.request(request, (res) => {
      if (res.error) {
        deferred.reject(res.error);
      } else {
        let options = {
          form: res.actor,
          client: this.connection.client,
          chrome: false
        };

        devtools.TargetFactory.forRemoteTab(options).then((target) => {
          deferred.resolve(target)
        }, (error) => {
          deferred.reject(error);
        });
      }
    });
    return deferred.promise;
  },

  openToolbox: function(location) {
    let project = AppProjects.get(location);
    let manifest = this._getProjectManifestURL(project);
    this._getTargetForApp(manifest).then((target) => {
      gDevTools.showToolbox(target,
                            null,
                            devtools.Toolbox.HostType.WINDOW,
                            this.connection.uid);
    }, console.error);
  },


  install: function(button, location) {
    let project = AppProjects.get(location);
    if (project.type == "packaged") {
      this._installPackaged(button, project);
    } else {
      alert("todo: hosted app install");
    }
  },

  _addDirToZip: function (writer, dir, basePath) {
    const PR_USEC_PER_MSEC = 1000;
    let files = dir.directoryEntries;

    while (files.hasMoreElements()) {
      let file = files.getNext().QueryInterface(Ci.nsIFile);

      if (file.isHidden() ||
          file.isSymlink() ||
          file.isSpecial() ||
          file.equals(writer.file))
      {
        continue;
      }

      if (file.isDirectory()) {
        writer.addEntryDirectory(basePath + file.leafName + "/",
                                 file.lastModifiedTime * PR_USEC_PER_MSEC,
                                 true);
        this._addDirToZip(writer, file, basePath + file.leafName + "/");
      } else {
        writer.addEntryFile(basePath + file.leafName,
                            Ci.nsIZipWriter.COMPRESSION_DEFAULT,
                            file,
                            true);
      }
    }
  },

  /**
   * Convert an XPConnect result code to its name and message.
   * We have to extract them from an exception per bug 637307 comment 5.
   */
  _getResultTest: function(code) {
    let regexp =
      /^\[Exception... "(.*)"  nsresult: "0x[0-9a-fA-F]* \((.*)\)"  location: ".*"  data: .*\]$/;
    let ex = Cc["@mozilla.org/js/xpc/Exception;1"].
             createInstance(Ci.nsIXPCException);
    ex.initialize(null, code, null, null, null, null);
    let [, message, name] = regexp.exec(ex.toString());
    return { name: name, message: message };
  },

  _zipDirectory: function (zipFile, dirToArchive) {
    let deferred = promise.defer();
    let writer = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
    const PR_RDWR = 0x04;
    const PR_CREATE_FILE = 0x08;
    const PR_TRUNCATE = 0x20;
    writer.open(zipFile, PR_RDWR | PR_CREATE_FILE | PR_TRUNCATE);

    this._addDirToZip(writer, dirToArchive, "");

    writer.processQueue({
      onStartRequest: function onStartRequest(request, context) {},
      onStopRequest: (request, context, status) => {
        if (status == Cr.NS_OK) {
          writer.close();
          deferred.resolve();
        }
        else {
          let { name, message } = this._getResultText(status);
          deferred.reject(name + ": " + message);
        }
      }
    }, null);

    return deferred.promise;
  },

  _uploadPackage: function (packageFile) {
    let deferred = promise.defer();
    const CHUNK_SIZE = 10000;

    function newUpload(client, uploadActor) {
      let request = {
        to: uploadActor,
        type: "upload"
      };
      client.request(request, (res) => {
        getInputStream(client, res.actor);
      });
    }
    newUpload(this.connection.client, this.listTabsResponse.fileUploadActor);

    function getInputStream(client, actor) {
      NetUtil.asyncFetch(packageFile, (inputStream, status) => {
        if (!Components.isSuccessCode(status)) {
          return;
        }
        uploadChunk(client, actor, inputStream);
      });
    }
    function uploadChunk(client, actor, inputStream) {
      let chunkSize = 0;
      // When we read the whole stream, available() throws
      try {
        chunkSize = Math.min(CHUNK_SIZE, inputStream.available());
      } catch(e) {}

      if (chunkSize == 0) {
        endsUpload(client, actor);
        return;
      }
      let chunk = NetUtil.readInputStreamToString(inputStream, chunkSize);

      let request = {
        to: actor,
        type: "chunk",
        chunk: chunk
      };
      client.request(request, (res) => {
        uploadChunk(client, actor, inputStream);
      });
    }
    function endsUpload(client, actor) {
      let request = {
        to: actor,
        type: "done"
      };
      client.request(request, (res) => {
        deferred.resolve(actor);
      });
    }
    return deferred.promise;
  },

  _installPackaged: function(button, project) {
    button.textContent = "Installing...";
    button.disabled = true;
    let file = FileUtils.File(project.location);
    let tmpZipFile = FileUtils.getDir("TmpD", [], true);
    tmpZipFile.append("application-"+(new Date().getTime())+".zip");
    this._zipDirectory(tmpZipFile, file)
        .then(() => {
      this._uploadPackage(tmpZipFile)
          .then((fileActor) => {
            let actor = this.listTabsResponse.webappsActor;
            let request = {
              to: actor,
              type: "install",
              appId: project.packagedAppOrigin,
              upload: fileActor
            };
            this.connection.client.request(request, (res) => {
              if (res.error) {
                alert(res.error+":"+res.message);
              } else {
                button.textContent = "Installed!";
                setTimeout(function() {
                  button.textContent = "INSTALL";
                }, 1500);
              }
              button.disabled = false;
            });
          });
    });
  },

  reveal: function(location) {
    let project = AppProjects.get(location);
    if (project.type == "packaged") {
      let projectFolder = FileUtils.File(project.location);
      projectFolder.reveal();
    } else {
      // TODO: eventually open hosted apps in firefox
      // when permissions are correctly supported by firefox
    }
  },

  selectProject: function(location) {
    let projects = AppProjects.store.object.projects;
    let idx = 0;
    for (; idx < projects.length; idx++) {
      if (projects[idx].location == location) {
        break;
      }
    }
    if (idx == projects.length) {
      // Not found
      return;
    }

    let oldButton = document.querySelector("#projects .selected");
    if (oldButton) {
      oldButton.classList.remove("selected");
    }
    let button = document.getElementById(location);
    button.classList.add("selected");

    let template = '{"path":"projects.' + idx + '","childSelector":"#lense-template"}';

    let lense = document.querySelector("#lense");
    lense.setAttribute("template-for", template);
    this.template._processFor(lense);
  },
}
