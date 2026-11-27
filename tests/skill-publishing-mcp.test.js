import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listMcpToolNames } from "../src/api/mcpTools.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("skill tokens point AI tools at the separate skill publishing MCP", () => {
  const modal = read("../src/components/McpTokensModal.vue");
  assert.match(modal, /skill_publish: \{ path: "\/skill-publishing\/mcp"/);
  assert.match(modal, /app_publish: \{ path: "\/mcp"/);
  assert.match(modal, /model_publish: \{ path: "\/mcp"/);
  assert.match(modal, /此令牌不能用于应用／模型 MCP/);
});

test("the skill release page has no manual upload and issues skill tokens", () => {
  const view = read("../src/views/SkillCatalogAdminView.vue");
  const api = read("../src/api/control.js");
  assert.doesNotMatch(view, /type="file"|uploadSkillRelease|上传发行包/);
  assert.doesNotMatch(api, /uploadSkillRelease/);
  assert.match(view, /<McpTokensModal v-model="showMcpTokens" purpose="skill_publish"/);
  assert.match(view, /publishSkillRelease\(release\.releaseId, release\.archiveSha256\)/);
});

test("skill tool check keeps only skill publishing tools", async () => {
  const names = await listMcpToolNames("https://hub.example.test/skill-publishing/mcp", "secret-test", async () => ({
    ok: true,
    json: async () => ({ result: { tools: [{ name: "skill_publish.register" }, { name: "model_publish.get" }, { name: "skill_publish.publish" }] } }),
  }), "skill_publish.");
  assert.deepEqual(names, ["skill_publish.register", "skill_publish.publish"]);
});

test("skill publishing pages follow the app publishing layout", () => {
  const list = read("../src/views/SkillCatalogAdminView.vue");
  const detail = read("../src/views/SkillDetailView.vue");
  const app = read("../src/App.vue");
  const api = read("../src/api/control.js");
  assert.match(list, /新建技能资料/);
  assert.match(list, /NEW SKILL RECORD/);
  assert.match(list, /controlApi\.createManagedSkill\(/);
  assert.match(list, /navigate\(`\/ops\/skills\/\$\{encodeURIComponent\(entry\.entryId\)\}`\)/);
  assert.match(api, /createManagedSkill: \(payload\) => request\("\/ops\/v2\/skills", \{ method: "POST"/);
  assert.match(app, /path\.startsWith\("\/ops\/skills\/"\) && canManageSkills\.value\) return \{ component: SkillDetailView/);
  assert.match(detail, /第一步 · 技能目录资料/);
  assert.match(detail, /第二步 · 技能发行/);
  assert.match(detail, /patchManagedSkill\(id, .*record\.value\.revision\)/);
  assert.doesNotMatch(detail, /type="file"|publishSkillRelease/);
});
