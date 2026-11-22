<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { loginUrl } from "../config/site";
import { handoffLoginReturnTo, parseAgentHandoffFragment, restoreAgentHandoffAfterLogin, saveAgentHandoffForLogin } from "../utils/agentHandoff";

const handoffStorage = (() => { try { return window.sessionStorage; } catch { return null; } })();
const fragment = restoreAgentHandoffAfterLogin(window.location, handoffStorage, window.history);
const parsed = parseAgentHandoffFragment(fragment);
const intent = ref(null);
const loading = ref(Boolean(parsed));
const problem = ref(parsed ? "" : "接入请求不完整；请从原浏览器重新发起。");
const submitting = ref(false);
const now = ref(Date.now());
let clock;

const expired = computed(() => !intent.value || !Number.isFinite(Date.parse(intent.value.expires_at)) || now.value >= Date.parse(intent.value.expires_at));
const canConfirm = computed(() => !loading.value && !problem.value && !expired.value && intent.value?.status === "registered" && !submitting.value);

const load = async () => {
  if (!parsed) return;
  loading.value = true;
  problem.value = "";
  intent.value = null;
  try {
    const response = await fetch("/api/control/agent-handoff/v1/intents/view", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_ref: parsed.requestRef }),
    });
    if (response.status === 401) {
      if (!saveAgentHandoffForLogin(window.location, handoffStorage)) {
        problem.value = "浏览器无法保存本次接入请求，请允许会话存储后重试。";
        return;
      }
      const returnTo = encodeURIComponent(handoffLoginReturnTo(window.location));
      window.location.assign(`${loginUrl}?return_to=${returnTo}`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        HANDOFF_EXPIRED: "本次接入请求已过期或取消，请从原浏览器重新发起。",
        HANDOFF_FORBIDDEN: "当前登录账号不属于目标组织，或此 Station 未获登记。",
        HANDOFF_NOT_FOUND: "接入请求不存在，请从原浏览器重新发起。",
        HANDOFF_UNAVAILABLE: "暂时无法核验登录或组织状态，请稍后重试。",
      };
      problem.value = messages[body.code] || "暂时无法核验接入请求，请稍后重试。";
      return;
    }
    if (body.protocol_version !== 1 || !body.recipient_client_ref || !body.station_id || !body.external_organization_ref || !body.expires_at) {
      problem.value = "接入请求资料不完整，请重新发起。";
      return;
    }
    intent.value = body;
  } catch {
    problem.value = "网络暂时不可用，请稍后重试。";
  } finally {
    loading.value = false;
  }
};

const cancel = () => {
  try { handoffStorage?.removeItem("vf_agent_handoff_fragment_v1"); } catch { /* storage may be disabled */ }
  window.history.replaceState(window.history.state, "", "/");
  window.location.assign("/");
};

const confirm = async () => {
  if (!canConfirm.value || !parsed) return;
  submitting.value = true;
  problem.value = "";
  try {
    const response = await fetch("/api/control/agent-handoff/v1/intents/confirm", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ request_ref: parsed.requestRef, state: parsed.state }),
    });
    if (response.status === 401) {
      if (!saveAgentHandoffForLogin(window.location, handoffStorage)) {
        problem.value = "浏览器无法保存本次接入请求，请允许会话存储后重试。";
        return;
      }
      const returnTo = encodeURIComponent(handoffLoginReturnTo(window.location));
      window.location.assign(`${loginUrl}?return_to=${returnTo}`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        HANDOFF_EXPIRED: "本次接入请求已过期或取消，请从原浏览器重新发起。",
        HANDOFF_FORBIDDEN: "当前登录账号无权确认此目标组织或 Station。",
        HANDOFF_CONFLICT: "本次接入请求已经处理，请从原浏览器重新发起。",
        HANDOFF_UNAVAILABLE: "暂时无法核验登录或组织状态，请稍后重试。",
      };
      problem.value = messages[body.code] || "确认失败，请稍后重试。";
      return;
    }
    const callback = new URL(body.callback_url || "", window.location.origin);
    const fragment = new URLSearchParams(callback.hash.slice(1));
    if (callback.protocol !== "https:" || callback.username || callback.password || callback.search || fragment.size !== 2 || !fragment.get("handoff_ref") || fragment.get("state") !== parsed.state) {
      problem.value = "回调地址校验失败，请重新发起接入请求。";
      return;
    }
    window.location.assign(callback.toString());
  } catch {
    problem.value = "网络暂时不可用，请稍后重试。";
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  clock = window.setInterval(() => { now.value = Date.now(); }, 1000);
  load();
});
onUnmounted(() => window.clearInterval(clock));
</script>

