(function () {
  if (window === window.top) {
    document.documentElement.dataset.cubicsExtension = "true";
    return;
  }

  var GOOGLE_ERROR = /cookie|Enable cookies|Paganahin ang cookies/i;

  function checkGoogleError() {
    if (!/google\.com/.test(location.hostname)) return;
    var body = document.body ? document.body.innerText : "";
    if (GOOGLE_ERROR.test(body)) {
      var overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:999999;background:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:24px;text-align:center;";
      overlay.innerHTML =
        '<div><p style="font-size:15px;color:#dc2626;font-weight:600;margin:0 0 8px">Cookies blocked by Chrome</p>' +
        '<p style="font-size:13px;color:#52525b;margin:0 0 12px">Chrome is blocking cookies in this iframe.<br>' +
        "Open <b>chrome://settings/cookies</b> and set<br>" +
        '<b>Third-party cookies → Allow third-party cookies</b></p>' +
        '<p style="font-size:11px;color:#a1a1aa;margin:0">This is a Chrome setting, not a website issue.</p></div>';
      document.body.appendChild(overlay);
    }
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data || {};
    if (d.type === "NAVIGATE" && d.url) window.location.href = d.url;
    if (d.type === "GO_BACK") window.history.back();
    if (d.type === "GO_FORWARD") window.history.forward();
    if (d.type === "RELOAD") window.location.reload();
  });

  var lastUrl = location.href;
  function report() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      window.parent.postMessage({ type: "URL_CHANGED", url: location.href }, "*");
    }
  }
  window.addEventListener("popstate", report);
  window.addEventListener("load", function () {
    report();
    checkGoogleError();
  });
  var origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(history, arguments);
    report();
  };
  var origReplace = history.replaceState;
  history.replaceState = function () {
    origReplace.apply(history, arguments);
    report();
  };
})();
