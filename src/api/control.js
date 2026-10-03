import {
  apiKeys,
  apiTasks,
  apps,
  centerContext,
  experienceSessions,
  members,
  models,
} from "../data/mock";

const controlBase = (import.meta.env.VITE_CONTROL_API_BASE || "/api/control").replace(/\/$/, "");
const useMock = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== "false";
const mockMembers = members.map((member, index) => ({
  ...member,
  id: index === 0 ? "logto_01vf9k2" : `legacy:${member.email}`,
  centerUserId: index === 0 ? centerContext.centerUserId : undefined,
}));

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
  if (!response.ok) throw new Error(body?.error?.message || `Control API ${response.status}`);
  return body;
};

export const getCenterContext = async () => {
  if (new URLSearchParams(window.location.search).get("state") === "error") {
    throw new Error("服务暂时不可用");
  }
  if (useMock) {
    await new Promise((resolve) => window.setTimeout(resolve, 380));
    return structuredClone(centerContext);
  }
  return request("/context");
};

export const controlApi = {
  getCenterContext,
  setActiveOrganization: (organizationId) =>
    useMock
      ? Promise.resolve({ ...structuredClone(centerContext), activeOrganizationId: organizationId })
      : request("/context/active-organization", { method: "PUT", body: JSON.stringify({ organizationId }) }),
  getOverview: () =>
    useMock
      ? Promise.resolve({ organization: structuredClone(centerContext.organizations[0]), availableApps: apps.length, previewApps: apps.filter((app) => app.channel === "Preview").length, experienceCredits: 680, runningSessions: 1, apiCredits: 12840, runningApiTasks: 1, apiUsagePercentage: 68.7 })
      : request("/overview"),
  listApps: () => (useMock ? Promise.resolve(structuredClone(apps)) : request("/market/apps")),
  getApp: (id) => (useMock ? Promise.resolve(structuredClone(apps.find((app) => app.id === id))) : request(`/market/apps/${encodeURIComponent(id)}`)),
  listExperienceSessions: () => (useMock ? Promise.resolve(structuredClone(experienceSessions)) : request("/experience/sessions")),
  createExperienceSession: (payload) =>
    useMock ? Promise.resolve({ id: `exp_${Date.now().toString(16).toUpperCase()}`, ...payload }) : request("/experience/sessions", { method: "POST", body: JSON.stringify(payload) }),
  closeExperienceSession: (id) =>
    useMock ? Promise.resolve() : request(`/experience/sessions/${id}`, { method: "DELETE" }),
  createApiKey: (payload) =>
    useMock ? Promise.resolve({ id: `key_${Date.now()}`, secret: `vf_live_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`, ...payload }) : request("/api-keys", { method: "POST", body: JSON.stringify(payload) }),
  listApiKeys: () => (useMock ? Promise.resolve(structuredClone(apiKeys)) : request("/api-keys")),
  revokeApiKey: (id) => (useMock ? Promise.resolve() : request(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" })),
  listModels: () => (useMock ? Promise.resolve(structuredClone(models)) : request("/api/models")),
  listApiTasks: () => (useMock ? Promise.resolve(structuredClone(apiTasks)) : request("/api/tasks")),
  getApiUsage: () => (useMock ? Promise.resolve({ budget: 41000, used: 28160, remaining: 12840, percentage: 68.7 }) : request("/api/usage")),
  getOrganization: () => (useMock ? Promise.resolve(structuredClone(centerContext.organizations.find((organization) => organization.organizationId === centerContext.activeOrganizationId))) : request("/settings/organization")),
  updateOrganization: (payload) =>
    useMock
      ? Promise.resolve({ ...structuredClone(centerContext.organizations.find((organization) => organization.organizationId === centerContext.activeOrganizationId)), ...payload })
      : request("/settings/organization", { method: "PATCH", body: JSON.stringify(payload) }),
  listMembers: () => (useMock ? Promise.resolve(structuredClone(mockMembers)) : request("/settings/members")),
  inviteMember: (payload) => {
    if (!useMock) return request("/settings/members", { method: "POST", body: JSON.stringify(payload) });
    const email = payload.email.toLowerCase();
    if (mockMembers.some((member) => member.email.toLowerCase() === email)) return Promise.reject(new Error("该邮箱已在组织中或已有待处理邀请"));
    const record = { id: `mem_${Date.now()}`, name: email.split("@")[0], email, role: payload.role, joined: new Date().toISOString().slice(0, 10), status: "待邀请", avatar: email[0].toUpperCase() };
    mockMembers.push(record);
    return Promise.resolve(structuredClone(record));
  },
  updateMember: (id, payload) => {
    if (!useMock) return request(`/settings/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    const member = mockMembers.find((item) => item.id === id);
    if (!member) return Promise.reject(new Error("成员记录不存在"));
    Object.assign(member, payload);
    return Promise.resolve(structuredClone(member));
  },
  getBilling: () => (useMock ? Promise.resolve({ plan: "Enterprise", apiBudget: 41000, apiUsed: 28160 }) : request("/settings/billing")),
  listReleases: () => request("/ops/releases"),
  createManagedApp: (payload) => request("/ops/apps", { method: "POST", body: JSON.stringify(payload) }),
  getManagedApp: (id) => request(`/ops/apps/${encodeURIComponent(id)}`),
  updateManagedApp: (id, payload) => request(`/ops/apps/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listOperationsOrganizations: () => request("/ops/organizations"),
  createManagedOrganization: (payload) => request("/ops/organizations", { method: "POST", body: JSON.stringify(payload) }),
  getManagedOrganization: (id) => request(`/ops/organizations/${encodeURIComponent(id)}`),
  updateManagedOrganization: (id, payload) => request(`/ops/organizations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createManagedMember: (organizationId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members`, { method: "POST", body: JSON.stringify(payload) }),
  updateManagedMember: (organizationId, memberId, payload) => request(`/ops/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