<template>
  <main class="agent-handoff-page">
    <div class="agent-handoff-wrap">
      <header class="agent-handoff-heading">
        <span class="page-overline">VERDANTFLARE / IDENTITY HANDOFF</span>
        <h1>确认智能体接入</h1>
        <p>请核对本次接入的 Station 与组织。确认后，才会把当前 Login 身份的一次性事实交给原浏览器中的 Studio。</p>
      </header>
      <section class="agent-handoff-panel" aria-live="polite">
        <div class="agent-handoff-title"><h2>本次请求</h2><p>由已登记的 Studio／Core 发起 · 有效期最长 5 分钟</p></div>
        <p v-if="loading" class="agent-handoff-notice">正在实时核验登录与组织状态…</p>
        <p v-else-if="problem" class="agent-handoff-notice error" role="alert">{{ problem }}</p>
        <template v-else>
          <dl class="agent-handoff-facts">
            <div><dt>接入服务</dt><dd>{{ intent.recipient_client_ref }}</dd></div>
            <div><dt>目标 Station</dt><dd>{{ intent.station_id }}</dd></div>
            <div><dt>目标组织</dt><dd>{{ intent.external_organization_ref }}</dd></div>
            <div><dt>授权范围</dt><dd>仅确认身份；不授予项目权限或生成 API Key</dd></div>
          </dl>
          <p v-if="expired || intent.status !== 'registered'" class="agent-handoff-notice error" role="alert">本次请求已失效，请从原浏览器重新发起。</p>
          <p v-else class="agent-handoff-notice">请确认这是你在原浏览器主动发起的请求。若不是本人操作，请取消；页面不展示 Cookie、令牌或一次性证明。</p>
        </template>
        <div class="agent-handoff-actions">
          <span>登录或成员状态变化时将重新核验</span>
          <button type="button" class="button secondary" @click="cancel">取消</button>
          <button v-if="problem && parsed" type="button" class="button secondary" :disabled="loading" @click="load">重新检查</button>
          <button type="button" class="button primary" :disabled="!canConfirm" @click="confirm">{{ submitting ? "正在确认…" : "确认接入" }}</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.agent-handoff-page{min-height:100vh;padding:clamp(58px,9vw,110px) 24px 60px;background:radial-gradient(circle at 78% 0,rgba(76,227,154,.08),transparent 34rem),var(--ink)}
.agent-handoff-wrap{max-width:730px;margin:0 auto}
.agent-handoff-heading{margin-bottom:28px}.agent-handoff-heading h1{margin:0 0 9px;font-size:clamp(28px,4vw,38px);letter-spacing:-.035em}.agent-handoff-heading p{max-width:680px;margin:0;color:var(--muted);font-size:13px;line-height:1.7}
.agent-handoff-panel{padding:clamp(20px,3vw,30px);border:1px solid var(--line-strong);border-radius:15px;background:var(--panel);box-shadow:var(--shadow)}
.agent-handoff-title h2{margin:0 0 5px;font-size:18px}.agent-handoff-title p{margin:0;color:var(--muted);font-size:12px}
.agent-handoff-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0}.agent-handoff-facts>div{min-width:0;min-height:76px;padding:14px;border:1px solid var(--line);border-radius:10px;background:rgba(244,241,232,.025)}.agent-handoff-facts dt{color:var(--muted);font-size:11px}.agent-handoff-facts dd{margin:6px 0 0;overflow-wrap:anywhere;font-size:13px;font-weight:650}
.agent-handoff-notice{margin:20px 0;padding:13px 14px;border:1px solid rgba(76,227,154,.18);border-radius:9px;background:rgba(76,227,154,.055);color:var(--muted-strong);font-size:12px;line-height:1.6}.agent-handoff-notice.error{border-color:rgba(255,116,111,.25);background:rgba(255,116,111,.06);color:var(--coral)}
.agent-handoff-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-top:20px}.agent-handoff-actions span{margin-right:auto;color:var(--muted);font-size:11px}.agent-handoff-actions button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:620px){.agent-handoff-facts{grid-template-columns:1fr}.agent-handoff-actions{flex-wrap:wrap}.agent-handoff-actions span{width:100%;margin-bottom:9px}}
</style>
