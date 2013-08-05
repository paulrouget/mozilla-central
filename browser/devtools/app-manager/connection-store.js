/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ObservableObject = require("devtools/shared/observable-object");

const _knownConnectionStores = new WeakMap();

module.exports = ConnectionStore = function(connection) {
  // If we already know about this connection,
  // let's re-use the existing store.
  if (_knownConnectionStores.has(connection)) {
    return _knownConnectionStores.get(connection);
  }
  _knownConnectionStores.set(connection, this);

  ObservableObject.call(this, {status:null,host:null,port:null});

  this._destroy = this._destroy.bind(this);
  this._feedStore = this._feedStore.bind(this);

  this._connection = connection;
  this._connection.once("destroyed", this._destroy);
  this._connection.on("status-changed", this._feedStore);
  this._connection.on("port-changed", this._feedStore);
  this._connection.on("host-changed", this._feedStore);
  this._feedStore();
}

ConnectionStore.prototype = {
  _destroy: function() {
    this._connection.off("status-changed", this._feedStore);
    this._connection.off("port-changed", this._feedStore);
    this._connection.off("host-changed", this._feedStore);
    _knownConnectionStores.delete(this._connection);
    this._connection = null;
  },

  _feedStore: function() {
    this.object.status = this._connection.status;
    this.object.host = this._connection.host;
    this.object.port = this._connection.port;
  }
}
