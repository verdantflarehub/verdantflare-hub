<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { createSurveyApi, surveyDetailPath } from "../api/survey";
import { surveyGroups, toggleSurveyChoice, validateSurveyForm, isSurveyClosed, restoreSurveyAnswers } from "../utils/survey";
import "../survey.css";

const props = defineProps({ surveyId: { type: String, required: true } });
const surveyApi = createSurveyApi(props.surveyId);
const metadata = ref({ name: props.surveyId === "yunnan-202610" ? "云南交流" : "交流问卷", description: "需求反馈" });
const adminPath = surveyDetailPath(props.surveyId);
const page = ref(null);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const captcha = ref(null);
const nickname = ref("");
const code = ref("");
const saveDraftConsent = ref(false);
const recoverMode = ref(false);
const recoveryInput = ref("");
const issuedRecoveryCode = ref("");
const draftStatus = ref("");
const draftError = ref("");
const step = ref(0);
const receipt = ref("");
const closed = ref(false);
const unavailable = ref(false);
const heading = ref(null);
const form = reactive({ version: 1, answers: {}, analysis: "", quote: "", contactPermission: "", contact: "" });
const questions = computed(() => page.value?.questions.slice(step.value * 4, step.value * 4 + 4) || []);
let draftTimer;
let draftInFlight = false;
let draftDirty = false;
let draftRevision = 0;
let restoring = false;
watch(() => form.contactPermission, (value) => { if (value !== "yes") form.contact = ""; });
watch(() => form.analysis, (value) => { if (value === "no") void nextTick(() => saveDraft()); });
watch(form, scheduleDraft, { deep: true });
watch(step, scheduleDraft);

