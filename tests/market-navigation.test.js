import assert from "node:assert/strict";
import test from "node:test";
import {
  marketAppIdFromPath,
  marketFiltersForCatalog,
  marketHistoryStateForNavigation,
  readMarketListState,
  readMarketReturnState,
  resolvedMarketAppId,
  withMarketListState,
} from "../src/utils/marketNavigation.js";

const listContext = { organizationId: "org-a", search: "comfy", category: "创作", scrollY: 640 };

test("list state preserves other history fields and restores only for the same organization", () => {
  const state = withMarketListState({ unrelated: "kept" }, listContext);
  assert.equal(state.unrelated, "kept");
  assert.deepEqual(readMarketListState(state, "org-a"), listContext);
  assert.equal(readMarketListState(state, "org-b"), null);
  assert.equal(readMarketListState(state, undefined), null);
  assert.equal(readMarketListState(null, "org-a"), null);
});

test("opening a detail carries a return context without catalog data or unrelated history state", () => {
  const state = withMarketListState({ secret: "not-carried" }, { ...listContext, apps: ["not-cached"] });
  const detailState = marketHistoryStateForNavigation("/market", "/market/apps/comfyui", state);
  assert.deepEqual(readMarketReturnState(detailState, "org-a"), listContext);
  assert.equal(readMarketReturnState(detailState, "org-b"), null);
  assert.equal(readMarketListState(detailState, "org-a"), null);
  assert.deepEqual(Object.keys(detailState), ["vfMarketReturn"]);
});

test("new list visits and detail deep links cannot inherit a stale list context", () => {
  const state = withMarketListState({}, listContext);
  for (const [from, to] of [["/", "/market/apps/comfyui"], ["/market/apps/other", "/market/apps/comfyui"], ["/market/apps/comfyui", "/market"], ["/market", "/settings/profile"]]) {
    assert.deepEqual(marketHistoryStateForNavigation(from, to, state), {});
  }
  assert.deepEqual(marketHistoryStateForNavigation("/market", "/market/apps/comfyui", null), {});
  assert.equal(readMarketReturnState(null, "org-a"), null);
});

test("history navigation does not mutate the original list entry", () => {
  const state = withMarketListState({}, listContext);
  const detailState = marketHistoryStateForNavigation("/market", "/market/apps/comfyui", state);
  const original = readMarketListState(state, "org-a");
  const returned = readMarketReturnState(detailState, "org-a");
  assert.deepEqual(original, returned);
  returned.search = "changed";
  assert.deepEqual(readMarketListState(state, "org-a"), listContext);
});

test("missing categories reset the category and scroll but preserve the search", () => {
  assert.deepEqual(marketFiltersForCatalog(listContext, ["全部", "工具"]), { search: "comfy", category: "全部", scrollY: 0 });
  assert.deepEqual(marketFiltersForCatalog(listContext, ["全部", "创作"]), { search: "comfy", category: "创作", scrollY: 640 });
  assert.deepEqual(marketFiltersForCatalog(null, ["全部"]), { search: "", category: "全部", scrollY: 0 });
});

test("malformed history values cannot inject invalid filter or scroll values", () => {
  const state = withMarketListState({}, { organizationId: "org-a", search: {}, category: null, scrollY: Infinity });
  assert.deepEqual(readMarketListState(state, "org-a"), { organizationId: "org-a", search: "", category: "全部", scrollY: 0 });
  assert.equal(readMarketListState(withMarketListState({}, { ...listContext, scrollY: -20 }), "org-a").scrollY, 0);
});

test("application paths decode encoded IDs and tolerate invalid percent sequences", () => {
  assert.equal(marketAppIdFromPath("/market/apps/comfyui%2Fdemo"), "comfyui/demo");
  assert.equal(marketAppIdFromPath("/market/apps/%E5%88%9B%E4%BD%9C"), "创作");
  assert.equal(marketAppIdFromPath("/market/apps/bad%ZZ"), "bad%ZZ");
  assert.equal(marketAppIdFromPath("/market"), "");
});

test("Blender legacy link follows the canonical catalog record only after migration", () => {
  assert.equal(resolvedMarketAppId("blender-mcp", [{ id: "blender-mcp" }]), "blender-mcp");
  assert.equal(resolvedMarketAppId("blender-mcp", [{ id: "blender" }]), "blender");
  assert.equal(resolvedMarketAppId("comfyui", [{ id: "blender" }]), "comfyui");
});

test("router navigation carries a detail return context and browser back retains the original list entry", async () => {
  const originalWindow = globalThis.window;
  const events = new Map();
  const entries = [{ url: "/market", state: withMarketListState({}, listContext) }];
  let index = 0;
  const location = { pathname: "/market", search: "", origin: "https://hub.example.test" };
  const applyLocation = () => {
    const url = new URL(entries[index].url, location.origin);
    location.pathname = url.pathname;
    location.search = url.search;
  };
  globalThis.window = {
    location,
    scrollTo() {},
    addEventListener(name, handler) { events.set(name, handler); },
    history: {
      get state() { return entries[index].state; },
      pushState(state, _title, url) {
        entries.splice(index + 1);
        entries.push({ url, state });
        index += 1;
        applyLocation();
      },
      replaceState(state, _title, url) {
        entries[index] = { url, state };
        applyLocation();
      },
      back() {
        index -= 1;
        applyLocation();
        events.get("popstate")();
      },
    },
  };
  try {
    const { navigate, replace, currentPath } = await import("../src/router.js");
    navigate("/market/apps/comfyui");
    assert.equal(currentPath.value, "/market/apps/comfyui");
    assert.deepEqual(readMarketReturnState(window.history.state, "org-a"), listContext);
    replace("/market/apps/blender?q=legacy");
    assert.equal(currentPath.value, "/market/apps/blender");
    assert.equal(entries.length, 2);
    assert.deepEqual(readMarketReturnState(window.history.state, "org-a"), listContext);
    window.history.back();
    assert.equal(currentPath.value, "/market");
    assert.deepEqual(readMarketListState(window.history.state, "org-a"), listContext);
    navigate("/settings/profile");
    navigate("/market/apps/comfyui");
    assert.equal(readMarketReturnState(window.history.state, "org-a"), null);
  } finally {
    globalThis.window = originalWindow;
  }
});
