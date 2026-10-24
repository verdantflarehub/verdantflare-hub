import test from "node:test";
import assert from "node:assert/strict";
import { listMcpToolNames } from "../src/api/mcpTools.js";

test("model tool check sends the bearer only to the MCP endpoint and returns names", async () => {
  const calls = [];
  const names = await listMcpToolNames("https://hub.example.test/mcp", "secret-test", async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ result: { tools: [
        { name: "model_publish.get", inputSchema: { secret: "must-not-render" } },
        { name: "app_publish.get" },
        { name: "model_publish.publish" },
      ] } }),
    };
  });
  assert.deepEqual(names, ["model_publish.get", "model_publish.publish"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hub.example.test/mcp");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-test");
  assert.equal(JSON.parse(calls[0].options.body).method, "tools/list");
  assert.doesNotMatch(calls[0].options.body, /secret-test/);
});

test("model tool check reports authorization failure without exposing a token", async () => {
  await assert.rejects(
    listMcpToolNames("https://hub.example.test/mcp", "secret-test", async () => ({ ok: false, status: 401 })),
    (error) => error.message === "MCP 工具发现失败（HTTP 401）",
  );
});

test("model tool check rejects malformed responses", async () => {
  await assert.rejects(
    listMcpToolNames("https://hub.example.test/mcp", "secret-test", async () => ({ ok: true, json: async () => ({ result: {} }) })),
    /无效工具清单/,
  );
});
