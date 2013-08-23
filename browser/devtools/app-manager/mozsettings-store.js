/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ObservableObject = require("devtools/shared/observable-object");
const {getMozSettingsFront} = require("devtools/server/actors/mozsettings");
const {Connection} = require("devtools/client/connection-manager");

const {Cu} = require("chrome");

const _knownMozSettingsStore = new WeakMap();

let MozSettingsStore;

module.exports = MozSettingsStore = function(connection) {
  // If we already know about this connection,
  // let's re-use the existing store.
  if (_knownMozSettingsStore.has(connection)) {
    return _knownMozSettingsStore.get(connection);
  }

  _knownMozSettingsStore.set(connection, this);

  ObservableObject.call(this, {});

  this._resetStore();

  this._destroy = this._destroy.bind(this);
  this._onStatusChanged = this._onStatusChanged.bind(this);

  this._connection = connection;
  this._connection.once(Connection.Events.DESTROYED, this._destroy);
  this._connection.on(Connection.Events.STATUS_CHANGED, this._onStatusChanged);
  this._onStatusChanged();
  return this;
}

MozSettingsStore.prototype = {
  _destroy: function() {
    this._connection.off(Connection.Events.STATUS_CHANGED, this._onStatusChanged);
    _knownMozSettingsStore.delete(this._connection);
    this._connection = null;
  },

  _resetStore: function() {
    this.object = {};
  },

  _onStatusChanged: function() {
    if (this._connection.status == Connection.Status.CONNECTED) {
      this._listTabs();
    } else {
      this._resetStore();
    }
  },

  _listTabs: function() {
    this._connection.client.listTabs((resp) => {
      this._deviceFront = getDeviceFront(this._connection.client, resp);
      this._feedStore();
    });
  },

  _feedStore: function() {
    this._getDeviceDescription();
    this._getDevicePermissionsTable();
  },

  _getDeviceDescription: function() {
    return this._deviceFront.getDescription()
    .then(json => {
      json.dpi = Math.ceil(json.dpi);
      this.object.description = json;
    });
  },

  _getDevicePermissionsTable: function() {
    return this._deviceFront.getRawPermissionsTable()
    .then(json => {
      let permissionsTable = json.rawPermissionsTable;
      let permissionsArray = [];
      for (let name in permissionsTable) {
        permissionsArray.push({
          name: name,
          app: permissionsTable[name].app,
          privileged: permissionsTable[name].privileged,
          certified: permissionsTable[name].certified,
        });
      }
      this.object.permissions = permissionsArray;
    });
  },
}
