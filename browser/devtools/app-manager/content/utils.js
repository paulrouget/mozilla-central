let Utils = {};

(function() {
  const Cu = Components.utils;
  const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
  const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
  const {require} = devtools;
  const EventEmitter = require("devtools/shared/event-emitter");


  function mergeStores(stores) {
      let finalStore = {object:{}};
      EventEmitter.decorate(finalStore);
      for (let key in stores) {
        (function(key) {
          finalStore.object[key] = stores[key].object,
          stores[key].on("set", function(event, path, value) {
            finalStore.emit("set", [key].concat(path), value);
          });
        })(key);
      }
      return finalStore;
  }


  let strings = Services.strings.createBundle("chrome://browser/locale/devtools/app-manager.properties");

  function l10n (property, args = []) {
    if (args && args.length > 0) {
      return strings.formatStringFromName(property, args, args.length);
    } else {
      return strings.GetStringFromName(property);
    }
  }
  Utils.mergeStores = mergeStores;
  Utils.l10n = l10n;
})();
