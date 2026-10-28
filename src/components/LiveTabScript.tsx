"use client";

/**
 * Cubics Live Tab Content Script
 *
 * Injected into live-tab iframes so remote users' input ops (clicks, scrolls,
 * keys) can be replayed on the live DOM via window.postMessage.
 *
 * The parent (cubics) posts { type: "LIVE_INPUT", input } to the iframe's
 * contentWindow. This script listens for those messages, resolves the target
 * element via document.elementFromPoint (normalized 0-1 coords -> page px),
 * and dispatches the corresponding real DOM event.
 */

const CONTENT_SCRIPT_ID = "cubics-live-tab-script";

export const LIVE_TAB_CONTENT_SCRIPT = `
(function() {
  if (window.__CUBICS_LIVE_TAB_INJECTED__) return;
  window.__CUBICS_LIVE_TAB_INJECTED__ = true;

  function dispatch(op) {
    var el;
    if (op.x != null && op.y != null) {
      var px = op.x * window.innerWidth;
      var py = op.y * window.innerHeight;
      el = document.elementFromPoint(px, py);
    }
    if (!el) el = document.body;

    try {
      switch (op.type) {
        case "mousedown":
        case "mouseup":
        case "click": {
          var ev = new MouseEvent(op.type, {
            bubbles: true,
            cancelable: true,
            clientX: op.x != null ? op.x * window.innerWidth : 0,
            clientY: op.y != null ? op.y * window.innerHeight : 0,
            button: op.button != null ? op.button : 0,
            buttons: 1,
            view: window
          });
          el.dispatchEvent(ev);
          break;
        }
        case "mousemove": {
          var ev = new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: false,
            clientX: op.x != null ? op.x * window.innerWidth : 0,
            clientY: op.y != null ? op.y * window.innerHeight : 0,
            buttons: 0,
            view: window
          });
          el.dispatchEvent(ev);
          break;
        }
        case "keydown":
        case "keyup": {
          var ev = new KeyboardEvent(op.type, {
            bubbles: true,
            cancelable: true,
            key: op.key || "",
            code: op.code || "",
            view: window
          });
          el.dispatchEvent(ev);
          break;
        }
        case "wheel": {
          var ev = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: op.x != null ? op.x * window.innerWidth : 0,
            clientY: op.y != null ? op.y * window.innerHeight : 0,
            deltaY: op.deltaY != null ? op.deltaY : 0,
            deltaMode: 0,
            view: window
          });
          el.dispatchEvent(ev);
          break;
        }
        case "scroll": {
          var ev = new Event("scroll", { bubbles: true, cancelable: true });
          window.dispatchEvent(ev);
          break;
        }
      }
    } catch (e) {
      console.error("[Cubics LiveTab] dispatch failed", e);
    }
  }

  window.addEventListener("message", function(event) {
    if (!event.data || event.data.type !== "LIVE_INPUT") return;
    var input = event.data.input;
    if (!input || !input.type) return;
    dispatch(input);
  }, false);
})();
`;

/**
 * Inject the content script into an iframe's contentWindow once it has loaded.
 * Returns a cleanup function that removes the injected script element.
 */
export function injectLiveTabScript(iframe: HTMLIFrameElement): () => void {
  if (!iframe.contentWindow) return () => {};

  const script = document.createElement("script");
  script.id = CONTENT_SCRIPT_ID;
  script.textContent = LIVE_TAB_CONTENT_SCRIPT;

  // Attempt to append to iframe document; cross-origin iframes will throw.
  let cleanup = () => {};
  try {
    const doc = iframe.contentDocument || iframe.contentWindow!.document;
    // Avoid duplicate injection
    if (doc.getElementById(CONTENT_SCRIPT_ID)) return () => {};
    (doc.head || doc.documentElement).appendChild(script);
    cleanup = () => {
      const el = doc.getElementById(CONTENT_SCRIPT_ID);
      if (el) el.remove();
    };
  } catch (e) {
    // Cross-origin iframe: cannot inject. Control will be view-only.
    cleanup = () => {};
  }

  return cleanup;
}

export function bindBinaryMouseDispatch(channel: RTCDataChannel) {
  let pending: { x: number; y: number } | null = null;
  const flush = () => {
    if (!pending) return;
    const buf = new Uint16Array(2);
    buf[0] = pending.x;
    buf[1] = pending.y;
    channel.send(buf.buffer);
    pending = null;
  };
  window.addEventListener("mousemove", (e: MouseEvent) => {
    pending = { x: e.clientX, y: e.clientY };
    requestAnimationFrame(flush);
  });
}
