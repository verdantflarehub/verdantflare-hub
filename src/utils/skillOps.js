// Shared labels for the skill publishing pages (/ops/skills and /ops/skills/<id>).

export const visibilityLabel = (value) => ({ draft: "草稿", listed: "已列出", hidden: "隐藏", paused: "已暂停" })[value] || value;

export const releaseStatusLabel = (value) => ({ candidate: "待发布", published: "已发布", withdrawn: "已撤回" })[value] || value;

export const kindLabel = (kind) => kind === "bundle" ? "能力组合" : "单技能";

export const sourceLabel = (release) => release?.source
  ? `技能仓库 · ${release.source.commit.slice(0, 7)}${release.authentication === "unsigned" ? " · 未签名" : ""}`
  : "无来源回执";

const pad = (value) => String(value).padStart(2, "0");
export const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  // Seeded records carry Go's zero time (year 1); treat it as unknown.
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "—";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatSize = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
};

// The package files a catalog entry downloads from a release: a single skill
// is its own package; a bundle is the packages of the skills it previews.
export const packagesFor = (release, entry) => {
  if (!release || !entry) return [];
  const ids = entry.kind === "bundle" ? (entry.previewSkillIds || []) : [entry.entryId];
  return (release.files || []).filter((file) => file.kind === "package" && ids.includes(file.skillId));
};

// Fields required before a record can be listed in the skill market.
export const listingMissing = (draft) => [
  ["名称", draft?.name], ["简介", draft?.summary], ["说明", draft?.description], ["分类", draft?.category],
].filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
