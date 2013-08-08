const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;
const {ConnectionsManager} = require("devtools/client/connections-manager");
const {AppProjects} = require("devtools/app-manager/app-projects");
const {AppValidator} = require("devtools/app-manager/app-validator");
const {Services} = Cu.import("resource://gre/modules/Services.jsm");
const {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm");

window.addEventListener("message", function(event) {
  try {
    let json = JSON.parse(event.data);
    if (json.name == "connection") {
      let cid = +json.cid;
      for (let c of ConnectionsManager.connections) {
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
    this.template = new Template(document.body, AppProjects.store, (property, args) => {
      return "l10n?";
    });
    this.template.start();

    AppProjects.store.on("set", (event,path,value) => {
      if (path == "projects") {
        AppProjects.store.object.projects.forEach(UI.validate);
      }
    });
  },

  onNewConnection: function() {
    console.log("connection attached");
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
                }

                project.validationStatus = "valid";

                if (validation.errors.length > 0) {
                  project.errors = "Errors: " + validation.errors.join(",\n ");
                  project.validationStatus = "error";
                } else {
                  project.errors = "";
                }

                if (validation.warnings.length > 0) {
                  project.warnings = "Warnings: " + validation.warnings.join(",\n ");
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
}
