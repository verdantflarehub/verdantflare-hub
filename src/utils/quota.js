export const formatYuan = (value) =>
  typeof value === "string" && /^(?:0|[1-9]\d*)\.\d{2,6}$/.test(value) ? `¥${value}` : "—";

export const parseCNYFen = (value) => {
  const input = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const cnyFen = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cnyFen) && cnyFen >= 1 && cnyFen <= 730000 ? cnyFen : null;
};

export const formatUsagePercent = (usedQuota, budgetQuota) => {
  if (!Number.isSafeInteger(usedQuota) || !Number.isSafeInteger(budgetQuota) || budgetQuota <= 0) return "0.0%";
  const percent = usedQuota / budgetQuota * 100;
  if (percent > 0 && percent < 0.0001) return "<0.0001%";
  const [whole, fraction] = percent.toFixed(4).split(".");
  return `${whole}.${fraction.replace(/0+$/, "").padEnd(1, "0")}%`;
};
