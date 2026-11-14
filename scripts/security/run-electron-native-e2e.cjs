"use strict";

// On GitHub-hosted runners, Electron sometimes stays alive after all
// assertions, so a supervised child is killed ONLY on its explicit PASS
// marker. Run separate OS processes against the SAME isolated userData
// profile to prove persistence and Shared-data non-persistence on restart.
const { spawn, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");
const electron = require("electron");
const windows = process.platform === "win32";
const linux = process.platform === "linux";
const deviceProfile = "native-e2e-" + process.pid.toString(36) + "-" +
  crypto.randomBytes(4).toString("hex");

function runFixture(relative, successMarker) {
  return new Promise((resolve, reject) => {
    const fixture = path.resolve(__dirname, relative);
    const env = { ...process.env, CUBICS_TEST_PROFILE: deviceProfile };
    const child = linux
      ? spawn("xvfb-run", ["--auto-servernum", "--server-args=-screen 0 1280x800x24", electron, fixture],
          { stdio: ["ignore", "pipe", "pipe"], detached: true, env })
      : spawn(electron, [fixture],
          { stdio: ["ignore", "pipe", "pipe"], detached: !windows, env });
    let finished = false, output = "";
    function stopTree() {
      if (!child.pid) return;
      if (windows) {
        try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"],
          { stdio: "ignore", timeout: 8000 }); }
        catch { try { child.kill("SIGKILL"); } catch {} }
      } else {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch { try { child.kill("SIGKILL"); } catch {} }
      }
    }
    const timer = setTimeout(() => finish(new Error(relative + " timed out without " + successMarker)), 90_000);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stopTree();
      // killTree is asynchronous on some Linux/Xvfb and Windows runners.
      // Do not launch the next Electron process while the old app lock can
      // still exist. Leave the native test process ample shutdown time.
      setTimeout(() => {
        if (error) reject(error);
        else resolve();
      }, 1600);
    }
    function inspect(data, stream) {
      const chunk = String(data);
      stream.write(chunk);
      output = (output + chunk).slice(-120_000);
      if (output.includes("M04_NATIVE_E2E_FAIL:") ||
          output.includes("M05_RESTART_E2E_FAIL:")) {
        finish(new Error("Native fixture assertion failed: " + relative));
      } else if (output.includes(successMarker)) {
        finish(null);
      }
    }
    child.stdout.on("data", data => inspect(data, process.stdout));
    child.stderr.on("data", data => inspect(data, process.stderr));
    child.on("error", error => finish(error));
    child.on("exit", (code, signal) => {
      if (!finished) finish(new Error(relative + " exited without PASS: " + code + "/" + signal));
    });
  });
}
(async () => {
  await runFixture("electron-native-e2e.cjs", "M04_NATIVE_E2E_PASS:");
  console.log("M04_NATIVE_RUNNER_PASS: security fixture complete; now verifying OS process restart");
  await runFixture("electron-profile-restart-e2e.cjs", "M05_RESTART_E2E_PASS:");
  console.log("M05_RESTART_MATRIX_PASS: both native processes completed and storage boundaries persisted");
})().catch(error => {
  console.error("M05_NATIVE_RUNNER_FAIL:", error?.stack || String(error));
  process.exitCode = 1;
});
