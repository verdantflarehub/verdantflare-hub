<script setup>
import { computed, onMounted, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import { navigate } from "../router";

const props = defineProps({
  path: { type: String, default: "/" },
  logoutUrl: { type: String, required: true },
});
const emit = defineEmits(["retry-context"]);

const models = ref([]);
const apps = ref([]);
const loading = ref(true);
const error = ref("");
const section = computed(() => props.path === "/api/models" ? "models" : props.path === "/market" ? "apps" : "overview");
const title = computed(() => ({ overview: "探索 VerdantFlare", models: "公开模型目录", apps: "公开应用目录" })[section.value]);

const loadCatalog = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch("/api/control/public/catalog", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error(`公开目录暂不可用（${response.status}）`);
    const catalog = await response.json();
    if (!Array.isArray(catalog?.models) || !Array.isArray(catalog?.apps)) throw new Error("公开目录响应格式不正确");
    models.value = catalog.models;
    apps.value = catalog.apps;
  } catch (cause) {
    models.value = [];
    apps.value = [];
    error.value = cause instanceof Error ? cause.message : "公开目录加载失败";
  } finally {
    loading.value = false;
  }
};

onMounted(loadCatalog);
</script>

<template>
  <div class="guest-shell">
    <header class="guest-header">
      <button class="guest-brand" type="button" @click="navigate('/')">
        <img src="/brand/verdantflare-logo.png" alt="" />
        <strong>VerdantFlare <span>Hub</span></strong>
      </button>
      <nav class="guest-nav" aria-label="游客导航">
        <button type="button" :aria-current="section === 'overview' ? 'page' : undefined" @click="navigate('/')">概览</button>
        <button type="button" :aria-current="section === 'models' ? 'page' : undefined" @click="navigate('/api/models')">模型市场</button>
        <button type="button" :aria-current="section === 'apps' ? 'page' : undefined" @click="navigate('/market')">应用市场</button>
      </nav>
      <div class="guest-account"><span class="guest-badge"><i />游客模式</span><a :href="logoutUrl">退出登录</a></div>
    </header>

    <main class="guest-main">
      <section class="guest-hero">
        <div class="guest-hero-copy">
          <span class="guest-eyebrow">VERDANTFLARE / DISCOVER</span>
          <h1>{{ title }}<span class="guest-title-dot">.</span></h1>
          <p>你已经登录，可以浏览公开的模型和应用。加入组织后，才能使用在线体验、API Key 与组织工作台。</p>
          <div class="guest-actions">
            <button v-if="section !== 'models'" class="button primary" type="button" @click="navigate('/api/models')"><AppIcon name="models" :size="17" />探索模型</button>
            <button v-if="section !== 'apps'" class="button secondary" type="button" @click="navigate('/market')"><AppIcon name="market" :size="17" />浏览应用</button>
            <button class="button secondary" type="button" @click="emit('retry-context')"><AppIcon name="check" :size="17" />检查组织权限</button>
          </div>
        </div>
        <div class="guest-hero-mark" aria-hidden="true"><span>VF</span><small>EXPLORE WHAT'S NEXT</small></div>
      </section>

      <section class="guest-access-note">
        <AppIcon name="organization" :size="20" />
        <div><strong>当前身份：无组织游客</strong><p>公开目录可浏览；目录展示不代表模型调用权限或应用运行能力。需要使用业务功能时，请联系组织管理员开通成员资格。</p></div>
      </section>

      <section v-if="loading" class="guest-feedback" aria-live="polite"><div class="loading-ring" /><strong>正在读取公开目录</strong></section>
      <section v-else-if="error" class="guest-feedback" role="alert"><AppIcon name="warning" :size="25" /><strong>公开目录暂时无法加载</strong><p>{{ error }}</p><button class="button secondary" type="button" @click="loadCatalog">重试目录</button></section>

      <template v-else>
        <section v-if="section !== 'apps'" class="guest-catalog" aria-labelledby="guest-model-heading">
          <div class="guest-section-heading"><div><span>MODEL MARKET</span><h2 id="guest-model-heading">公开模型</h2><p>来自已公开的 Control 目录，不包含调用额度或实时可用性。</p></div><strong>{{ models.length }} 个模型</strong></div>
          <div v-if="models.length" class="guest-card-grid">
            <article v-for="model in models" :key="model.id" class="guest-card">
              <div class="guest-card-top"><span class="guest-card-icon"><AppIcon name="models" :size="22" /></span><span class="guest-card-kind">公开模型</span></div>
              <small>{{ model.provider }}</small><h3>{{ model.name }}</h3><p>{{ model.summary }}</p>
              <div class="guest-tags"><span v-for="category in model.categories || []" :key="category">{{ category }}</span><span v-if="model.context">{{ model.context }}</span></div>
            </article>
          </div>
          <div v-else class="guest-empty"><AppIcon name="models" :size="25" /><strong>暂无公开模型</strong><p>管理员发布后，这里会自动显示真实目录记录。</p></div>
        </section>

        <section v-if="section !== 'models'" class="guest-catalog" aria-labelledby="guest-app-heading">
          <div class="guest-section-heading"><div><span>APP MARKET</span><h2 id="guest-app-heading">公开应用</h2><p>查看应用简介与公开版本；实际运行和组织授权需另行开通。</p></div><strong>{{ apps.length }} 个应用</strong></div>
          <div v-if="apps.length" class="guest-card-grid">
            <article v-for="app in apps" :key="app.id" class="guest-card">
              <div class="guest-card-top"><span class="guest-card-icon"><AppIcon name="market" :size="22" /></span><span class="guest-card-kind">公开应用</span></div>
              <small>{{ app.developer || "应用" }}</small><h3>{{ app.name }}</h3><p>{{ app.summary }}</p>
              <div class="guest-tags"><span v-if="app.version">版本 {{ app.version }}</span><span v-if="app.gpu">{{ app.gpu }}</span></div>
            </article>
          </div>
          <div v-else class="guest-empty"><AppIcon name="market" :size="25" /><strong>暂无公开应用</strong><p>管理员发布后，这里会自动显示真实目录记录。</p></div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.guest-shell { min-height: 100vh; background: radial-gradient(ellipse at 82% 5%, rgba(72, 124, 91, .13), transparent 34rem), var(--ink); }
