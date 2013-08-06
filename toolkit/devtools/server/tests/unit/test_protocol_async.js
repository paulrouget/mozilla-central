/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test simple requests using the protocol helpers.
 */

let protocol = devtools.require("devtools/server/protocol");
let {method, Arg, Option, RetVal} = protocol;
let promise = devtools.require("sdk/core/promise");
let events = devtools.require("sdk/event/core");

function simpleHello() {
  return {
    from: "root",
    applicationType: "xpcshell-tests",
    traits: [],
  }
}

let RootActor = protocol.ActorClass({
  typeName: "root",
  initialize: function(conn) {
    protocol.Actor.prototype.initialize.call(this, conn);
    // Root actor owns itself.
    this.manage(this);
    this.actorID = "root";
    this.sequence = 0;
  },

  sayHello: simpleHello,

  simpleReturn: method(function() {
    dump("Called simpleReturn: " + this.sequence + "\n");
    return this.sequence++;
  }, {
    response: { value: RetVal() },
  }),

  promiseReturn: method(function() {
    // Guarantee that this resolves after simpleReturn returns.
    let deferred = promise.defer();
    dump("called promiseReturn: " + this.sequence + "\n");
    let sequence = this.sequence++;
    // This should be enough to force a failure if the code is broken.
    do_timeout(150, () => {
      deferred.resolve(sequence);
    });
    return deferred.promise;
  }, {
    response: { value: RetVal("number") },
  }),

  simpleThrow: method(function() {
    throw new Error("On purpose");
  }, {
    response: { value: RetVal("number") }
  }),

  promiseThrow: method(function() {
    // Guarantee that this resolves after simpleReturn returns.
    let deferred = promise.defer();
    // This should be enough to force a failure if the code is broken.
    do_timeout(150, () => {
      deferred.reject("On purpose");
    });
    return deferred.promise;
  }, {
    response: { value: RetVal("number") },
  })
});

let RootFront = protocol.FrontClass(RootActor, {
  initialize: function(client) {
    this.actorID = "root";
    protocol.Front.prototype.initialize.call(this, client);
    // Root owns itself.
    this.manage(this);
  }
});

function run_test()
{
  DebuggerServer.createRootActor = (conn => {
    return RootActor(conn);
  });
  DebuggerServer.init(() => true);

  let trace = connectPipeTracing();
  let client = new DebuggerClient(trace);
  let rootClient;

  client.connect((applicationType, traits) => {
    rootClient = RootFront(client);

    // Make sure a long-running async call returns before a later
    // short-running call
    let calls = [];
    let sequence = 0;

    calls.push(rootClient.promiseReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 0);
    }));

    // Put a few requests into the backlog

    calls.push(rootClient.simpleReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 1);
    }));

    calls.push(rootClient.simpleReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 2);
    }));

    calls.push(rootClient.simpleThrow().then(() => {
      do_check_true(false, "simpleThrow shouldn't succeed!");
    }, error => {
      do_check_true(true, "simple throw should throw");
      return promise.resolve(null);
    }));

    calls.push(rootClient.promiseThrow().then(() => {
      do_check_true(false, "promiseThrow shouldn't succeed!");
    }, error => {
      do_check_true(true, "simple throw should throw");
      return promise.resolve(null);
    }));

    calls.push(rootClient.simpleReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 3);
    }));

    // Break up the backlog with a long request
    calls.push(rootClient.promiseReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 4);
    }));

    calls.push(rootClient.simpleReturn().then(ret => {
      do_check_eq(ret, sequence);
      do_check_eq(sequence++, 5);
    }));

    promise.all.apply(null, calls).then(() => {
      dump("promise.all done\n");
      client.close(() => {
        do_test_finished();
      });
    })
  });
  do_test_pending();
}
