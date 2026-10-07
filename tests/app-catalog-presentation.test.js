import assert from "node:assert/strict";
import test from "node:test";
import { appCardActions, appCardTags, catalogStatus } from "../src/utils/appCatalogPresentation.js";

test("application cards only open details, regardless of catalog channel or entitlement", () => {
  for (const channel of ["Listed", "Preview", "Stable"]) {
    const app = { id: "comfyui/demo", category: "创作", channel, entitled: true, gpu: "GPU" };
    assert.deepEqual(appCardActions(app), [
      { label: "查看详情", to: "/market/apps/comfyui%2Fdemo", primary: true },
    ]);
    assert.equal(catalogStatus(app), channel === "Listed" ? "资料已收录" : "目录版本已发布");
    assert.equal(appCardTags(app).includes("组织已授权"), channel !== "Listed");
  }
});
