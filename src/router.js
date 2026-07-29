import { readonly, ref } from "vue";

const normalizePath = (value) => {
  const path = (value || "/").split("?")[0].replace(/\/+$/, "");
  return path || "/";
};

const path = ref(normalizePath(window.location.pathname));
const search = ref(window.location.search);

window.addEventListener("popstate", () => {
  path.value = normalizePath(window.location.pathname);
  search.value = window.location.search;
  window.scrollTo({ top: 0, behavior: "instant" });
});

export const currentPath = readonly(path);
export const currentSearch = readonly(search);

export const navigate = (target) => {
  const url = new URL(target, window.location.origin);
  const next = normalizePath(url.pathname);
  if (next === path.value && url.search === search.value) return;
  window.history.pushState({}, "", `${next}${url.search}${url.hash}`);
  path.value = next;
  search.value = url.search;
  window.scrollTo({ top: 0, behavior: "instant" });
};

export const isPathActive = (href, exact = false) => {
  if (exact) return path.value === href;
  return path.value === href || path.value.startsWith(`${href}/`);
};