function acceptPage(value) {
  restoring = true;
  closed.value = false;
  page.value = null;
  form.answers = restoreSurveyAnswers(value.questions, value.draft?.answers);
  form.version = value.version;
  form.analysis = "";
  form.quote = "";
  form.contactPermission = "";
  form.contact = "";
  step.value = 0;
  if (value.draft) {
    for (const key of ["analysis", "quote", "contactPermission", "contact"]) form[key] = value.draft[key] || "";
    step.value = Math.min(3, Math.max(0, value.draftStep || 0));
    draftStatus.value = "已恢复上次保存的草稿";
  }
  draftRevision = value.draftRevision || 0;
  page.value = value;
  nickname.value = value.nickname;
  receipt.value = value.responseId;
  issuedRecoveryCode.value = value.recoveryCode || "";
  void nextTick(() => { restoring = false; });
}
function handleFailure(cause) {
  error.value = cause.message;
  if (isSurveyClosed(cause)) {
    closed.value = true;
    captcha.value = null;
  }
}
async function refreshCaptcha() {
  captcha.value = null;
  code.value = "";
  captcha.value = await surveyApi.captcha();
}
async function refresh() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try { await refreshCaptcha(); } catch (cause) { handleFailure(cause); }
  finally { busy.value = false; }
}
async function initialize() {
  loading.value = true;
  error.value = "";
  unavailable.value = false;
  try { acceptPage(await surveyApi.page()); }
  catch (cause) {
    if (cause.status === 401) {
      page.value = null;
      closed.value = false;
      try { await refreshCaptcha(); } catch (failure) { handleFailure(failure); }
    } else {
      handleFailure(cause);
      unavailable.value = !isSurveyClosed(cause);
    }
  } finally { loading.value = false; }
}
async function enter() {
  if (busy.value || !captcha.value) return;
  busy.value = true;
  error.value = "";
  try { acceptPage(await surveyApi.session({ nickname: nickname.value.trim(), challengeId: captcha.value.challengeId, code: code.value, saveDraft: saveDraftConsent.value || recoverMode.value, recoveryCode: recoverMode.value ? recoveryInput.value.trim() : "" })); }
  catch (cause) {
    handleFailure(cause);
    if (cause.code === "survey_nickname_taken") recoverMode.value = true;
    if (!closed.value) {
      try { await refreshCaptcha(); } catch (failure) { handleFailure(failure); }
    }
  } finally { busy.value = false; }
}
function scheduleDraft() {
  if (restoring || !page.value || receipt.value || closed.value) return;
  draftDirty = true;
  draftStatus.value = "尚有未保存的更改";
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { void saveDraft(); }, 500);
}
async function saveDraft() {
  clearTimeout(draftTimer);
  if (!draftDirty || !page.value || receipt.value || closed.value) return;
  if (draftInFlight) return;
  draftInFlight = true;
  draftDirty = false;
  draftError.value = "";
  draftStatus.value = "正在保存…";
  const snapshot = JSON.parse(JSON.stringify({ ...form, step: step.value, revision: ++draftRevision }));
  try {
    const result = await surveyApi.draft(snapshot);
    if (!draftDirty) draftStatus.value = result.savedAt ? "草稿已保存" : "已清除临时草稿";
  } catch (cause) {
    if (cause.code !== "survey_already_submitted") {
      draftDirty = true;
      draftStatus.value = "草稿未保存";
      draftError.value = cause.message;
      if (isSurveyClosed(cause)) closed.value = true;
    }
  } finally {
    draftInFlight = false;
    if (draftDirty && !closed.value && !receipt.value && !draftError.value) scheduleDraft();
  }
}
function flushOnHide() {
  if (document.visibilityState !== "hidden" || !draftDirty || !page.value || receipt.value || closed.value) return;
  const snapshot = JSON.parse(JSON.stringify({ ...form, step: step.value, revision: ++draftRevision }));
  void surveyApi.draft(snapshot, true).catch(() => {});
}
async function copyRecoveryCode() {
  try { await navigator.clipboard.writeText(issuedRecoveryCode.value); }
  catch { draftError.value = "复制失败，请手动选中续填码保存。"; }
}
function move(value) {
  step.value = value;
  error.value = "";
  heading.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  heading.value?.focus({ preventScroll: true });
}
function choose(question, option, event) {
  form.answers[question.id].choices = toggleSurveyChoice(question, form.answers[question.id].choices, option);
  event.target.checked = form.answers[question.id].choices.includes(option);
}
function updateRow(id, row, value) {
  if (value) form.answers[id].rows[row] = value;
  else delete form.answers[id].rows[row];
}
async function submit() {
  if (busy.value || closed.value) return;
  error.value = validateSurveyForm(form);
  if (error.value) return;
  busy.value = true;
  clearTimeout(draftTimer);
  try {
    const result = await surveyApi.submit(form);
    receipt.value = result.responseId;
    // Contact and answers are not retained after a confirmed submission.
    form.answers = {};
    form.contact = "";
  } catch (cause) {
    handleFailure(cause);
    if (cause.status === 401) {
      page.value = null;
      try { await refreshCaptcha(); } catch (failure) { handleFailure(failure); }
    }
  } finally { busy.value = false; }
}
onMounted(async () => {
  document.addEventListener("visibilitychange", flushOnHide);
  try { metadata.value = await surveyApi.metadata(); }
  catch (cause) { error.value = cause.message; unavailable.value = true; loading.value = false; return; }
  await initialize();
});
onUnmounted(() => { clearTimeout(draftTimer); document.removeEventListener("visibilitychange", flushOnHide); });
</script>