.guest-header { min-height: 72px; padding: 0 clamp(20px, 4vw, 58px); display: flex; align-items: center; gap: 40px; border-bottom: 1px solid var(--line); background: rgba(10, 18, 14, .78); }
.guest-brand { padding: 0; display: flex; align-items: center; gap: 11px; border: 0; background: transparent; cursor: pointer; white-space: nowrap; }
.guest-brand img { width: 29px; height: 29px; }.guest-brand strong { font-size: 16px; letter-spacing: -.035em; }.guest-brand span { color: var(--green); }
.guest-nav { align-self: stretch; display: flex; align-items: stretch; gap: 26px; }.guest-nav button { position: relative; padding: 0 2px; border: 0; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; }.guest-nav button:hover, .guest-nav button[aria-current] { color: var(--paper); }.guest-nav button[aria-current]::after { position: absolute; right: 0; bottom: 0; left: 0; height: 2px; background: var(--green); content: ""; }
.guest-account { margin-left: auto; display: flex; align-items: center; gap: 22px; white-space: nowrap; }.guest-badge { padding: 7px 10px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(114, 230, 166, .19); border-radius: 999px; background: rgba(114, 230, 166, .06); color: var(--green); font-size: 11px; }.guest-badge i { width: 5px; height: 5px; border-radius: 50%; background: var(--green); }.guest-account a { color: var(--muted); font-size: 11px; }.guest-account a:hover { color: var(--paper); }
.guest-main { width: min(100% - 48px, 1240px); margin: 0 auto; padding: 44px 0 88px; }.guest-hero { min-height: 330px; padding: clamp(28px, 5vw, 62px); display: flex; align-items: center; gap: 32px; border: 1px solid var(--line); border-radius: 22px; background: radial-gradient(circle at 82% 35%, rgba(114, 230, 166, .12), transparent 18rem), linear-gradient(125deg, #14231b, #0c1510 66%); overflow: hidden; }.guest-hero-copy { position: relative; z-index: 1; flex: 1; }.guest-eyebrow, .guest-section-heading span { color: var(--green); font-size: 10px; font-weight: 750; letter-spacing: .16em; }.guest-hero h1 { margin: 13px 0 16px; font-size: clamp(34px, 4vw, 56px); letter-spacing: -.055em; line-height: 1.1; }.guest-title-dot { color: var(--green); }.guest-hero p { max-width: 570px; margin: 0; color: var(--muted-strong); font-size: 14px; line-height: 1.8; }.guest-actions { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 10px; }.guest-actions .button { min-height: 43px; }.guest-hero-mark { width: 250px; height: 250px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1px solid rgba(114, 230, 166, .12); border-radius: 50%; box-shadow: 0 0 0 28px rgba(114, 230, 166, .025), inset 0 0 65px rgba(114, 230, 166, .07); color: rgba(114, 230, 166, .26); }.guest-hero-mark span { font-size: 94px; font-weight: 750; letter-spacing: -.13em; line-height: 1; }.guest-hero-mark small { font-size: 8px; letter-spacing: .18em; }
.guest-access-note { margin: 20px 0 48px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 13px; border: 1px solid rgba(127, 169, 238, .16); border-radius: 12px; background: rgba(127, 169, 238, .045); }.guest-access-note svg { flex: 0 0 auto; color: var(--blue); }.guest-access-note strong { font-size: 13px; }.guest-access-note p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.guest-catalog + .guest-catalog { margin-top: 54px; }.guest-section-heading { margin-bottom: 21px; display: flex; align-items: end; justify-content: space-between; gap: 16px; }.guest-section-heading h2 { margin: 8px 0 5px; font-size: 25px; letter-spacing: -.035em; }.guest-section-heading p { margin: 0; color: var(--muted); font-size: 12px; }.guest-section-heading > strong { color: var(--muted-strong); font-size: 12px; font-weight: 550; white-space: nowrap; }.guest-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }.guest-card { min-height: 218px; padding: 23px; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 14px; background: rgba(244, 241, 232, .018); }.guest-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.guest-card-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(114, 230, 166, .16); border-radius: 11px; background: rgba(114, 230, 166, .07); color: var(--green); }.guest-card-kind { color: var(--muted); font-size: 10px; }.guest-card > small { margin-top: 19px; color: var(--green); font-size: 10px; }.guest-card h3 { margin: 6px 0 9px; font-size: 18px; letter-spacing: -.025em; }.guest-card p { flex: 1; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.65; }.guest-tags { min-height: 24px; margin-top: 18px; display: flex; flex-wrap: wrap; gap: 6px; }.guest-tags span { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; color: var(--muted-strong); font-size: 10px; }.guest-empty, .guest-feedback { min-height: 180px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; border: 1px solid var(--line); border-radius: 14px; color: var(--muted); text-align: center; }.guest-empty svg, .guest-feedback svg { color: var(--green); }.guest-empty strong, .guest-feedback strong { color: var(--paper); font-size: 14px; }.guest-empty p, .guest-feedback p { margin: 0; font-size: 12px; }.guest-feedback .button { margin-top: 8px; }
@media (max-width: 1000px) { .guest-header { gap: 25px; }.guest-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.guest-hero-mark { width: 180px; height: 180px; }.guest-hero-mark span { font-size: 67px; } }
@media (max-width: 680px) { .guest-header { padding: 14px 20px 0; flex-wrap: wrap; gap: 0; }.guest-brand { order: 0; }.guest-account { order: 1; gap: 12px; }.guest-nav { order: 2; width: 100%; height: 49px; gap: 24px; overflow-x: auto; }.guest-badge { padding: 6px 8px; }.guest-main { width: min(100% - 32px, 1240px); padding-top: 24px; }.guest-hero { min-height: 0; padding: 29px 24px; }.guest-hero-mark { display: none; }.guest-hero h1 { font-size: 35px; }.guest-hero p { font-size: 13px; }.guest-actions { margin-top: 24px; }.guest-actions .button { flex: 1 1 auto; }.guest-access-note { margin-bottom: 36px; }.guest-card-grid { grid-template-columns: 1fr; }.guest-card { min-height: 0; }.guest-section-heading { align-items: start; }.guest-section-heading h2 { font-size: 23px; } }
</style>
