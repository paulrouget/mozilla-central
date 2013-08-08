let {Ci,Cu,CC,Cc} = require("chrome");
const promise = require("sdk/core/promise");

const {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm");
const {Services} = Cu.import("resource://gre/modules/Services.jsm");
let XMLHttpRequest = CC("@mozilla.org/xmlextras/xmlhttprequest;1");

function AppValidator(project) {
  this.project = project;
  this.errors = [];
  this.warnings = [];
}

AppValidator.prototype.error = function (message) {
  this.errors.push(message);
}

AppValidator.prototype.warning = function (message) {
  this.warnings.push(message);
}

AppValidator.prototype._getPackagedManifestURL = function () {
  let manifestFile = FileUtils.File(this.project.location);
  if (!manifestFile.exists()) {
    this.error("The project folder doesn't exists");
    return;
  }
  if (!manifestFile.isDirectory()) {
    this.error("The project folder ends up being a file");
    return;
  }
  manifestFile.append("manifest.webapp");
  if (!manifestFile.exists() || !manifestFile.isFile()) {
    this.error("Packaged apps require a manifest file that can only be named" +
               " 'manifest.webapp' at project root folder");
    return;
  }

  return Services.io.newFileURI(manifestFile).spec;
}

AppValidator.prototype._fetchManifest = function (manifestURL) {
  let deferred = promise.defer();

  let req = new XMLHttpRequest();
  try {
    req.open("GET", manifestURL, true);
  } catch(e) {
    this.error("Invalid manifest URL '" + manifestURL + "'");
    deferred.resolve(null);
    return deferred.promise;
  }
  req.channel.loadFlags |= Ci.nsIRequest.INHIBIT_CACHING;
  req.onload = (function () {
    let manifest = null;
    try {
      manifest = JSON.parse(req.responseText);
    } catch(e) {
      this.error("The webapp manifest isn't a valid JSON file: " + e +
                 "at: " + manifestURL);
    }
    deferred.resolve(manifest);
  }).bind(this);
  req.onerror = (function () {
    this.error("Unable to read manifest file: " + req.statusText +
               "at: " + manifestURL);
    deferred.resolve(null);
  }).bind(this);

  try {
    req.send(null);
  } catch(e) {
    this.error("Error while reading manifest.webapp file");
    deferred.resolve();
  }

  return deferred.promise;
}

AppValidator.prototype._getManifest = function () {
  let manifestURL;
  if (this.project.type == "packaged") {
    manifestURL = this._getPackagedManifestURL();
  } else if (this.project.type == "hosted") {
    manifestURL = this.project.location;
    try {
      Services.io.newURI(manifestURL, null, null);
    } catch(e) {
      this.error("Invalid hosted manifest URL '" + manifestURL + "': " + e.message);
      return promise.resolve(null);
    }
  } else {
    this.error("Unknown project type '" + this.project.type + "'");
    return promise.resolve(null);
  }
  return this._fetchManifest(manifestURL);
}

AppValidator.prototype.validateManifest = function (manifest) {
  if (!manifest.name) {
    this.error("Missing mandatory 'name' in Manifest.");
    return;
  }

  if (!manifest.icons || Object.keys(manifest.icons).length == 0) {
    this.warning("Missing 'icons' in Manifest.");
  } else if (!manifest.icons["128"]) {
    this.warning("app submission to the Marketplace needs at least an 128 icon");
  }
}

AppValidator.prototype.validateType = function (manifest) {
  let appType = manifest.type || "web";
  if (["web", "privileged", "certified"].indexOf(appType) === -1) {
    this.error("Unknown app type: '" + appType + "'.");
  } else if (this.project.type == "hosted" &&
             ["certified", "privileged"].indexOf(appType) !== -1) {
    this.error("Hosted App can't be type '" + appType + "'.");
  }

  // certified app are not fully supported on the simulator
  if (appType === "certified") {
    this.warning("'certified' apps are not fully supported on the Simulator.");
  }
}

AppValidator.prototype.validate = function () {
  this.errors = [];
  this.warnings = [];
  return this._getManifest().
    then((function (manifest) {
      console.log("got manifest: "+manifest);
      try {
      if (manifest) {
        this.manifest = manifest;
        this.validateManifest(manifest);    
        this.validateType(manifest);
      }
      }catch(e) {
console.log("ex::"+e);
      }
    }).bind(this));
}

exports.AppValidator = AppValidator;

