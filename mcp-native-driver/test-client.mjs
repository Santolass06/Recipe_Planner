// Ad-hoc manual test: drives this MCP server exactly as a real MCP client
// would (stdio transport, tools/list, tools/call), to verify it before
// trusting it in a real session. Not part of the shipped server.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
});
const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name));

console.log("\n=== native_start ===");
const start = await client.callTool({ name: "native_start", arguments: {} }, undefined, { timeout: 90_000 });
console.log(start.content[0].text);

console.log("\n=== native_evaluate: title/path/hasTauri ===");
const evalResult = await client.callTool({
  name: "native_evaluate",
  arguments: {
    script: `return { title: document.title, path: location.pathname, hasTauri: "__TAURI_INTERNALS__" in window };`,
  },
});
console.log(evalResult.content[0].text);

console.log("\n=== native_evaluate: click Ingredientes, read rows ===");
const clickResult = await client.callTool({
  name: "native_evaluate",
  arguments: {
    script: `
      const link = [...document.querySelectorAll("a")].find(a => a.textContent.includes("Ingredientes"));
      link.click();
      await new Promise(r => setTimeout(r, 500));
      return { path: location.pathname, rows: document.querySelectorAll("tbody tr").length };
    `,
  },
});
console.log(clickResult.content[0].text);

console.log("\n=== native_screenshot ===");
const shot = await client.callTool({
  name: "native_screenshot",
  arguments: { path: "/tmp/claude-1000/-home-andresantos-Secret-ria-RustProjects-Recipe-Planner/209e8c85-367e-41b7-96d1-8fa7106d9477/scratchpad/native-test.png" },
});
console.log(shot.content[0].text);

console.log("\n=== native_close ===");
const closeResult = await client.callTool({ name: "native_close", arguments: {} });
console.log(closeResult.content[0].text);

console.log("\n=== native_start again (should be fast, driver still warm) ===");
const t0 = Date.now();
const start2 = await client.callTool({ name: "native_start", arguments: {} }, undefined, { timeout: 30_000 });
console.log(`(${Date.now() - t0}ms) ` + start2.content[0].text);

console.log("\n=== native_shutdown ===");
const shutdownResult = await client.callTool({ name: "native_shutdown", arguments: {} });
console.log(shutdownResult.content[0].text);

await client.close();
process.exit(0);
