#!/usr/bin/env node
// MCP server that drives the REAL native Tauri desktop app — the actual
// compiled binary in its WebKitGTK webview, talking to the real Rust IPC
// bridge and real SQLite/libSQL database — as a second testing surface
// alongside the Playwright MCP, which only ever reaches a browser tab
// running the Vite dev-server preview against a mocked IPC layer
// (src/lib/devInvoke.ts). That mock has repeatedly hidden real bugs (wrong
// Tauri command names, missing required args) that only surface against
// the real backend; this exists to catch those directly instead.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { DriverManager, APP_BINARY_PATH, TAURI_DRIVER_PORT } from "./driver-manager.js";
import { WebDriverClient } from "./webdriver-client.js";

const manager = new DriverManager();
const client = new WebDriverClient(`http://127.0.0.1:${TAURI_DRIVER_PORT}`);

const server = new McpServer({ name: "mcp-native-driver", version: "1.0.0" });

server.registerTool(
  "native_start",
  {
    title: "Start the real native app",
    description:
      "Launches the real Tauri desktop app (target/debug/mise) in its actual WebKitGTK window via tauri-driver, " +
      "and starts the Vite dev server if it isn't already running (the debug build's webview loads its frontend " +
      "from http://localhost:1420, per src-tauri/tauri.conf.json's devUrl — it has nothing to show without it). " +
      "Call this once before native_evaluate/native_screenshot. Safe to call again if a previous session died; " +
      "it reuses a running driver and only opens a fresh session. The FIRST call in a session is slow (~15-25s) — " +
      "nix-shell has no persistent evaluation cache between invocations, so spinning up tauri-driver inside it pays " +
      "a real, unavoidable cold-start cost every time the driver process itself is (re)started. Subsequent calls " +
      "(after a session closes but the driver process is still alive) are fast.",
    inputSchema: {
      rebuild: z
        .boolean()
        .optional()
        .describe("Run `cargo build --bin mise` first, even if a debug binary already exists. Use after changing Rust code."),
    },
  },
  async ({ rebuild }) => {
    await manager.ensureBuilt(rebuild ?? false);
    // Independent processes — no need to wait for Vite before spinning up
    // tauri-driver (whose own nix-shell cold start is the slow part, ~10s).
    await Promise.all([manager.ensureViteRunning(), manager.ensureDriverRunning()]);
    let sessionId: string;
    try {
      ({ sessionId } = await client.newSession(APP_BINARY_PATH));
    } catch (e) {
      // Most likely a stuck session an earlier crashed run left open —
      // WebDriver has no way to clear that short of restarting the driver.
      // One automatic retry against a clean driver before surfacing anything.
      await manager.forceRestartDriver();
      ({ sessionId } = await client.newSession(APP_BINARY_PATH));
    }
    // The debug binary loads about:blank until pointed at the dev server —
    // navigate explicitly rather than relying on load timing.
    await client.navigate("http://localhost:1420");
    await new Promise((r) => setTimeout(r, 500));
    const title = await client.evaluate<string>("return document.title;");
    const hasTauri = await client.evaluate<boolean>('return "__TAURI_INTERNALS__" in window;');
    return {
      content: [
        {
          type: "text",
          text: `Native app started. session=${sessionId} title=${JSON.stringify(title)} realTauriBridge=${hasTauri}`,
        },
      ],
    };
  },
);

server.registerTool(
  "native_evaluate",
  {
    title: "Run JavaScript in the native webview",
    description:
      "Executes `script` inside the real app's webview and returns its value as JSON. Write it like the body of an " +
      "async function — `return` a value, or use `await` freely (e.g. `await window.__TAURI__` is NOT exposed — " +
      "withGlobalTauri is disabled for security — so drive the UI itself: dispatch click/input/keydown events on " +
      "real elements, same as the app's own React handlers expect, then read results back via document queries). " +
      "This is the main tool: click buttons, fill React-controlled inputs (use the native input value setter before " +
      "dispatching an 'input' event, not `.value =` directly), and inspect state, exactly like Playwright's evaluate() " +
      "is already used for the browser-mock preview elsewhere in this project.",
    inputSchema: {
      script: z.string().describe("JavaScript source, run as the body of an async function in the webview's page context."),
    },
  },
  async ({ script }) => {
    const value = await client.evaluate(script);
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
  },
);

server.registerTool(
  "native_screenshot",
  {
    title: "Screenshot the native window",
    description: "Captures the real app window as a PNG and saves it to `path`. Returns the path to Read.",
    inputSchema: {
      path: z.string().describe("Absolute file path to write the PNG to."),
    },
  },
  async ({ path: outPath }) => {
    const base64 = await client.screenshot();
    await writeFile(outPath, Buffer.from(base64, "base64"));
    return { content: [{ type: "text", text: `Saved screenshot to ${outPath}` }] };
  },
);

server.registerTool(
  "native_close",
  {
    title: "Close the native app window",
    description:
      "Ends the WebDriver session, which closes the app window (tauri-driver kills the app process with it). " +
      "Leaves tauri-driver itself and the Vite dev server running, so the next native_start reuses them and skips " +
      "the ~15-25s nix-shell cold start — call native_shutdown instead if you actually want to stop everything.",
    inputSchema: {},
  },
  async () => {
    await client.close();
    return { content: [{ type: "text", text: "App window closed. tauri-driver is still running for a fast restart." }] };
  },
);

server.registerTool(
  "native_shutdown",
  {
    title: "Stop tauri-driver and the Vite dev server",
    description:
      "Full teardown: closes any open session, stops tauri-driver/WebKitWebDriver, and stops the Vite dev server " +
      "if this MCP server started it. Call this when done testing for the session, not between individual checks.",
    inputSchema: {},
  },
  async () => {
    await client.close();
    await manager.shutdown();
    return { content: [{ type: "text", text: "Shut down." }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on("SIGINT", async () => {
  await client.close().catch(() => {});
  await manager.shutdown().catch(() => {});
  process.exit(0);
});

main().catch((err) => {
  console.error("mcp-native-driver failed to start:", err);
  process.exit(1);
});
