// Manages the two long-lived processes a WebDriver session against the real
// Tauri app needs: the Vite dev server (the app's debug build has
// devUrl=http://localhost:1420 baked in, per src-tauri/tauri.conf.json —
// the webview loads nothing without it) and tauri-driver itself (which in
// turn launches the app binary as its own child once a session opens).
//
// Both must run inside the project's nix-shell: shell.nix sets up
// LD_LIBRARY_PATH for GTK/WebKit and, critically, sources nixGLIntel's
// Mesa/EGL/Intel-driver env vars — without them WebKitGTK aborts with
// EGL_BAD_PARAMETER before a window ever appears (documented in the
// project's own shell.nix comments). Spawning tauri-driver via `nix-shell
// --run` carries that environment through to the app process it launches.

import { spawn, type ChildProcess } from "node:child_process";
import { openSync, existsSync, readdirSync } from "node:fs";
import { tmpdir, homedir, userInfo } from "node:os";
import net from "node:net";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const TAURI_DRIVER_BIN = path.join(process.env.HOME ?? "", ".cargo", "bin", "tauri-driver");
const WEBKIT_WEBDRIVER_BIN = path.join(process.env.HOME ?? "", ".nix-profile", "bin", "WebKitWebDriver");
export const APP_BINARY_PATH = path.join(REPO_ROOT, "target", "debug", "mise");
export const TAURI_DRIVER_PORT = 4444;
export const VITE_PORT = 1420;

// Every spawned child below writes its stdio to a log FILE, never a plain
// Node "pipe" left undrained. A pipe's OS buffer is small (~64KB on Linux);
// once a real app session starts producing verbose WebKitGTK/GStreamer
// startup logs, an unconsumed pipe fills and the child blocks forever on
// write() — which looks exactly like a hung WebDriver session from the
// outside (confirmed live: this, not a stuck session, was the actual cause
// of a `newSession` that never returned even against a freshly restarted
// driver with nothing else running).
function logFile(name: string): number {
  return openSync(path.join(tmpdir(), `mcp-native-driver-${name}.log`), "a");
}

// GTK's own init (via tao/wry) needs a real X11/Wayland display AND a
// valid auth cookie to attach to — without either, the app crashes
// immediately ("Failed to initialize GTK" / "Authorization required, but
// no authorization protocol specified"), which reads exactly like a hung
// WebDriver session from the caller's side (the whole request just never
// returns, since tauri-driver is still waiting on an app that already
// died).
//
// child_process.spawn inherits process.env by default, but that's not
// enough here: whatever spawns THIS server (StdioClientTransport in the
// MCP SDK, and very likely any real MCP client for the same reason — it's
// standard practice, "inspired by the default env inheritance of sudo")
// only forwards a fixed allowlist of vars, and DISPLAY/XAUTHORITY aren't
// on it. Confirmed live: process.env.DISPLAY and .XAUTHORITY are both
// genuinely absent inside this process when launched that way, even
// though a plain `node -e` invocation from an interactive shell sees them
// fine. DISPLAY gets a same-machine-single-display fallback; XAUTHORITY's
// value is session-specific (a randomly-suffixed file, e.g. this
// machine's Wayland/Mutter session uses
// /run/user/<uid>/.mutter-Xwaylandauth.XXXXXX, regenerated on every login)
// so it's discovered from disk instead of guessed.
function findXauthority(): string | undefined {
  if (process.env.XAUTHORITY && existsSync(process.env.XAUTHORITY)) return process.env.XAUTHORITY;
  const classic = path.join(homedir(), ".Xauthority");
  if (existsSync(classic)) return classic;
  const runtimeDir = `/run/user/${userInfo().uid}`;
  try {
    const match = readdirSync(runtimeDir).find((f) => /auth/i.test(f));
    if (match) return path.join(runtimeDir, match);
  } catch {
    // runtimeDir unreadable — fall through with nothing found
  }
  return undefined;
}

function spawnEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ":0",
    XAUTHORITY: findXauthority() ?? process.env.XAUTHORITY ?? "",
  };
}

