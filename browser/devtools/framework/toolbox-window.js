let bannerHeight;
let lastHeight = 0.5 * window.innerHeight + "px";;

window.onload = function() {
  let hash = location.hash;
  if (hash) {
    let cid;
    let res = /#cid=(\d+)/.exec(hash);
    if (res) {
      window.onmessage = onMessage;
      cid = res[1];
      lastHeight = 0.6 * window.innerHeight + "px";
      let baseurl = "chrome://browser/content/devtools/app-manager/device-inspector.xhtml";
      let iframe = document.querySelector("#connection-iframe");
      iframe.setAttribute("src", baseurl + "#cid=" + cid);
      iframe.removeAttribute("hidden");
    }
  }
}

function collapseDeviceInpsector() {
  document.querySelector("splitter").setAttribute("hidden", "true");
  let iframe = document.querySelector("#connection-iframe");
  lastHeight = iframe.style.height;
  iframe.style.maxHeight = bannerHeight + "px";
  iframe.style.minHeight = bannerHeight + "px";
  iframe.style.height = bannerHeight + "px";
}

function expandDeviceInspector() {
  document.querySelector("splitter").removeAttribute("hidden");
  let iframe = document.querySelector("#connection-iframe");
  iframe.style.maxHeight = "none";
  iframe.style.minHeight = 2 * bannerHeight + "px";
  iframe.style.height = lastHeight;
}

function onMessage(event) {
  let message = JSON.parse(event.data);
  if (message.height) {
    bannerHeight = message.height;
    collapseDeviceInpsector();
  }
  if ("expanded" in message) {
    if (message.expanded)
      expandDeviceInspector();
    else
      collapseDeviceInpsector();
  }
}
