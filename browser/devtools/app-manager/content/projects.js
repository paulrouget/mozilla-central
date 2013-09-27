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
const {installHosted, installPackaged, getTargetForApp} = require("devtools/app-actor-front");
const WebappsStore = require("devtools/app-manager/webapps-store");

const promise = require("sdk/core/promise");

window.addEventListener("message", function(event) {
  try {
    let json = JSON.parse(event.data);
    if (json.name == "connection") {
      let cid = parseInt(json.cid);
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
  _displayedProject: null,

  onload: function() {
    this.template = new Template(document.body, AppProjects.store, Utils.l10n);
    this.template.start();

    AppProjects.load().then(() => {
      AppProjects.store.object.projects.forEach(UI.validate);
    });
  },

  onNewConnection: function() {
    this.connection.on(Connection.Events.STATUS_CHANGED, () => this._onConnectionStatusChange());
    this._onConnectionStatusChange();
    this._listenToRunningApps();
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
    fp.init(window, Utils.l10n("project.filePickerTitle"), Ci.nsIFilePicker.modeGetFolder);
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
                 UI.selectProject(project.location);
               });
  },

  addHosted: function() {
    let urlInput = document.querySelector("#url-input");
    let manifestURL = urlInput.value;
    AppProjects.addHosted(manifestURL)
               .then(function (project) {
                 UI.validate(project);
                 UI.selectProject(project.location);
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
    return validation.validate()
      .then(function () {
        if (validation.manifest) {
          project.name = validation.manifest.name;
          project.icon = UI._getLocalIconURL(project, validation.manifest);
          project.manifest = validation.manifest;
        }

        project.validationStatus = "valid";

        if (validation.warnings.length > 0) {
          project.warningsCount = validation.warnings.length;
          project.warnings = validation.warnings.join(",\n ");
          project.validationStatus = "warning";
        } else {
          project.warnings = "";
          project.warningsCount = 0;
        }

        if (validation.errors.length > 0) {
          project.errorsCount = validation.errors.length;
          project.errors = validation.errors.join(",\n ");
          project.validationStatus = "error";
        } else {
          project.errors = "";
          project.errorsCount = 0;
        }

      });

  },

  remove: function(location, event) {
    if (event) {
      // We don't want the "click" event to be propagated to the project item.
      // That would trigger `selectProject()`.
      event.stopPropagation();
    }

    let item = document.getElementById(location);

    let toSelect = document.querySelector(".project-item.selected");
    toSelect = toSelect ? toSelect.id : "";

    if (toSelect == location) {
      toSelect = null;
      let sibling;
      if (item.previousElementSibling) {
        sibling = item.previousElementSibling;
      } else {
        sibling = item.nextElementSibling;
      }
      if (sibling && !!AppProjects.get(sibling.id)) {
        toSelect = sibling.id;
      }
    }

    AppProjects.remove(location).then(() => {
      this.selectProject(toSelect);
    });
  },

  _getProjectManifestURL: function (project) {
    if (project.type == "packaged") {
      return "app://" + project.packagedAppOrigin + "/manifest.webapp";
    } else if (project.type == "hosted") {
      return project.location;
    }
  },

  install: function(project) {
    if (project.type == "packaged") {
      return installPackaged(this.connection.client, this.listTabsResponse.webappsActor, project.location, project.packagedAppOrigin)
        .then(({ appId }) => {
          // If the packaged app specified a custom origin override,
          // we need to update the local project origin
          project.packagedAppOrigin = appId;
          // And ensure the indexed db on disk is also updated
          AppProjects.update(project);
        });
    } else {
      let manifestURLObject = Services.io.newURI(project.location, null, null);
      let origin = Services.io.newURI(manifestURLObject.prePath, null, null);
      let appId = origin.host;
      let metadata = {
        origin: origin.spec,
        manifestURL: project.location
      };
      return installHosted(this.connection.client, this.listTabsResponse.webappsActor, appId, metadata, project.manifest);
    }
  },

  start: function(project) {
    let deferred = promise.defer();
    let request = {
      to: this.listTabsResponse.webappsActor,
      type: "launch",
      manifestURL: this._getProjectManifestURL(project)
    };
    this.connection.client.request(request, (res) => {
      if (res.error)
        deferred.reject(res.error);
      else
        deferred.resolve(res);
    });
    return deferred.promise;
  },

  stop: function(project) {
    let deferred = promise.defer();
    let manifest = this._getProjectManifestURL(project);
    let request = {
      to: this.listTabsResponse.webappsActor,
      type: "close",
      manifestURL: this._getProjectManifestURL(project)
    };
    this.connection.client.request(request, (res) => {
      if (res.error) {
        deferred.reject(res.error);
      } else {
        deferred.resolve();
      }
    });
    return deferred.promise;
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

    let oldButton = document.querySelector(".project-item.selected");
    if (oldButton) {
      oldButton.classList.remove("selected");
    }

    if (idx == projects.length) {
      // Not found. Empty lense.
      let lense = document.querySelector("#lense");
      lense.setAttribute("template-for", '{"path":"","childSelector":""}');
      this.template._processFor(lense);
      this._displayedProject = null;
      this._checkIfDisplayedProjectIsRunning();
      return;
    }

    let button = document.getElementById(location);
    button.classList.add("selected");

    let template = '{"path":"projects.' + idx + '","childSelector":"#lense-template"}';

    let lense = document.querySelector("#lense");
    lense.setAttribute("template-for", template);
    this.template._processFor(lense);
    this._displayedProject = this._getProjectManifestURL(projects[idx]);
    this._checkIfDisplayedProjectIsRunning();
  },

  _checkIfDisplayedProjectIsRunning: function() {
    let runningApps = this.webappsStore.object.running;
    let currentApp = this._displayedProject;
    if (!currentApp) {
      document.body.classList.remove("selected-app-running");
      return;
    }
    if (runningApps.indexOf(currentApp) > -1) {
      document.body.classList.add("selected-app-running");
    } else {
      document.body.classList.remove("selected-app-running");
    }
  },

  _listenToRunningApps: function() {
    let onWebappsStoreChange = (e, paths) => {
      if (paths[0] == "running") {
        this._checkIfDisplayedProjectIsRunning();
      }
    }
    if (this.webappsStore) {
      this.webappsStore.off("set", onWebappsStoreChange)
    }
    this.webappsStore = new WebappsStore(this.connection),
    this.webappsStore.on("set", onWebappsStoreChange)
    this._checkIfDisplayedProjectIsRunning();
  },

  // Project buttons
  freezeButtons: function() {
    document.body.classList.add("project-buttons-frozen");
  },

  unfreezeButtons: function() {
    document.body.classList.remove("project-buttons-frozen");
  },

  // FIXME: remove .properties strings because we remove button (or use them in the throbber)
  validateSelectedApp: function(location) {
    this.freezeButtons("validating");
    let project = AppProjects.get(location);
    return this.validate(project).then(() => this.unfreezeButtons())
  },

  validateAndInstallSelectedApp: function(location) {
    this.freezeButtons("validatingAndInstallingSelectedApp");
    return this.validateSelectedApp(location)
               .then(() => {
                 // Install the app to the device if we are connected,
                 // and there is no error
                 let project = AppProjects.get(location);
                 if (project.errorsCount == 0 && this.listTabsResponse) {
                   return this.install(project);
                 }
               }).then(() => {
                 this.unfreezeButtons()
               }, (res) => {
                 this.unfreezeButtons()
                 let message = res.error + ": " + res.message;
                 alert(message);
                 this.connection.log(message);
               });
  },

  startSelectedApp: function(location) {
    this.freezeButtons("startingSelectedApp");
    let project = AppProjects.get(location);
    return this.start(project)
               .then(() => {
                       this.unfreezeButtons();
                     }, (err) => {
                       this.unfreezeButtons();
                       // If not installed, install and open it
                       if (err.error == "NO_SUCH_APP") {
                         return this.validateAndInstallSelectedApp(location).then(
                           () => this.startSelectedApp(location)
                         )
                       } else {
                          let message = err.error ? err.error + ": " + err.message : String(err);
                          alert(message);
                          this.connection.log(message);
                       }
                     });
  },

  stopSelectedApp: function(location) {
    this.freezeButtons("stoppingSelectingApp");
    let project = AppProjects.get(location);
    return this.stop(project)
               .then(() => {
                       this.unfreezeButtons();
                     }, (err) => {
                       this.unfreezeButtons();
                       let message = err.error ? err.error + ": " + err.message : String(err);
                       alert(message);
                       this.connection.log(message);
                     });
  },

  // FIXME: doesn't work. `close` call return too early
  restartSelectedApp: function(location) {
    this.freezeButtons("restartingSelectedApp");
    return this.stopSelectedApp(location)
               .then(() => {
                   this.startSelectedApp(location);
                 });
  },

  startAndDebugSelectedApp: function(location) {
    this.freezeButtons("startingAndDebuggingSelectedApp");
    return this.startSelectedApp(location).then(
      () => {
        this.debugSelectedApp(location);
      }
    );
  },

  debugSelectedApp: function(location) {
    this.freezeButtons("debuggingSelectedApp");
    let project = AppProjects.get(location);

    let onFailedToStart = (error) => {
    };
    let onStarted = () => {
      // Once we asked the app to launch, the app isn't necessary completely loaded.
      // launch request only ask the app to launch and immediatly returns.
      // We have to keep trying to get app tab actors required to create its target.
      let deferred = promise.defer();
      let loop = (count) => {
        // Ensure not looping for ever
        if (count >= 100) {
          deferred.reject("Unable to connect to the app");
          return;
        }
        // Also, in case the app wasn't installed yet, we also have to keep asking the
        // app to launch, as launch request made right after install may race.
        this.start(project);
        getTargetForApp(
          this.connection.client,
          this.listTabsResponse.webappsActor,
          this._getProjectManifestURL(project)).
            then(deferred.resolve,
                 (err) => {
                   if (err == "appNotFound")
                     setTimeout(loop, 500, count + 1);
                   else
                     deferred.reject(err);
                 });
      };
      loop(0);
      return deferred.promise;
    };
    let onTargetReady = (target) => {
      // Finally, when it's finally opened, display the toolbox
      let deferred = promise.defer();
      gDevTools.showToolbox(target,
                            null,
                            devtools.Toolbox.HostType.WINDOW).then(toolbox => {
        this.connection.once(Connection.Events.DISCONNECTED, () => {
          toolbox.destroy();
        });
        deferred.resolve(toolbox);
      });
      return deferred.promise;
    };

    // First try to open the app
    this.start(project)
        .then(null, onFailedToStart)
        .then(onStarted)
        .then(onTargetReady)
        .then(() => {
           // And only when the toolbox is opened, release the button
           button.disabled = false;
         },
         (err) => {
           button.disabled = false;
           let message = err.error ? err.error + ": " + err.message : String(err);
           alert(message);
           this.connection.log(message);
         });
  },
}
