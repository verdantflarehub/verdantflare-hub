const LIST_STATE = "vfMarketList";
const RETURN_STATE = "vfMarketReturn";

const validContext = (value, organizationId) => {
  if (!organizationId || value?.organizationId !== organizationId) return null;
  return {
    organizationId,
    search: typeof value.search === "string" ? value.search : "",
    category: typeof value.category === "string" && value.category ? value.category : "全部",
    scrollY: Number.isFinite(value.scrollY) ? Math.max(0, value.scrollY) : 0,
  };
};

export const readMarketListState = (state, organizationId) => validContext(state?.[LIST_STATE], organizationId);

export const readMarketReturnState = (state, organizationId) => validContext(state?.[RETURN_STATE], organizationId);

export const withMarketListState = (state, context) => ({
  ...state,
  [LIST_STATE]: validContext(context, context.organizationId),
});

export const marketFiltersForCatalog = (context, categories) => {
  const validCategory = !context || categories.includes(context.category);
  return {
    search: context?.search || "",
    category: validCategory ? context?.category || "全部" : "全部",
    scrollY: validCategory ? context?.scrollY || 0 : 0,
  };
};

// Carry only UI state from the immediately preceding list, never catalog or entitlement data.
export const marketHistoryStateForNavigation = (from, to, state) => {
  if (from !== "/market" || !to.startsWith("/market/apps/")) return {};
  const context = readMarketListState(state, state?.[LIST_STATE]?.organizationId);
  return context ? { [RETURN_STATE]: context } : {};
};

export const marketAppIdFromPath = (path) => {
  if (!path?.startsWith("/market/apps/")) return "";
  const id = path.slice("/market/apps/".length);
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
};

export const resolvedMarketAppId = (id, apps) => {
  const canonical = { "blender-mcp": "blender", "music-mcp-server": "music-mcp", "video-mcp-server": "video-mcp" }[id];
  return canonical && apps.some((app) => app.id === canonical) ? canonical : id;
};