<template>
  <main class="survey-public survey-ui">
    <header class="survey-brand"><img src="/brand/verdantflare-logo.png" alt="" /><span>VERDANTFLARE <small>{{ metadata.name }} · 问卷</small></span></header>
    <section class="survey-intro">
      <span class="survey-eyebrow">从真实项目出发</span>
      <h1>了解您的制作流程，<br />让交流更有针对性。</h1>
      <p>内容生产需求问卷 · 建议预留 10—15 分钟，可分次填写。以最近三个月的项目为例，不确定或商业敏感的问题可以跳过。</p>
      <p class="survey-muted">正式提交的答卷自提交起保存 180 天；未提交草稿最多保留 7 天。需要查询或删除本人答卷，请联系 <a href="mailto:hello@verdantflarehub.com">hello@verdantflarehub.com</a>，请勿在邮件中发送密码、续填码或客户素材。</p>
    </section>
    <p v-if="loading" role="status" class="survey-card">正在加载问卷…</p>
    <section v-else-if="unavailable" class="survey-card" role="alert">
      <h2>暂时无法读取问卷状态</h2><p>{{ error }}</p>
      <button class="button secondary" @click="initialize">重新尝试</button>
    </section>
    <section v-else-if="receipt" class="survey-card survey-success" role="status">
      <span class="survey-eyebrow">已收到您的反馈</span><h2>谢谢您的填写。</h2>
      <p>本次答卷已保存，无需重复提交。VF 团队会用这些反馈准备交流内容，并遵守您的使用许可。</p>
      <p class="survey-muted">回执编号</p><code class="survey-receipt">{{ receipt }}</code>
    </section>
    <section v-else-if="closed" class="survey-card" role="status">
      <span class="survey-eyebrow">收集已关闭</span><h2>问卷暂未开放或已暂停</h2>
      <p>请等待组织方开放后再填写。已由服务端确认保存的草稿可在有效期内续填；尚未显示「草稿已保存」的改动可能丢失。已提交答卷不受影响。</p>
      <button class="button secondary" :disabled="busy" @click="initialize">检查开放状态</button>
    </section>
    <form v-else-if="!page" class="survey-card" @submit.prevent="enter">
      <h2>先认识一下您</h2>
      <p class="survey-muted">不用注册 VF 账号。同一份问卷不能使用已被占用的昵称；昵称不必是真名，也不作为身份认证。请勿填写密码、客户秘密或上传客户素材。</p>
      <label class="survey-field">昵称 <input v-model="nickname" autocomplete="nickname" minlength="2" maxlength="32" required placeholder="2—32 个字符" /></label>
      <label v-if="!recoverMode" class="survey-choice survey-draft-consent"><input v-model="saveDraftConsent" type="checkbox" required />我同意将未提交的回答临时保存最多 7 天，仅用于本人续填；不会进入统计或用于分析。提交时再分别确认正式使用许可。</label>
      <button v-if="!recoverMode" type="button" class="button secondary" @click="recoverMode = true; error = ''">已有续填码？恢复填写</button>
      <template v-else>
        <label class="survey-field">续填码 <input v-model="recoveryInput" autocomplete="off" minlength="64" maxlength="64" required placeholder="首次填写时保存的续填码" /></label>
        <button type="button" class="button secondary" @click="recoverMode = false; recoveryInput = ''; error = ''">使用新昵称</button>
      </template>
      <div class="survey-captcha">
        <img v-if="captcha" :src="captcha.imageDataUrl" alt="六位数字验证码；看不清可换一张" width="240" height="70" />
        <span v-else>验证码尚未加载</span>
        <button type="button" class="button secondary" :disabled="busy" @click="refresh">换一张</button>
      </div>
      <label class="survey-field">验证码 <input v-model="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" maxlength="6" required placeholder="图片中的六位数字" /></label>
      <p v-if="error" class="survey-error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy || !captcha">{{ busy ? '正在验证…' : recoverMode ? '恢复草稿' : '开始填写' }}</button>
      <p class="survey-muted">同一浏览器 7 天内可自动续填；换设备时需要昵称、续填码和新验证码。使用许可将在最后一步分别确认。</p>
    </form>
    <form v-else @submit.prevent="submit">
      <section v-if="issuedRecoveryCode" class="survey-card survey-recovery" aria-label="续填码">
        <h2>请先保存续填码</h2>
        <p class="survey-muted">换设备或清除浏览器数据后，凭昵称、续填码和验证码恢复草稿。此码只显示一次，遗失后无法找回；请勿转发给他人。</p>
        <code class="survey-receipt">{{ issuedRecoveryCode }}</code>
        <button class="button secondary" type="button" @click="copyRecoveryCode">复制续填码</button>
      </section>
      <div class="survey-progress">
        <span>{{ page.nickname }} · 第 {{ step + 1 }} / 4 步</span><span>除角色与使用许可外均可跳过</span>
        <progress :value="step + 1" max="4" :aria-label="`填写进度，第 ${step + 1} 步，共四步`" />
      </div>
      <p class="survey-muted" role="status">{{ draftStatus }}<template v-if="page.expiresAt"> · 可续填至 {{ new Date(page.expiresAt).toLocaleString('zh-CN') }}</template></p>
      <p v-if="draftError" class="survey-error" role="alert">{{ draftError }}。请保持页面打开并重试保存。</p>
      <button v-if="draftError" type="button" class="button secondary" @click="draftError = ''; saveDraft()">重试保存</button>
      <h2 ref="heading" tabindex="-1">{{ surveyGroups[step] }}</h2>
      <p v-if="step === 0" class="survey-muted">投资、园区及暂无制作经验的参与者可重点填 Q1、Q2、Q12、Q13、Q15、Q16。请勿代替尚未访谈的客户填写痛点。</p>
      <fieldset v-for="q in questions" :key="q.id" class="survey-card survey-question">
        <legend>{{ q.id.toUpperCase() }} · {{ q.title }}{{ q.id === 'q1' || q.id === 'q16' ? '（必填）' : '' }}</legend>
        <p class="survey-muted">{{ q.help }}</p>
        <template v-if="q.id === 'q16'">
          <fieldset v-for="consent in [{ key: 'analysis', label: '用于内部需求分析（按昵称保存，可包含您主动提供的信息）' }, { key: 'quote', label: '引用匿名观点到对外材料' }, { key: 'contactPermission', label: '会后联系' }]" :key="consent.key" class="survey-consent">
            <legend>{{ consent.label }}</legend>
            <label v-for="choice in [{ value: 'yes', label: '同意' }, { value: 'no', label: '不同意' }]" :key="choice.value" class="survey-choice"><input v-model="form[consent.key]" type="radio" :name="consent.key" :value="choice.value" />{{ choice.label }}</label>
          </fieldset>
          <p v-if="form.analysis === 'no'" class="survey-error">您选择不同意内部分析，本次答卷不会保存。可以返回修改或关闭页面退出。</p>
          <label v-if="form.contactPermission === 'yes'" class="survey-field">联系方式（选填）<input v-model="form.contact" maxlength="200" placeholder="方便联系的邮箱、电话或微信" /></label>
        </template>
        <template v-else>
          <div v-if="q.rows" class="survey-matrix">
            <label v-for="row in q.rows" :key="row" class="survey-field">{{ row }}<select :value="form.answers[q.id].rows[row] || ''" @change="updateRow(q.id, row, $event.target.value)"><option value="">请选择／跳过</option><option v-for="option in q.options" :key="option" :value="option">{{ option }}</option></select></label>
          </div>
          <div v-else-if="q.options" class="survey-choices">
            <label v-for="option in q.options" :key="option" class="survey-choice" :class="{ selected: form.answers[q.id].choices.includes(option) }">
              <input :type="q.max === 1 ? 'radio' : 'checkbox'" :name="q.id" :checked="form.answers[q.id].choices.includes(option)" @change="choose(q, option, $event)" />{{ option }}
            </label>
          </div>
          <label class="survey-field">{{ q.options ? '补充说明（选填）' : '您的回答（选填）' }}<textarea v-model="form.answers[q.id].text" rows="3" maxlength="2000" placeholder="请勿填写未获授权的客户信息。最多 2000 字。" /></label>
        </template>
      </fieldset>
      <p v-if="error" class="survey-error" role="alert">{{ error }}</p>
      <div class="survey-actions">
        <button v-if="step > 0" class="button secondary" type="button" :disabled="busy" @click="move(step - 1)">上一步</button>
        <button v-if="step < 3" class="button primary" type="button" @click="move(step + 1)">下一步</button>
        <button v-else class="button primary" :disabled="busy || form.analysis === 'no'">{{ busy ? '正在保存…' : '提交问卷' }}</button>
      </div>
      <p class="survey-muted">草稿只供续填，不计入统计；点击「提交问卷」并同意内部分析后才形成正式答卷。网络失败可重试，同一填写会话不会重复计数。</p>
    </form>
    <footer class="survey-footer">VerdantFlare · {{ metadata.name }} <a :href="adminPath">管理员入口</a></footer>
  </main>
</template>
