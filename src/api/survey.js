export const surveyPath = "/surveys/yunnan-202610";
export const surveyAdminPath = "/ops/surveys/yunnan-202610";
const base = `${(import.meta.env.VITE_CONTROL_API_BASE || "/api/control").replace(/\/$/, "")}/public${surveyPath}`;

// Unlike Hub account APIs, an expired guest session must never redirect to VF Login.
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const error = new Error(result?.error?.message || (response.status === 429 ? "请求较频繁，请稍后重试" : "问卷服务暂时不可用，请稍后重试"));
    error.status = response.status;
    error.code = result?.error?.code;
    throw error;
  }
  return result;
}
export const surveyApi = {
  page: () => request(""),
  captcha: () => request("/captcha"),
  session: (input) => request("/session", input),
  submit: (input) => request("/responses", input),
};
