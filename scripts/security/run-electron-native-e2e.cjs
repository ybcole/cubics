"use strict";

// On GitHub-hosted runners, Electron sometimes stays alive after all
// assertions, so a supervised child is killed ONLY on its explicit PASS
// marker. Run separate OS processes against the SAME isolated userData
// profile to prove persistence and Shared-data non-persistence on restart.
const { spawn, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const net = require("node:net");
const path = require("node:path");
const electron = require("electron");
const windows = process.platform === "win32";
const deviceProfile = "native-e2e-" + process.pid.toString(36) + "-" +
  crypto.randomBytes(4).toString("hex");

// Persistent site storage is keyed by the full origin, including TCP port.
async function allocateTestPort() {
  const listener=net.createServer();
  await new Promise((resolve,reject)=>{listener.once("error",reject);listener.listen(0,"127.0.0.1",resolve)});
  const port=listener.address().port;
  await new Promise((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));
  return port;
}
function runFixture(relative, successMarker, port) {
  return new Promise((resolve, reject) => {
    const fixture = path.resolve(__dirname, relative);
    const env = { ...process.env, CUBICS_TEST_PROFILE: deviceProfile,
      CUBICS_TEST_PORT:String(port) };
    // Linux's xvfb-run wraps THIS supervisor, not each Electron child.
    // Direct child process groups allow deterministic cleanup and avoid
    // leftover Electron SingletonLock / Xvfb display races on restart.
    const child = spawn(electron, [fixture], {
      stdio: ["ignore", "pipe", "pipe"], detached: !windows, env,
    });
    let finished = false, output = "", fixturePid = null;
    function stopTree() {
      if (!child.pid) return;
      if (process.platform === "linux") {
        // Chromium can move its browser process outside the xvfb wrapper
        // process group. Collect direct and transitive children BEFORE kill.
        try {
          const rows = execFileSync("ps", ["-eo", "pid=,ppid="], {
            encoding: "utf8", timeout: 3000,
          }).trim().split("\n").map(row => row.trim().split(/\s+/).map(Number));
          const descendants = [];
          const scan = pid => {
            for (const [childPid, parentPid] of rows) {
              if (parentPid === pid && childPid !== process.pid && !descendants.includes(childPid)) {
                descendants.push(childPid);
                scan(childPid);
              }
            }
          };
          scan(child.pid);
          if (fixturePid && fixturePid !== process.pid && !descendants.includes(fixturePid)) {
            descendants.push(fixturePid);
          }
          for (const pid of descendants.reverse()) {
            try { process.kill(pid, "SIGKILL"); } catch {}
          }
        } catch (error) {
          console.error("M05 Linux descendant cleanup warning:", error?.message);
        }
      }
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
      const conclude = () => {
        stopTree();
        // Do not launch next process until the old app lock is released.
        setTimeout(() => {
          if (error) reject(error);
          else resolve();
        }, 1600);
      };
      if (!error && windows) {
        // Give Windows DPAPI/key-store app shutdown a chance to flush after
        // the PASS marker. This test must verify a normal restart, not a
        // forced crash recovery with an unflushed async encryption key.
        const timer = setTimeout(conclude, 3000);
        child.once("exit", () => { clearTimeout(timer); conclude(); });
      } else {
        conclude();
      }
    }
    function inspect(data, stream) {
      const chunk = String(data);
      stream.write(chunk);
      output = (output + chunk).slice(-120_000);
      const pidMatch = output.match(/M0[45]_(?:NATIVE|RESTART)_FIXTURE_PID:(\d+)/);
      if (pidMatch) fixturePid = Number(pidMatch[1]);
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
  const port=await allocateTestPort();
  await runFixture("electron-native-e2e.cjs", "M04_NATIVE_E2E_PASS:",port);
  console.log("M04_NATIVE_RUNNER_PASS: security fixture complete; now verifying OS process restart");
  await runFixture("electron-profile-restart-e2e.cjs", "M05_RESTART_E2E_PASS:",port);
  console.log("M05_RESTART_MATRIX_PASS: both native processes completed and storage boundaries persisted");
})().catch(error => {
  console.error("M05_NATIVE_RUNNER_FAIL:", error?.stack || String(error));
  process.exitCode = 1;
});
