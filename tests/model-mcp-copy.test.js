import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("model publishing token guidance reflects the live write workflow", () => {
  const modal = readFileSync(new URL("../src/components/McpTokensModal.vue", import.meta.url), "utf8");
  assert.match(modal, /已开放受限的渠道、计费、真实探针与分阶段上架工具/);
  assert.match(modal, /供应商密钥仅通过一次性 HTTPS 上传/);
  assert.doesNotMatch(modal, /写工具尚未开放/);
});
