import { loginUrl } from "../config/site";

const controlBase = (import.meta.env.VITE_CONTROL_API_BASE || "/api/control").replace(/\/$/, "");

const request = async (path, options = {}) => {
  const headers = options.body instanceof FormData ? { ...options.headers } : { "Content-Type": "application/json", ...options.headers };
  const response = await fetch(`${controlBase}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (response.status === 401) {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`${loginUrl}?return_to=${returnTo}`);
    return null;
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || body?.error?.message || `Control API ${response.status}`);
    error.code = body?.code || body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body;
};

export const getCenterContext = () => request("/context");

export const controlApi = {
  getCenterContext,
  listSurveys: () => request("/ops/surveys"),
  createSurvey: (payload) => request("/ops/surveys", { method: "POST", body: JSON.stringify(payload) }),
  getSurveyStats: (surveyId) => request(`/ops/surveys/${encodeURIComponent(surveyId)}/stats`),
  setSurveySettings: (surveyId, open, expectedVersion) => request(`/ops/surveys/${encodeURIComponent(surveyId)}/settings`, { method: "PUT", body: JSON.stringify({ open, expectedVersion }) }),
  listSurveyResponses: (surveyId, offset = 0, limit = 20) => request(`/ops/surveys/${encodeURIComponent(surveyId)}/responses?offset=${offset}&limit=${limit}`),
  getSurveyResponse: (surveyId, id) => request(`/ops/surveys/${encodeURIComponent(surveyId)}/responses/${encodeURIComponent(id)}`),
  setActiveOrganization: (organizationId) => request("/context/active-organization", { method: "PUT", body: JSON.stringify({ organizationId }) }),
  getOverview: () => request("/overview"),
  getGuestCatalog: () => request("/guest/catalog"),
  listApps: () => request("/market/apps"),
  getApp: (id) => request(`/market/apps/${encodeURIComponent(id)}`),
  listExperienceSessions: () => request("/experience/sessions"),
  createExperienceSession: (payload) => request("/experience/sessions", { method: "POST", body: JSON.stringify(payload) }),
  closeExperienceSession: (id) => request(`/experience/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listModelExperienceRuns: () => request("/experience/model-runs"),
  getModelExperienceRun: (id) => request(`/experience/model-runs/${encodeURIComponent(id)}`),
  createModelExperienceRun: (payload) => request("/experience/model-runs", { method: "POST", body: JSON.stringify(payload) }),
  createApiKey: (payload) => request("/api-keys", { method: "POST", body: JSON.stringify(payload) }),
  listApiKeys: () => request("/api-keys"),
  revokeApiKey: (id) => request(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  probeApiKey: (id) => request(`/api-keys/${encodeURIComponent(id)}/probe`),
  listModels: () => request("/api/models"),
  listApiTasks: () => request("/api/tasks"),
  getApiUsage: () => request("/api/usage"),
  getOrganization: () => request("/settings/organization"),
  updateOrganization: (payload) => request("/settings/organization", { method: "PATCH", body: JSON.stringify(payload) }),
  listMembers: () => request("/settings/members"),
  listCurrentOrganizationGuests: (params = {}) => request(`/settings/guests?${new URLSearchParams(params)}`),
  bindCurrentOrganizationMember: (payload) => request("/settings/members/bind", { method: "POST", body: JSON.stringify(payload) }),
  transferCurrentOrganizationMember: (id, payload) => request(`/settings/members/${encodeURIComponent(id)}/transfer`, { method: "POST", body: JSON.stringify(payload) }),
  inviteMember: (payload) => request("/settings/members", { method: "POST", body: JSON.stringify(payload) }),
  updateMember: (id, payload) => request(`/settings/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getBilling: () => request("/settings/billing"),
  listMcpTokens: (purpose = "app_publish") => request(`/settings/mcp-tokens?purpose=${encodeURIComponent(purpose)}`),
  createMcpToken: (payload) => request("/settings/mcp-tokens", { method: "POST", body: JSON.stringify(payload) }),
  revokeMcpToken: (id) => request(`/settings/mcp-tokens/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listReleases: () => request("/ops/releases"),
  listManagedModels: () => request("/ops/models"),
  uploadModelProviderIcon: (icon) => {
    const body = new FormData();
    body.append("icon", icon);
    return request("/ops/model-icons", { method: "POST", body });
  },
  listGatewayModels: () => request("/ops/gateway-models"),
  createManagedModel: (payload) => request("/ops/models", { method: "POST", body: JSON.stringify(payload) }),
  updateManagedModel: (id, payload) => request(`/ops/models/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createManagedApp: (payload) => request("/ops/apps", { method: "POST", body: JSON.stringify(payload) }),
  getManagedApp: (id) => request(`/ops/apps/${encodeURIComponent(id)}`),
  updateManagedApp: (id, payload) => request(`/ops/apps/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listManagedAppsV2: () => request("/ops/v2/apps"),
  createManagedAppV2: (payload) => request("/ops/v2/apps", { method: "POST", body: JSON.stringify(payload) }),
  getManagedAppV2: (id) => request(`/ops/v2/apps/${encodeURIComponent(id)}`),
  patchManagedAppV2: (id, payload, revision) => request(`/ops/v2/apps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: revision ? { "If-Match": `app:${id}:${revision}` } : {},
    body: JSON.stringify(payload),
  }),
  listAppVersionsV2: (id) => request(`/ops/v2/apps/${encodeURIComponent(id)}/versions`),
  createOCIAppVersion: (id, payload) => request(`/ops/v2/apps/${encodeURIComponent(id)}/versions`, { method: "POST", body: JSON.stringify(payload) }),
  selectAppRelease: (id, version, revision) => request(`/ops/v2/apps/${encodeURIComponent(id)}/release`, {
    method: "PUT",
    headers: revision ? { "If-Match": `app:${id}:${revision}` } : {},
    body: JSON.stringify({ version: version || null }),
  }),
  opsAppsYamlUrl: () => `${controlBase}/ops/v2/apps.yaml`,
  auditAppChart: (id, chart) => {
    const body = new FormData();
    body.append("chart", chart);
    return request(`/ops/apps/${encodeURIComponent(id)}/chart-audits`, { method: "POST", body });
  },
  listAppVersions: (id) => request(`/ops/apps/${encodeURIComponent(id)}/versions`),
  createAppVersion: (id, payload) => request(`/ops/apps/${encodeURIComponent(id)}/versions`, { method: "POST", body: JSON.stringify(payload) }),
  getAppVersion: (id, version) => request(`/ops/apps/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`),
  listStationTestGrants: (id) => request(`/ops/apps/${encodeURIComponent(id)}/station-grants`),
  createStationTestGrant: (id, version, payload) => request(`/ops/apps/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/station-grants`, { method: "POST", body: JSON.stringify(payload) }),
  revokeStationTestGrant: (id, version, stationId) => request(`/ops/apps/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/station-grants/${encodeURIComponent(stationId)}`, { method: "DELETE" }),
  listOperationsOrganizations: () => request("/ops/organizations"),
  createManagedOrganization: (payload) => request("/ops/organizations", { method: "POST", body: JSON.stringify(payload) }),
  getManagedOrganization: (id) => request(`/ops/organizations/${encodeURIComponent(id)}`),
  updateManagedOrganization: (id, payload) => request(`/ops/organizations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getOrganizationApiCredit: (id) => request(`/ops/organizations/${encodeURIComponent(id)}/api-credit`),
  quoteOrganizationApiCredit: (id, amountFen) => request(`/ops/organizations/${encodeURIComponent(id)}/api-credit/quote?amountFen=${encodeURIComponent(amountFen)}`),
  grantOrganizationApiCredit: (id, payload) => request(`/ops/organizations/${encodeURIComponent(id)}/api-credit`, { method: "POST", body: JSON.stringify(payload) }),
  createManagedMember: (organizationId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members`, { method: "POST", body: JSON.stringify(payload) }),
  listGuests: (params = {}) => request(`/ops/guests?${new URLSearchParams(params)}`),
  bindManagedMember: (organizationId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/bind`, { method: "POST", body: JSON.stringify(payload) }),
  transferManagedMember: (organizationId, memberId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}/transfer`, { method: "POST", body: JSON.stringify(payload) }),
  updateManagedMember: (organizationId, memberId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
