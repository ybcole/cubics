chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  sendResponse({ ok: true });
  return true;
});
