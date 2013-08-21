function ManifestEditor(root, json) {
  this.json = json;
  this.doc = root.ownerDocument;
  this.buildUI(root);
}

ManifestEditor.prototype = {
  buildUI: function(parent) {

    parent.innerHTML = "";

    let colName = this.doc.createElement("div");
    let colType = this.doc.createElement("div");
    let colValue = this.doc.createElement("div");

    colName.className = "manifest-editor-column manifest-editor-column-name";
    colType.className = "manifest-editor-column manifest-editor-column-type";
    colValue.className = "manifest-editor-column manifest-editor-column-value";

    this.colName = colName;
    this.colType = colType;
    this.colValue = colValue;

    this.buildRows(this.json, 0);

    parent.appendChild(colName);
    parent.appendChild(colType);
    parent.appendChild(colValue);
  },

  buildRows: function(obj, level) {
    let fName = this.doc.createDocumentFragment();
    let fType = this.doc.createDocumentFragment();
    let fValue = this.doc.createDocumentFragment();
    for (let key in obj) {
      let value = obj[key];
      if (typeof value == "object") {
        this.buildOneRow(key, "", "", level, true);
        this.buildRows(value, level + 1);
      } else {
        this.buildOneRow(key, typeof value, value, level, false);
      }
    }
  },

  toggle: function(index) {
    let name = this.colName.children[index];
    let level = name.getAttribute("level");

    let twisty = name.querySelector(".theme-twisty");

    let isOpen = twisty.hasAttribute("open");

    if (isOpen) {
      twisty.removeAttribute("open");
    } else {
      twisty.setAttribute("open", "true");
    }

    let j = index;
    while (true) {
      j++;
      let nextName = this.colName.children[j];
      let nextType = this.colType.children[j];
      let nextValue = this.colValue.children[j];
      if (nextName && nextName.getAttribute("level") > level) {
        if (isOpen) {
          nextName.setAttribute("collapse", "true");
          nextType.setAttribute("collapse", "true");
          nextValue.setAttribute("collapse", "true");
        } else {
          nextName.removeAttribute("collapse");
          nextType.removeAttribute("collapse");
          nextValue.removeAttribute("collapse");
        }
      } else {
        break;
      }
    }
  },

  buildOneRow: function(name, type, value, level, isTwisty) {
    let div1 = this.doc.createElement("div");
    let div2 = this.doc.createElement("div");
    let div3 = this.doc.createElement("div");

    div1.setAttribute("level", level);

    div1.className = "manifest-editor-cell";
    div2.className = "manifest-editor-cell";
    div3.className = "manifest-editor-cell";

    if (isTwisty) {
      let twisty = this.doc.createElement("span");
      twisty.className = "theme-twisty";
      twisty.setAttribute("open", "true");
      div1.appendChild(twisty);
      let index = this.colName.childElementCount;
      twisty.onclick = () => {
        this.toggle(index);
      };
    }

    let span1 = this.doc.createElement("span");
    let span2 = this.doc.createElement("span");

    let input3;
    if (isTwisty) {
      input3 = this.doc.createElement("span");
    } else {
      input3 = this.doc.createElement("input");
    }

    span1.textContent = name;
    span2.textContent = type;

    if (!isTwisty) {
      input3.value = value;
    }

    div1.appendChild(span1);
    div2.appendChild(span2);
    div3.appendChild(input3);

    this.colName.appendChild(div1);
    this.colType.appendChild(div2);
    this.colValue.appendChild(div3);
  },
}
