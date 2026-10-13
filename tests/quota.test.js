import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatYuan, formatUsagePercent, parseCNYFen } from "../src/utils/quota.js";

test("Hub renders Control's CNY amounts without exchange-rate arithmetic", () => {
  assert.equal(formatYuan("36.50"), "¥36.50");
  assert.equal(formatYuan("0.005285"), "¥0.005285");
  assert.equal(formatYuan("36.494715"), "¥36.494715");
  assert.equal(formatUsagePercent(362, 2500000), "0.0145%");
});

test("zero and unavailable Control amounts are not mistaken for cents", () => {
  assert.equal(formatYuan("0.00"), "¥0.00");
  assert.equal(formatYuan("0.000015"), "¥0.000015");
  assert.equal(formatYuan(undefined), "—");
  assert.equal(formatYuan("5"), "—");
  assert.equal(formatUsagePercent(1, 2500000), "<0.0001%");
});

test("CNY form sends integer fen; Control owns the gateway conversion and quote", () => {
  assert.equal(parseCNYFen("36.50"), 3650);
  assert.equal(parseCNYFen("10.00"), 1000);
  assert.equal(parseCNYFen("0.01"), 1);
  assert.equal(parseCNYFen("7300.00"), 730000);
  assert.equal(parseCNYFen("7300.10"), null);
  assert.equal(parseCNYFen("1.234"), null);
  assert.equal(parseCNYFen(""), null);
  assert.equal(parseCNYFen("Infinity"), null);
});
