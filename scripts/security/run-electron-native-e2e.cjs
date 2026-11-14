"use strict";

// On all GitHub-hosted OS runners Electron logs the final PASS marker but
// stays alive after app.exit/process.exit. Never accept a wall-clock timeout
// as a passing native test: observe the marker AND terminate the fixture's
// dedicated process group after all its assertions are complete.
const { spawn, execFileSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const electron = require("electron");
const fixture = path.resolve(__dirname, "electron-native-e2e.cjs");
const windows = process.platform === "win32";
const linux = process.platform === "linux";
const child = linux
  ? spawn("xvfb-run", ["--auto-servernum", "--server-args=-screen 0 1280x800x24", electron, fixture],
      { stdio: ["ignore", "pipe", "pipe"], detached: true })
  : spawn(electron, [fixture], { stdio: ["ignore", "pipe", "pipe"], detached: !windows });

let output = "";
let finished = false;
function killTree() {
  if (!child.pid) return;
  if (windows) {
    try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", timeout: 8000 }); }
    catch { try { child.kill("SIGKILL"); } catch {} }
  } else {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch { try { child.kill("SIGKILL"); } catch {} }
  }
}
function finish(code, message) {
  if (finished) return;
  finished = true;
  if (message) console.error(message);
  killTree();
  process.exitCode = code;
}
const timer = setTimeout(() => finish(1, "M04_NATIVE_RUNNER_TIMEOUT: no completed assertion marker"), 90_000);
timer.unref?.();
function scan(data, stream) {
  const chunk = String(data);
  stream.write(chunk);
  output = (output + chunk).slice(-120_000);
  if (output.includes("M04_NATIVE_E2E_FAIL:")) {
    clearTimeout(timer);
    finish(1, "M04 native assertions failed");
  } else if (output.includes("M04_NATIVE_E2E_PASS:")) {
    // The fixture emits this only AFTER all native assertions have passed.
    clearTimeout(timer);
    console.log("M04_NATIVE_RUNNER_PASS: native fixture completed; killing stale Electron process");
    finish(0);
  }
}
child.stdout.on("data", data => scan(data, process.stdout));
child.stderr.on("data", data => scan(data, process.stderr));
child.on("error", error => {
  clearTimeout(timer);
  finish(1, "M04 native runner failed to start: " + error.message);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (!finished) finish(code === 0 && output.includes("M04_NATIVE_E2E_PASS:") ? 0 : 1,
    "M04 Electron fixture exited before verified PASS (" + code + "/" + signal + ")");
});
