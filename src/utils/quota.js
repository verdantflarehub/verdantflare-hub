const QUOTA_PER_USD = 500000;

export const formatQuotaUSD = (quota) => {
  if (!Number.isSafeInteger(quota) || quota < 0) return "—";
  const [whole, fraction] = (quota / QUOTA_PER_USD).toFixed(6).split(".");
  return `$${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
};

export const formatUsagePercent = (usedQuota, budgetQuota) => {
  if (!Number.isSafeInteger(usedQuota) || !Number.isSafeInteger(budgetQuota) || budgetQuota <= 0) return "0.0%";
  const percent = usedQuota / budgetQuota * 100;
  if (percent > 0 && percent < 0.0001) return "<0.0001%";
  const [whole, fraction] = percent.toFixed(4).split(".");
  return `${whole}.${fraction.replace(/0+$/, "").padEnd(1, "0")}%`;
};