async function waitForPort(port: number, timeoutMs: number, processToWatch?: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processToWatch && processToWatch.exitCode !== null) {
      throw new Error(`process exited (code ${processToWatch.exitCode}) before port ${port} opened`);
    }
    const ready = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.end(); resolve(true); });
      socket.once("error", () => { socket.destroy(); resolve(false); });
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nothing listening on port ${port} after ${timeoutMs}ms`);
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.end(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
  });
}

export class DriverManager {
  private viteProcess: ChildProcess | null = null;
  private viteStartedByUs = false;
  private driverProcess: ChildProcess | null = null;

  async ensureBuilt(rebuild: boolean): Promise<void> {
    const exists = await import("node:fs/promises")
      .then((fs) => fs.access(APP_BINARY_PATH))
      .then(() => true)
      .catch(() => false);
    if (exists && !rebuild) return;
    const log = path.join(tmpdir(), "mcp-native-driver-build.log");
    await new Promise<void>((resolve, reject) => {
      const build = spawn("nix-shell", ["--run", "cargo build --bin mise"], {
        cwd: REPO_ROOT,
        env: spawnEnv(),
        stdio: ["ignore", logFile("build"), logFile("build")],
      });
      build.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`cargo build failed (exit ${code}) — see ${log}`));
      });
    });
  }

  async ensureViteRunning(): Promise<void> {
    if (await isPortOpen(VITE_PORT)) return;
    this.viteProcess = spawn("npm", ["run", "dev"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", logFile("vite"), logFile("vite")],
      detached: false,
    });
    this.viteStartedByUs = true;
    await waitForPort(VITE_PORT, 20_000, this.viteProcess);
  }

  async ensureDriverRunning(): Promise<void> {
    // Something else (a previous, now-orphaned server instance — this
    // manager has no memory across separate `node dist/index.js` runs) may
    // already be listening on the port. Use it rather than racing a second
    // tauri-driver to bind the same port, which fails silently from here:
    // waitForPort only checks that *a* listener exists, so a doomed second
    // process and a stale-but-working first one are indistinguishable
    // without this check.
    if (await isPortOpen(TAURI_DRIVER_PORT)) return; // not ours to kill later — native_shutdown will leave it running
    this.driverProcess = spawn(
      "nix-shell",
      ["--run", `${TAURI_DRIVER_BIN} --port ${TAURI_DRIVER_PORT} --native-driver ${WEBKIT_WEBDRIVER_BIN}`],
      { cwd: REPO_ROOT, env: spawnEnv(), stdio: ["ignore", logFile("driver"), logFile("driver")] },
    );
    await waitForPort(TAURI_DRIVER_PORT, 30_000, this.driverProcess);
  }

  /**
   * Kills whatever is listening on tauri-driver's ports AND any orphaned
   * app instance, regardless of who started either, and spins up a fresh
   * driver. For recovering from a stuck session an earlier crashed run
   * left behind — WebDriver has no "list/reset sessions" endpoint to clear
   * that state more surgically.
   *
   * Killing the driver alone isn't enough: a `newSession` that times out
   * client-side still leaves the app process it spawned running server-side
   * (tauri-driver has no reason to kill it — nothing told it the caller gave
   * up). That orphaned process keeps holding the real mise.db file, and a
   * fresh app instance started by the next attempt hangs indefinitely
   * waiting on it (this app's SQLite/libSQL setup has no working
   * busy_timeout in local mode — see the project's own concurrency notes).
   * Confirmed live: exactly this orphan was why a driver-only restart still
   * hung on retry.
   */
  async forceRestartDriver(): Promise<void> {
    this.driverProcess = null;
    const killByPattern = (pattern: string) =>
      new Promise<void>((resolve) => {
        const kill = spawn("pkill", ["-9", "-f", pattern], { stdio: "ignore" });
        kill.on("exit", () => resolve());
        kill.on("error", () => resolve()); // nothing matched — fine
      });
    await Promise.all([
      killByPattern("tauri-driver"),
      killByPattern("WebKitWebDriver"),
      killByPattern(APP_BINARY_PATH),
    ]);
    await new Promise((r) => setTimeout(r, 500));
    await this.ensureDriverRunning();
  }

  /** Stops everything this manager started. Leaves a Vite server alone if it was already running before us. */
  async shutdown(): Promise<void> {
    if (this.driverProcess) {
      this.driverProcess.kill();
      this.driverProcess = null;
    }
    if (this.viteProcess && this.viteStartedByUs) {
      this.viteProcess.kill();
      this.viteProcess = null;
    }
  }
}
