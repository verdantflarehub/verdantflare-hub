const controlBase = (import.meta.env.VITE_CONTROL_API_BASE || "/api/control").replace(/\/$/, "");

const request = async (path, options = {}) => {
  const response = await fetch(`${controlBase}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (response.status === 401) {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`${import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in"}?return_to=${returnTo}`);
    return null;
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Control API ${response.status}`);
    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body;
};

export const getCenterContext = () => request("/context");

export const controlApi = {
  getCenterContext,
  setActiveOrganization: (organizationId) => request("/context/active-organization", { method: "PUT", body: JSON.stringify({ organizationId }) }),
  getOverview: () => request("/overview"),
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
  inviteMember: (payload) => request("/settings/members", { method: "POST", body: JSON.stringify(payload) }),
  updateMember: (id, payload) => request(`/settings/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getBilling: () => request("/settings/billing"),
  listReleases: () => request("/ops/releases"),
  listManagedModels: () => request("/ops/models"),
  listGatewayModels: () => request("/ops/gateway-models"),
  createManagedModel: (payload) => request("/ops/models", { method: "POST", body: JSON.stringify(payload) }),
  updateManagedModel: (id, payload) => request(`/ops/models/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createManagedApp: (payload) => request("/ops/apps", { method: "POST", body: JSON.stringify(payload) }),
  getManagedApp: (id) => request(`/ops/apps/${encodeURIComponent(id)}`),
  updateManagedApp: (id, payload) => request(`/ops/apps/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listAppVersions: (id) => request(`/ops/apps/${encodeURIComponent(id)}/versions`),
  createAppVersion: (id, payload) => request(`/ops/apps/${encodeURIComponent(id)}/versions`, { method: "POST", body: JSON.stringify(payload) }),
  getAppVersion: (id, version) => request(`/ops/apps/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`),
  listOperationsOrganizations: () => request("/ops/organizations"),
  createManagedOrganization: (payload) => request("/ops/organizations", { method: "POST", body: JSON.stringify(payload) }),
  getManagedOrganization: (id) => request(`/ops/organizations/${encodeURIComponent(id)}`),
  updateManagedOrganization: (id, payload) => request(`/ops/organizations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getOrganizationApiCredit: (id) => request(`/ops/organizations/${encodeURIComponent(id)}/api-credit`),
  grantOrganizationApiCredit: (id, payload) => request(`/ops/organizations/${encodeURIComponent(id)}/api-credit`, { method: "POST", body: JSON.stringify(payload) }),
  createManagedMember: (organizationId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members`, { method: "POST", body: JSON.stringify(payload) }),
  listGuests: (params = {}) => request(`/ops/guests?${new URLSearchParams(params)}`),
  bindManagedMember: (organizationId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/bind`, { method: "POST", body: JSON.stringify(payload) }),
  updateManagedMember: (organizationId, memberId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
