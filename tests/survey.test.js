import test from "node:test";
import assert from "node:assert/strict";
import { toggleSurveyChoice, validateSurveyForm, surveyPercent, isSurveyClosed } from "../src/utils/survey.js";

test("closed state is distinct from login expiry, service errors and permission failures", () => {
  assert.equal(isSurveyClosed({ status: 423, code: "survey_closed" }), true);
  for (const error of [null, { status: 401 }, { status: 403 }, { status: 500 }, { status: 423, code: "other" }]) assert.equal(isSurveyClosed(error), false);
});

test("survey priorities cap at two and no-pain is exclusive", () => {
  const q = { id: "q12", max: 2 };
  assert.deepEqual(toggleSurveyChoice(q, ["a", "b"], "c"), ["a", "b"]);
  assert.deepEqual(toggleSurveyChoice(q, ["a", "b"], "a"), ["b"]);
  assert.deepEqual(toggleSurveyChoice(q, ["a", "b"], "暂无足够痛点"), ["暂无足够痛点"]);
  assert.deepEqual(toggleSurveyChoice(q, ["暂无足够痛点"], "a"), ["a"]);
});
test("single choices replace previous answer", () => {
  assert.deepEqual(toggleSurveyChoice({ max: 1 }, ["a"], "b"), ["b"]);
});
test("internal analysis and other explicit permissions are required", () => {
  const form = { answers: { q1: { choices: ["技术运维"] } }, analysis: "yes", quote: "no", contactPermission: "no" };
  assert.equal(validateSurveyForm(form), "");
  for (const key of ["analysis", "quote", "contactPermission"]) assert.notEqual(validateSurveyForm({ ...form, [key]: "" }), "");
  assert.notEqual(validateSurveyForm({ ...form, analysis: "no" }), "");
  assert.notEqual(validateSurveyForm({ ...form, answers: {} }), "");
});
test("distribution denominators use respondents and handle empty data", () => {
  assert.equal(surveyPercent(0, 0), 0);
  assert.equal(surveyPercent(2, 3), 67);
  assert.equal(surveyPercent(2, 2), 100);
});
