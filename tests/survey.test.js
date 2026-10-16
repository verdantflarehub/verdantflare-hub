import test from "node:test";
import assert from "node:assert/strict";
import { toggleSurveyChoice, validateSurveyForm, surveyPercent, isSurveyClosed, restoreSurveyAnswers } from "../src/utils/survey.js";

const draftQuestions = ["q1", "q3", "q7", "q16"].map((id) => ({ id }));
test("resume accepts omitted and null draft fields without breaking choice or matrix rendering", () => {
  for (const saved of [undefined, null, {}, { q1: {}, q3: null, q7: {} }, { q1: { choices: null }, q7: { rows: null } }]) {
    const answers = restoreSurveyAnswers(draftQuestions, saved);
    assert.equal(answers.q1.choices.includes("技术运维"), false);
    assert.deepEqual(toggleSurveyChoice({ id: "q1" }, answers.q1.choices, "技术运维"), ["技术运维"]);
    assert.equal(answers.q7.rows["参考图"], undefined);
    assert.equal(answers.q3.text, "");
    assert.equal(answers.q16, undefined);
  }
});
test("resume preserves partial choices, text and matrix answers and isolates later edits", () => {
  const saved = { q1: { choices: ["技术运维"] }, q3: { text: "已有回答" }, q7: { rows: { "参考图": "不稳定" }, text: "矩阵补充" } };
  const snapshot = structuredClone(saved);
  const answers = restoreSurveyAnswers(draftQuestions, saved);
  assert.deepEqual(answers.q1, { choices: ["技术运维"], text: "", rows: {} });
  assert.deepEqual(answers.q3, { choices: [], text: "已有回答", rows: {} });
  assert.deepEqual(answers.q7, { choices: [], text: "矩阵补充", rows: { "参考图": "不稳定" } });
  answers.q1.choices.push("导演／创意");
  answers.q7.rows["参考图"] = "能稳定找回";
  assert.deepEqual(saved, snapshot);
});
test("submitted receipt with no questions needs no answer restoration", () => {
  assert.deepEqual(restoreSurveyAnswers([], { q1: { choices: ["技术运维"] } }), {});
});

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
