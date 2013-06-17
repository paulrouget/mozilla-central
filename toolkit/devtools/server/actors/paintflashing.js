const {Cc, Ci, Cu} = require("chrome");
const protocol = require("devtools/server/protocol");
const {Arg, Option, method, RetVal, types} = protocol;
const promise = require("sdk/core/promise");
const object = require("sdk/util/object");

exports.register = function(handle) {
  handle.addTabActor(PaintFlashingActor, "paintFlashingActor");
};

exports.unregister = function(handle) {
  handle.removeTabActor(PaintFlashingActor);
};

var PaintFlashingActor = protocol.ActorClass({
  typeName: "paintflashing",
  initialize: function(conn, tabActor) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this.tabActor = tabActor;

    let win;
    if (tabActor.browser instanceof Ci.nsIDOMWindow) {
      win = tabActor.browser;
    } else if (tabActor.browser instanceof Ci.nsIDOMElement) {
      win = tabActor.browser.contentWindow;
    }
    this.DOMUtils = win.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindowUtils)
  },

  getPaintFlashing: method(function(options={}) {
    return this.DOMUtils.paintFlashing;
  }, {
    request: {},
    response: {
      value: RetVal("boolean")
    }
  }),

  setPaintFlashing: method(function(value) {
    this.DOMUtils.paintFlashing = value;
  }, {
    request: {},
    response: {
      value: RetVal("boolean")
    }
  })
});

var PaintFlashingFront = exports.PaintFlashingFront = protocol.FrontClass(PaintFlashingActor, {
  initialize: function(client, tabForm) {
    protocol.Front.prototype.initialize.call(this, client);
    this.actorID = tabForm.paintFlashingActor;

    client.addActorPool(this);
    this.manage(this);
  }
});
