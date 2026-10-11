import assert from "node:assert/strict";
import test from "node:test";

test("theme toggle updates the document, browser color and saved preference", async () => {
  const attributes = new Map();
  const saved = new Map();
  let onStorage;
  globalThis.document = {
    documentElement: { dataset: { theme: "dark" } },
    createElement: () => ({}),
    querySelector: () => ({ setAttribute: (key, value) => attributes.set(key, value) }),
  };
  globalThis.localStorage = { setItem: (key, value) => saved.set(key, value) };
  globalThis.window = { addEventListener: (_name, handler) => { onStorage = handler; } };

  const { theme, toggleTheme } = await import("../src/theme.js");
  toggleTheme();
  assert.equal(theme.value, "light");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(attributes.get("content"), "#eef2ef");
  assert.equal(saved.get("verdantflare_theme"), "light");

  onStorage({ key: "verdantflare_theme", newValue: "dark" });
  assert.equal(theme.value, "dark");
  assert.equal(attributes.get("content"), "#0b0f0c");
});
