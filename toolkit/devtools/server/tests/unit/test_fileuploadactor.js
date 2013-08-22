/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

let {defer} = devtools.require("sdk/core/promise");

function TestFileReaderActor(aConnection) {
  this.conn = aConnection;
}

TestFileReaderActor.prototype = {
  actorPrefix: "testFileReader",
  read: function (aRequest) {
    let actor = aRequest.actor;

    let deferred = defer();

    // `actor` is the actor string ID
    // On server side, we need to get the actual actor instance
    // in order to get file path.
    // So that the client never sees the temporary file path.
    let uploadActor = this.conn.getActor(actor);
    do_check_true(!!uploadActor);
    let file = uploadActor.getFile();
    do_check_true(!!file);

    do_check_true(file.exists());
    do_check_true(file.isFile());
    NetUtil.asyncFetch(file, function(inputStream, status) {
      do_check_true(Components.isSuccessCode(status));
      let content = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      do_check_eq(content, "foobar");

      deferred.resolve({ path:file.path });
    });

    return deferred.promise;
  },
};

TestFileReaderActor.prototype.requestTypes = {
  "read": TestFileReaderActor.prototype.read,
};


function run_test()
{
  DebuggerServer.init(function () { return true; });
  DebuggerServer.addBrowserActors();
  DebuggerServer.addGlobalActor(TestFileReaderActor, "testFileReaderActor");
  var client = new DebuggerClient(DebuggerServer.connectPipe());
  client.connect(function () {
    client.listTabs(function(aResponse) {
      test_fileupload_actor(client, aResponse.fileUploadActor, aResponse.testFileReaderActor);
    });
  });
  do_test_pending();
}

function test_fileupload_actor(aClient, aFileUpload, aFileReader)
{
  function create() {
    aClient.request({ to: aFileUpload, type: "upload" }, function (aResponse) {
      do_check_eq(typeof aResponse.actor, "string");

      first_chunk(aResponse.actor);
    });
  }
  create();

  function first_chunk(actor) {
    let request = {
      to: actor,
      type: "chunk",
      chunk: "foo"
    };
    aClient.request(request, function (aResponse) {
      do_check_eq(aResponse.size, 3);
      do_check_eq(aResponse.written, 3);

      second_chunk(actor);
    });
  }

  function second_chunk(actor) {
    let request = {
      to: actor,
      type: "chunk",
      chunk: "bar"
    };
    aClient.request(request, function (aResponse) {
      do_check_eq(aResponse.size, 6);
      do_check_eq(aResponse.written, 3);

      end_of_upload(actor);
    });
  }

  function end_of_upload(actor) {
    let request = {
      to: actor,
      type: "done"
    };
    aClient.request(request, function (aResponse) {
      check_file_content(actor);
    });
  }

  function check_file_content(actor) {
    // We have to call a test actor in order to read the file
    // as only the server code can get access to the file.
    let request = {
      to: aFileReader,
      type: "read",
      actor: actor
    };
    aClient.request(request, function (aResponse) {
      // This test actor send us back the file path
      // in order to easily check whether the file is correctly
      // remove on delete
      let path = aResponse.path;
      let file = FileUtils.File(path);
      delete_upload(actor, file);
    });
  }

  function delete_upload(actor, file) {
    do_check_true(file.exists());
    let request = {
      to: actor,
      type: "remove"
    };
    aClient.request(request, function (aResponse) {
      do_check_false(file.exists());
      aClient.close(function() {
        do_test_finished();
      });
    });
  }
}
