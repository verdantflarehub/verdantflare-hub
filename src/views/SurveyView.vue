<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { surveyApi, surveyAdminPath } from "../api/survey";
import { surveyGroups, toggleSurveyChoice, validateSurveyForm, isSurveyClosed } from "../utils/survey";
import "../survey.css";

const page = ref(null);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const captcha = ref(null);
const nickname = ref("");
const code = ref("");
const step = ref(0);
const receipt = ref("");
const closed = ref(false);
const unavailable = ref(false);
const heading = ref(null);
const form = reactive({ version: 1, answers: {}, analysis: "", quote: "", contactPermission: "", contact: "" });
const questions = computed(() => page.value?.questions.slice(step.value * 4, step.value * 4 + 4) || []);
watch(() => form.contactPermission, (value) => { if (value !== "yes") form.contact = ""; });

function acceptPage(value) {
  closed.value = false;
  for (const question of value.questions) {
    if (question.id !== "q16" && !form.answers[question.id]) form.answers[question.id] = { choices: [], text: "", rows: {} };
  }
  form.version = value.version;
  page.value = value;
  nickname.value = value.nickname;
  receipt.value = value.responseId;
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
  try { acceptPage(await surveyApi.session({ nickname: nickname.value.trim(), challengeId: captcha.value.challengeId, code: code.value })); }
  catch (cause) {
    handleFailure(cause);
    if (!closed.value) {
      try { await refreshCaptcha(); } catch (failure) { handleFailure(failure); }
    }
  } finally { busy.value = false; }
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
onMounted(initialize);
</script>

<template>
  <main class="survey-public survey-ui">
    <header class="survey-brand"><img src="/brand/verdantflare-logo.png" alt="" /><span>VERDANTFLARE <small>云南交流 · 会前问卷</small></span></header>
    <section class="survey-intro">
      <span class="survey-eyebrow">从真实项目出发</span>
      <h1>了解您的制作流程，<br />让交流更有针对性。</h1>
      <p>内容生产需求问卷 · 约 8—10 分钟。以最近三个月的项目为例，不确定或商业敏感的问题可以跳过。</p>
    </section>
    <p v-if="loading" role="status" class="survey-card">正在加载问卷…</p>
    <section v-else-if="unavailable" class="survey-card" role="alert">
      <h2>暂时无法读取问卷状态</h2><p>{{ error }}</p>
      <button class="button secondary" @click="initialize">重新尝试</button>
    </section>
    <section v-else-if="receipt" class="survey-card survey-success" role="status">
      <span class="survey-eyebrow">已收到您的反馈</span><h2>谢谢，云南见。</h2>
      <p>本次答卷已保存，无需重复提交。VF 团队会用这些反馈准备交流内容，并遵守您的使用许可。</p>
      <p class="survey-muted">回执编号</p><code class="survey-receipt">{{ receipt }}</code>
    </section>
    <section v-else-if="closed" class="survey-card" role="status">
      <span class="survey-eyebrow">收集已关闭</span><h2>问卷暂未开放或已暂停</h2>
      <p>请等待组织方开放后再填写。已有答卷不受影响；当前尚未提交的答案仅保留在这个页面，关闭或刷新浏览器后会丢失。</p>
      <button class="button secondary" :disabled="busy" @click="initialize">检查开放状态</button>
    </section>
    <form v-else-if="!page" class="survey-card" @submit.prevent="enter">
      <h2>先认识一下您</h2>
      <p class="survey-muted">不用注册 VF 账号。昵称不必是真名，也不作为身份认证。请勿填写密码、客户秘密或上传客户素材。</p>
      <label class="survey-field">昵称 <input v-model="nickname" autocomplete="nickname" minlength="2" maxlength="32" required placeholder="2—32 个字符" /></label>
      <div class="survey-captcha">
        <img v-if="captcha" :src="captcha.imageDataUrl" alt="六位数字验证码；看不清可换一张" width="240" height="70" />
        <span v-else>验证码尚未加载</span>
        <button type="button" class="button secondary" :disabled="busy" @click="refresh">换一张</button>
      </div>
      <label class="survey-field">验证码 <input v-model="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" maxlength="6" required placeholder="图片中的六位数字" /></label>
      <p v-if="error" class="survey-error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy || !captcha">{{ busy ? '正在验证…' : '开始填写' }}</button>
      <p class="survey-muted">页面内暂存答案，刷新或关闭页面会丢失尚未提交的内容；两小时内有效。使用许可将在最后一步分别确认。</p>
    </form>
    <form v-else @submit.prevent="submit">
      <div class="survey-progress">
        <span>{{ page.nickname }} · 第 {{ step + 1 }} / 4 步</span><span>除角色与使用许可外均可跳过</span>
        <progress :value="step + 1" max="4" :aria-label="`填写进度，第 ${step + 1} 步，共四步`" />
      </div>
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
      <p class="survey-muted">回答仅在点击提交后保存。网络失败可重试，同一填写会话不会重复计数。</p>
    </form>
    <footer class="survey-footer">VerdantFlare · 本次内容生产需求交流 <a :href="surveyAdminPath">管理员入口</a></footer>
  </main>
</template>
