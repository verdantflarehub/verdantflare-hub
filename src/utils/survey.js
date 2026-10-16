export const surveyGroups = ["团队与工作方式", "最近一次返修", "数据与交付条件", "接入与后续验证"];

export const isSurveyClosed = (error) => error?.status === 423 && error?.code === "survey_closed";

// The API omits empty answer fields when serializing saved drafts.
// Restore the complete editable shape without changing the saved payload.
export function restoreSurveyAnswers(questions, savedAnswers = {}) {
  return Object.fromEntries(questions.filter((question) => question.id !== "q16").map(({ id }) => {
    const answer = savedAnswers?.[id];
    return [id, {
      choices: Array.isArray(answer?.choices) ? [...answer.choices] : [],
      text: typeof answer?.text === "string" ? answer.text : "",
      rows: answer?.rows && typeof answer.rows === "object" && !Array.isArray(answer.rows) ? { ...answer.rows } : {},
    }];
  }));
}

export function toggleSurveyChoice(question, current, value) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (question.max === 1) return [value];
  if (question.id === "q12") {
    if (value === "暂无足够痛点") return [value];
    current = current.filter((item) => item !== "暂无足够痛点");
  }
  if (question.max && current.length >= question.max) return current;
  return [...current, value];
}

export function validateSurveyForm(form) {
  if (!form.answers.q1?.choices?.length) return "请选择 Q1 的角色，方便我们理解您的反馈。";
  if (form.analysis !== "yes") return "只有同意内部需求分析才会保存答卷；您可以修改选择，或直接关闭页面退出。";
  if (![form.quote, form.contactPermission].every((value) => ["yes", "no"].includes(value))) return "请分别选择匿名引用和会后联系许可。";
  return "";
}

export function surveyPercent(count, answered) {
  return answered ? Math.round(count * 100 / answered) : 0;
}
