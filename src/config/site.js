const useAiDomain = typeof window !== "undefined" && window.location.hostname === "hub.verdantflare.ai";

export const loginUrl = useAiDomain
  ? "https://login.verdantflare.ai/sign-in"
  : (import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in");

export const wwwUrl = useAiDomain
  ? "https://www.verdantflare.ai"
  : (import.meta.env.VITE_WWW_URL || "https://www.verdantflarehub.com");

export const loginHomeUrl = new URL("/", loginUrl).toString();
