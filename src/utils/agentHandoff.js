export const parseAgentHandoffFragment = (fragment) => {
  const parameters = new URLSearchParams((fragment || "").replace(/^#/, ""));
  const requestRef = parameters.get("request_ref") || "";
  const state = parameters.get("state") || "";
  const valid = (value) => value.length > 0 && value.length <= 256 && /^[\x21-\x7e]+$/.test(value) && !/[\\/?#]/.test(value);
  if (parameters.size !== 2 || !valid(requestRef) || !valid(state)) return null;
  return { requestRef, state };
};

const loginFragmentKey = "vf_agent_handoff_fragment_v1";
const loginFragmentLifetimeMs = 5 * 60 * 1000;

// The Login return_to value is server-visible; never put handoff refs in it.
export const handoffLoginReturnTo = (location) => location.pathname;

export const saveAgentHandoffForLogin = (location, storage, now = Date.now()) => {
  if (!parseAgentHandoffFragment(location.hash)) return false;
  try {
    storage.setItem(loginFragmentKey, JSON.stringify({ fragment: location.hash, savedAt: now }));
    return true;
  } catch {
    return false;
  }
};

export const restoreAgentHandoffAfterLogin = (location, storage, history, now = Date.now()) => {
  if (parseAgentHandoffFragment(location.hash)) {
    try { storage.removeItem(loginFragmentKey); } catch { /* storage may be disabled */ }
    return location.hash;
  }
  try {
    const saved = JSON.parse(storage.getItem(loginFragmentKey) || "null");
    storage.removeItem(loginFragmentKey);
    if (!saved || !Number.isFinite(saved.savedAt) || now < saved.savedAt || now - saved.savedAt >= loginFragmentLifetimeMs || !parseAgentHandoffFragment(saved.fragment)) return "";
    history.replaceState(history.state, "", `${location.pathname}${saved.fragment}`);
    return saved.fragment;
  } catch {
    return "";
  }
};
