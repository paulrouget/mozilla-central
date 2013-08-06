/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ObjectEmitter based template mechanism.
 *
 * The information to expand the templates come from
 * a ObjectEmitter object. The templates are automatically
 * updated as the ObjectEmitter is updated (via the "set"
 * event). See documentation in EventEmitter.js.
 *
 * Templates are used this way:
 *
 * (See examples in device-inspector.xhtml)
 *
 * <div template="{JSON Object}">
 *
 * {
 *  type: "attribute"
 *  name: name of the attribute
 *  path: location of the attribute value in the ObjectEmitter
 * }
 *
 * {
 *  type: "textContent"
 *  path: location of the textContent value in the ObjectEmitter
 * }
 *
 * {
 *  type: "localizedContent"
 *  paths: array of locations of the value of the arguments of the property
 *  property: l10n property
 * }
 *
 * <div template-loop="{JSON Object}">
 *
 * {
 *  arrayPath: path of the array in the ObjectEmitter to loop from
 *  childSelector: selector of the element to duplicate in the loop
 * }
 *
 */

function Template(document, store, l10nResolver) {
  this._store = store;
  this._doc = document;
  this._l10n = l10nResolver;
  this._nodeListeners = new Map();
  this._loopListeners = new Map();

  this._store.on("set", (event,path,value) => this._storeChanged(path,value));
}

Template.prototype = {
  start: function() {
    this._processTree(this._doc.body);
  },

  _resolvePath: function(path, defaultValue=null) {
    let chunks = path.split(".");
    let obj = this._store.object;
    for (let word of chunks) {
      if ((typeof obj) == "object" &&
          (word in obj)) {
        obj = obj[word];
      } else {
        return defaultValue;
      }
    }
    return obj;
  },

  _storeChanged: function(path,value) {
    let strpath = path.join(".");
    this._invalidate(strpath);

    for (let [registeredPath, set] of this._nodeListeners) {
      if (strpath != registeredPath &&
          registeredPath.indexOf(strpath) > -1) {
        this._invalidate(registeredPath);
      }
    }
  },

  _invalidate: function(path) {
    // Loops:
    let set = this._loopListeners.get(path);
    if (set) {
      for (let elt of set) {
        this._processLoop(elt);
      }
    }

    // Nodes:
    set = this._nodeListeners.get(path);
    if (set) {
      for (let elt of set) {
        this._processNode(elt);
      }
    }
  },

  _registerNode: function(path, element) {
    if (!this._nodeListeners.has(path)) {
      this._nodeListeners.set(path, new Set());
    }
    let set = this._nodeListeners.get(path);
    set.add(element);
  },

  _unregisterNodes: function(nodes) {
    for (let [registeredPath, set] of this._nodeListeners) {
      for (let e of nodes) {
        set.delete(e);
      }
      if (set.size == 0) {
        this._nodeListeners.delete(registeredPath);
      }
    }
  },

  _registerLoop: function(path, element) {
    // We listen to the length property
    path += ".length";
    if (!this._loopListeners.has(path)) {
      this._loopListeners.set(path, new Set());
    }
    let set = this._loopListeners.get(path);
    set.add(element);
  },

  _processNode: function(e, rootPath="") {
    let str = e.getAttribute("template");
    if (rootPath)
      rootPath = rootPath + ".";
    try {
      let json = JSON.parse(str);
      // Sanity check
      if (!("type" in json)) {
        throw new Error("missing property");
      }
      if (json.rootPath)
        rootPath = json.rootPath;
      let paths = [];
      switch (json.type) {
        case "attribute": {
          if (!("name" in json) ||
              !("path" in json)) {
            throw new Error("missing property");
          }
          e.setAttribute(json.name, this._resolvePath(rootPath + json.path, "n/a"));
          paths.push(rootPath + json.path);
          break;
        }
        case "attributePresence": {
          if (!("name" in json) ||
              !("path" in json)) {
            throw new Error("missing property");
          }
          if (this._resolvePath(rootPath + json.path, false)) {
            e.setAttribute(json.name, "");
          } else {
            e.removeAttribute(json.name);
          }
          break;
        }
        case "textContent": {
          if (!("path" in json)) {
            throw new Error("missing property");
          }
          e.textContent = this._resolvePath(rootPath + json.path, "n/a");
          paths.push(rootPath + json.path);
          break;
        }
        case "localizedContent": {
          if (!("property" in json) ||
              !("paths" in json)) {
            throw new Error("missing property");
          }
          let params = json.paths.map((p) => {
            paths.push(rootPath + p);
            let str = this._resolvePath(rootPath + p, "n/a");
            return str;
          });
          e.textContent = this._l10n(json.property, params);
          break;
        }
      }
      if (rootPath)
        json.rootPath = rootPath;
      e.setAttribute("template", JSON.stringify(json));
      if (paths.length > 0) {
        for (let path of paths) {
          this._registerNode(path, e);
        }
      }
    } catch(exception) {
      console.error("Invalid template: " + e.outerHTML + " (" + exception + ")");
    }
  },

  _processLoop: function(e, rootPath="") {
    try {
      let template, count;
      let str = e.getAttribute("template-loop");
      let json = JSON.parse(str);
      if (!("arrayPath" in json)     ||
          !("childSelector" in json)) {
        throw new Error("missing property");
      }
      if (rootPath) {
        json.arrayPath = rootPath + "." + json.arrayPath;
      }
      let templateParent = this._doc.querySelector(json.childSelector);
      if (!templateParent) {
        throw new Error("can't find child");
      }
      template = this._doc.createElement("div");
      template.innerHTML = templateParent.textContent;
      template = template.firstElementChild;
      let array = this._resolvePath(json.arrayPath, []);
      if (!Array.isArray(array)) {
        console.error("referenced array is not an array");
      }
      count = array.length;

      let fragment = this._doc.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        let node = template.cloneNode(true);
        this._processTree(node, json.arrayPath + "." + i);
        fragment.appendChild(node);
      }
      this._registerLoop(json.arrayPath, e);
      this._unregisterNodes(e.querySelectorAll("[template]"));
      e.innerHTML = "";
      e.appendChild(fragment);
    } catch(exception) {
      console.error("Invalid template: " + e.outerHTML + " (" + exception + ")");
    }
  },

  _processTree: function(parent, rootPath="") {
    let loops = parent.querySelectorAll("[template-loop]");
    let nodes = parent.querySelectorAll("[template]");
    for (let e of loops) {
      this._processLoop(e, rootPath);
    }
    for (let e of nodes) {
      this._processNode(e, rootPath);
    }
    if (parent.hasAttribute("template")) {
      this._processNode(parent, rootPath);
    }
  },
}
