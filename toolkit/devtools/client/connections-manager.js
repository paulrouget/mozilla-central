/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cu} = require("chrome");
const {setTimeout, clearTimeout} = require('sdk/timers');
const EventEmitter = require("devtools/shared/event-emitter");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/devtools/dbg-client.jsm");
Cu.import("resource://gre/modules/devtools/dbg-server.jsm");

/**
 * Connections Manager.
 *
 * To use this module:
 * const {ConnectionsManager} = require("devtools/client/connections-manager");
 *
 * # ConnectionsManager
 *
 * Methods:
 *  ⬩ Connection createConnection(host, port)
 *  ⬩ void       destroyConnection(connection)
 *  ⬩ Array      getConnections()
 *
 * # Connection
 *
 * A connection is a wrapper around a debugger client. It has a simple
 * API to instanciate a connection to a debugger server. Once disconnected,
 * no need to re-create a Connection object. Calling `connect()` again
 * will re-create a debugger client.
 *
 * Methods:
 *  ⬩ connect()         Connect to host:port. Expect a "connecting" event. If
 *                      host is not specified, a local pipe is used.
 *  ⬩ disconnect()      Disconnect if connected. Expect a "disconnecting" event
 *
 * Properties:
 *  ⬩ host              IP address or hostname
 *  ⬩ port              Port
 *  ⬩ logs              Current logs. "newlog" event notifies new available logs
 *  ⬩ store             Reference to a local data store (see below)
 *  ⬩ status            Connection status:
 *                        Connection.CONNECTED,
 *                        Connection.DISCONNECTED,
 *                        Connection.CONNECTING,
 *                        Connection.DISCONNECTING,
 *                        Connection.DESTROYED.
 *
 * Events (as in event-emitter.js):
 *  ⬩ "connecting"      Trying to connect to host:port
 *  ⬩ "connected"       Connection is successful
 *  ⬩ "disconnecting"   Trying to disconnect from server.
 *  ⬩ "disconnected"    Disconnected (as request, or because of timeout or connection error)
 *  ⬩ "status-changed"  The connection status (connection.status) has changed
 *  ⬩ "timeout"         Connection timeout
 *  ⬩ "port-changed"    Port has changed
 *  ⬩ "host-changed"    Host has changed
 *  ⬩ "newlog"          A new log line is available
 *
 */

let ConnectionsManager = {
  _connections: new Set(),
  createConnection: function(host, port) {
    let c = new Connection(host, port);
    c.once("destroy", (event) => this.destroyConnection(c));
    this._connections.add(c);
    this.emit("new", c);
    return c;
  },
  destroyConnection: function(connection) {
    if (this._connections.has(connection)) {
      this._connections.delete(connection);
      if (connection.status != connection.DESTROYED) {
        connection.destroy();
      }
    }
  },
  getConnections: function() {
    return [c for (c of this._connections)];
  },
}

EventEmitter.decorate(ConnectionsManager);

exports.ConnectionsManager = ConnectionsManager;

function Connection(host, port) {
  EventEmitter.decorate(this);
  this.host = host;
  this.port = port;
  this._setStatus(this.DISCONNECTED);
  this._onDisconnected = this._onDisconnected.bind(this);
}

Connection.prototype = {

  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  DISCONNECTING: "disconnecting",
  DESTROYED: "destroyed",

  logs: "",
  log: function(str) {
    this.logs +=  "\n" + str;
    this.emit("newlog", str);
  },

  get status() this._status,

  get client() this._client,

  get host() this._host,
  set host(value) {
    if (this._host == value)
      return;
    this._host = value;
    this.emit("host-changed");
  },

  get port() this._port,
  set port(value) {
    if (this._port == value)
      return;
    this._port = value;
    this.emit("port-changed");
  },

  disconnect: function(force) {
    clearTimeout(this._timeoutID);
    if (this.status == this.CONNECTED ||
        this.status == this.CONNECTING) {
      this._ensureNotDestroyed();
      this.log("disconnecting");
      this._setStatus(this.DISCONNECTING);
      this._client.close();
    }
  },

  connect: function() {
    this._ensureNotDestroyed();
    if (!this._client) {
      this.log("connecting to " + this._host + ":" + this._port);
      this._connectionDate = new Date();
      this._setStatus(this.CONNECTING);
      let delay = Services.prefs.getIntPref("devtools.debugger.remote-timeout");
      this._timeoutID = setTimeout(() => this._onTimeout(), delay);

      let transport;
      if (!this._host) {
        transport = DebuggerServer.connectPipe();
      } else {
        transport = debuggerSocketConnect(this._host, this._port);
      }
      this._client = new DebuggerClient(transport);
      this._client.addListener("closed", this._onDisconnected);
      this._client.connect(() => this._onConnected());
    } else {
      let msg = "Can't connect. Client is not fully disconnected";
      this.log(msg);
      throw new Error(msg);
    }
  },

  destroy: function() {
    this.log("killing connection");
    clearTimeout(this._timeoutID);
    if (this._client) {
      this._client.removeListener("closed", this._onDisconnected);
      this._client.close();
      this._client = null;
    }
    this._setStatus(this.DESTROYED);
  },

  _setStatus: function(value) {
    if (this._status == value)
      return;
    this._status = value;
    this.emit(value);
    this.emit("status-changed", value);
  },

  _onDisconnected: function() {
    clearTimeout(this._timeoutID);
    switch (this._status) {
      case this.CONNECTED:
        this.log("disconnected (unexpected)");
        break;
      case this.CONNECTING:
        this.log("Connection error");
        break;
      default:
        this.log("disconnected");
    }
    this._client.removeListener("closed", this._onDisconnected);
    this._client = null;
    this._setStatus(this.DISCONNECTED);
  },

  _onConnected: function() {
    this.log("connected");
    clearTimeout(this._timeoutID);
    this._setStatus(this.CONNECTED);
  },

  _onTimeout: function() {
    this.log("connection timeout");
    this.emit("timeout");
    this.disconnect();
  },

  _ensureNotDestroyed: function() {
    if (this.status == this.DESTROYED) {
      throw new Error("Connection destroyed.");
    }
  },

}
