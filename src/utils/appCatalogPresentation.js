export const catalogStatus = (app) => app.channel === "Listed" ? "资料已收录" : "目录版本已发布";

export const appCardTags = (app) => [
  app.category,
  app.channel !== "Listed" ? `目录通道 ${app.channel}` : null,
  app.entitled && app.channel !== "Listed" ? "组织已授权" : null,
  app.gpu || "资源待补充",
].filter(Boolean);

export const appCardActions = (app) => [
  { label: "查看详情", to: `/market/apps/${encodeURIComponent(app.id)}`, primary: true },
];
