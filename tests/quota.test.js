import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatQuotaUSD, formatUsagePercent } from "../src/utils/quota.js";

test("the same gateway quota balances reconcile across Hub pages", () => {
  assert.equal(formatQuotaUSD(2500000), "$5.00");
  assert.equal(formatQuotaUSD(362), "$0.000724");
  assert.equal(formatQuotaUSD(2499638), "$4.999276");
  assert.equal(formatUsagePercent(362, 2500000), "0.0145%");
});

test("zero, minimum quota and unavailable data are not mistaken for cents", () => {
  assert.equal(formatQuotaUSD(0), "$0.00");
  assert.equal(formatQuotaUSD(1), "$0.000002");
  assert.equal(formatQuotaUSD(undefined), "—");
  assert.equal(formatUsagePercent(1, 2500000), "<0.0001%");
});
