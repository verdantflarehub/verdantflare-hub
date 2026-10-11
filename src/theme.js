import { ref } from "vue";

const storageKey = "verdantflare_theme";
export const theme = ref(document.documentElement.dataset.theme === "light" ? "light" : "dark");

const applyTheme = (value) => {
  theme.value = value;
  document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "light" ? "#eef2ef" : "#0b0f0c");
};

export const toggleTheme = () => {
  const next = theme.value === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(storageKey, next); } catch { /* theme still applies for this visit */ }
};

window.addEventListener("storage", (event) => {
  if (event.key === storageKey && (event.newValue === "light" || event.newValue === "dark")) {
    applyTheme(event.newValue);
  }
});
