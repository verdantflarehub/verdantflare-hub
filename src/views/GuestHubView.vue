<script setup>
import { computed, onMounted, ref, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import CatalogCard from "../components/CatalogCard.vue";
import { controlApi } from "../api/control";
import { navigate, replace } from "../router";
import { resolvedMarketAppId } from "../utils/marketNavigation";

const props = defineProps({
  path: { type: String, default: "/" },
  logoutUrl: { type: String, required: true },
});
const emit = defineEmits(["retry-context"]);

const models = ref([]);
const apps = ref([]);
const loading = ref(true);
const error = ref("");
const section = computed(() => props.path.startsWith("/api/models") ? "models" : props.path.startsWith("/market") ? "apps" : "overview");
const title = computed(() => ({ overview: "探索 VerdantFlare", models: "模型目录", apps: "应用市场" })[section.value]);
const modelId = computed(() => props.path.startsWith("/api/models/") ? props.path.slice("/api/models/".length) : "");
const appId = computed(() => props.path.startsWith("/market/apps/") ? props.path.slice("/market/apps/".length) : "");
const selectedModel = computed(() => models.value.find((model) => model.id === modelId.value));
const selectedApp = computed(() => apps.value.find((app) => app.id === resolvedMarketAppId(appId.value, apps.value)));
watch([appId, selectedApp], ([id, app]) => {
  if (id && app?.id !== id) replace(`/market/apps/${app.id}${window.location.search}${window.location.hash}`);
});

const loadCatalog = async () => {
  loading.value = true;
  error.value = "";
  try {
    const catalog = await controlApi.getGuestCatalog();
    if (!Array.isArray(catalog?.models) || !Array.isArray(catalog?.apps)) throw new Error("待开通目录响应格式不正确");
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
      <nav class="guest-nav" aria-label="待开通账号导航">
        <button type="button" :aria-current="section === 'overview' ? 'page' : undefined" @click="navigate('/')">概览</button>
        <button type="button" :aria-current="section === 'models' ? 'page' : undefined" @click="navigate('/api/models')">模型市场</button>
        <button type="button" :aria-current="section === 'apps' ? 'page' : undefined" @click="navigate('/market')">应用市场</button>
      </nav>
      <div class="guest-account"><span class="guest-badge"><i />待开通</span><a :href="logoutUrl">退出登录</a></div>
    </header>

    <main class="guest-main">
      <section class="guest-hero">
        <div class="guest-hero-copy">
          <span class="guest-eyebrow">VERDANTFLARE / DISCOVER</span>
          <h1>{{ title }}<span class="guest-title-dot">.</span></h1>
          <p>你已完成登录，可以查看模型与已收录应用的资料。加入组织后，可按权限使用已开放的模型体验、API Key 与组织工作台。</p>
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
        <div><strong>账号待开通 · 可浏览目录</strong><p>模型与应用资料可浏览；调用、体验和组织功能须在加入组织后按权限开放。请联系组织管理员分配组织，完成后点击“检查组织权限”。</p></div>
      </section>

      <section v-if="loading" class="guest-feedback" aria-live="polite"><div class="loading-ring" /><strong>正在读取目录</strong></section>
      <section v-else-if="error" class="guest-feedback" role="alert"><AppIcon name="warning" :size="25" /><strong>目录暂时无法加载</strong><p>{{ error }}</p><button class="button secondary" type="button" @click="loadCatalog">重试目录</button></section>

      <template v-else>
        <section v-if="modelId || appId" class="guest-catalog guest-detail">
          <button class="button secondary" type="button" @click="navigate(modelId ? '/api/models' : '/market')">返回{{ modelId ? '模型' : '应用' }}目录</button>
          <div v-if="modelId && selectedModel" class="guest-detail-panel">
            <span class="guest-eyebrow">MODEL / {{ selectedModel.provider }}</span><h2>{{ selectedModel.name }}</h2><p>{{ selectedModel.summary }}</p>
            <div class="guest-detail-tags"><span v-for="tag in selectedModel.categories || []" :key="tag">{{ tag }}</span></div>
            <dl><div v-if="selectedModel.context"><dt>上下文</dt><dd>{{ selectedModel.context }}</dd></div><div v-if="selectedModel.maxInput"><dt>最大输入</dt><dd>{{ selectedModel.maxInput }}</dd></div><div v-if="selectedModel.maxOutput"><dt>最大输出</dt><dd>{{ selectedModel.maxOutput }}</dd></div><div v-if="selectedModel.inputPrice"><dt>输入参考报价</dt><dd>{{ selectedModel.inputPrice }} {{ selectedModel.priceUnit }}</dd></div><div v-if="selectedModel.outputPrice"><dt>输出参考报价</dt><dd>{{ selectedModel.outputPrice }} {{ selectedModel.priceUnit }}</dd></div></dl>
            <p class="guest-detail-note">这是公开资料。加入组织后才能申请 API Key 或在线体验；目录报价不代表实际结算。</p>
          </div>
          <div v-else-if="appId && selectedApp" class="guest-detail-panel">
            <span class="guest-eyebrow">APP / {{ selectedApp.category }}</span><h2>{{ selectedApp.name }}</h2><p>{{ selectedApp.description || selectedApp.summary }}</p>
            <div class="guest-detail-tags"><span>{{ selectedApp.channel === 'Listed' ? '资料已收录' : '目录版本已发布' }}</span><span v-if="selectedApp.version">v{{ selectedApp.version }}</span><span v-if="selectedApp.developer">{{ selectedApp.developer }}</span></div>
            <div v-if="selectedApp.showcase?.screenshots?.length" class="guest-detail-shots"><img v-for="shot in selectedApp.showcase.screenshots.slice(0, 3)" :key="shot" :src="shot" :alt="`${selectedApp.name} 展示图片`" loading="lazy" /></div>
            <ul v-if="selectedApp.showcase?.highlights?.length"><li v-for="highlight in selectedApp.showcase.highlights" :key="highlight">{{ highlight }}</li></ul>
            <p class="guest-detail-note">仅供了解。加入组织后的实际权益与 Station 可安装状态需另行核验。</p>
          </div>
          <div v-else class="guest-feedback"><strong>目录中找不到该资料</strong><p>这条记录可能已下架或不再对待开通账号展示。</p></div>
        </section>
        <section v-if="!modelId && !appId && section !== 'apps'" class="guest-catalog" aria-labelledby="guest-model-heading">
          <div class="guest-section-heading"><div><span>MODEL MARKET</span><h2 id="guest-model-heading">公开模型</h2><p>来自已公开的 Control 目录，不包含调用额度或实时可用性。</p></div><strong>{{ models.length }} 个模型</strong></div>
          <div v-if="models.length" class="catalog-card-grid">
            <CatalogCard v-for="model in models" :key="model.id" :title="model.name" :meta="`${model.provider} · ${model.id}`" :description="model.summary" icon="models" :icon-url="model.providerIconUrl" :tags="[...(model.categories || []), ...(model.context ? [`上下文 ${model.context}`] : [])]" status="仅供浏览" :actions="[{ label: '查看资料', to: `/api/models/${encodeURIComponent(model.id)}` }]" />
          </div>
          <div v-else class="guest-empty"><AppIcon name="models" :size="25" /><strong>暂无公开模型</strong><p>管理员发布后，这里会自动显示真实目录记录。</p></div>
        </section>

        <section v-if="!modelId && !appId && section !== 'models'" class="guest-catalog" aria-labelledby="guest-app-heading">
          <div class="guest-section-heading"><div><span>APP MARKET</span><h2 id="guest-app-heading">已收录应用</h2><p>浏览 Hub 已上架资料；是否可安装和运行，须由当前 Station 在 Studio 中核验。</p></div><strong>{{ apps.length }} 个应用</strong></div>
          <div v-if="apps.length" class="catalog-card-grid">
            <CatalogCard v-for="app in apps" :key="app.id" :title="app.name" :meta="[app.developer || app.category, app.version ? `v${app.version}` : '资料已收录'].join(' · ')" :description="app.summary" icon="market" :icon-url="app.iconUrl" :icon-ref="app.iconRef || ''" :brand="app.brand || ''" :tags="[app.category, app.channel === 'Listed' ? '资料已收录' : '目录版本已发布'].filter(Boolean)" status="仅供浏览" :actions="[{ label: '查看资料', to: `/market/apps/${encodeURIComponent(app.id)}` }]" />
          </div>
          <div v-else class="guest-empty"><AppIcon name="market" :size="25" /><strong>暂无已收录应用</strong><p>管理员上架后，这里会自动显示真实目录记录。</p></div>
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
.guest-catalog + .guest-catalog { margin-top: 54px; }.guest-section-heading { margin-bottom: 21px; display: flex; align-items: end; justify-content: space-between; gap: 16px; }.guest-section-heading h2 { margin: 8px 0 5px; font-size: 25px; letter-spacing: -.035em; }.guest-section-heading p { margin: 0; color: var(--muted); font-size: 12px; }.guest-section-heading > strong { color: var(--muted-strong); font-size: 12px; font-weight: 550; white-space: nowrap; }.guest-empty, .guest-feedback { min-height: 180px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; border: 1px solid var(--line); border-radius: 14px; color: var(--muted); text-align: center; }.guest-empty svg, .guest-feedback svg { color: var(--green); }.guest-empty strong, .guest-feedback strong { color: var(--paper); font-size: 14px; }.guest-empty p, .guest-feedback p { margin: 0; font-size: 12px; }.guest-feedback .button { margin-top: 8px; }
.guest-detail > .button { margin-bottom: 18px; }.guest-detail-panel { padding: clamp(24px, 4vw, 42px); border: 1px solid var(--line); border-radius: 14px; background: var(--surface, #111b15); }.guest-detail-panel h2 { margin: 12px 0 16px; font-size: clamp(27px, 3vw, 38px); letter-spacing: -.04em; }.guest-detail-panel > p { max-width: 760px; color: var(--muted-strong); line-height: 1.8; white-space: pre-wrap; }.guest-detail-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0; }.guest-detail-tags span { padding: 6px 9px; border: 1px solid var(--line); border-radius: 6px; color: var(--muted-strong); font-size: 12px; }.guest-detail-panel dl { display: flex; flex-wrap: wrap; gap: 14px; }.guest-detail-panel dl > div { min-width: 130px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; }.guest-detail-panel dt { color: var(--muted); font-size: 11px; }.guest-detail-panel dd { margin: 6px 0 0; font-size: 13px; }.guest-detail-panel li { margin: 8px 0; color: var(--muted-strong); font-size: 13px; }.guest-detail-panel .guest-detail-note { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.guest-detail-shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px; margin: 24px 0; }.guest-detail-shots img { width: 100%; height: 180px; object-fit: cover; border: 1px solid var(--line); border-radius: 8px; }
@media (max-width: 1000px) { .guest-header { gap: 25px; }.guest-hero-mark { width: 180px; height: 180px; }.guest-hero-mark span { font-size: 67px; } }
@media (max-width: 680px) { .guest-header { padding: 14px 20px 0; flex-wrap: wrap; gap: 0; }.guest-brand { order: 0; }.guest-account { order: 1; gap: 12px; }.guest-nav { order: 2; width: 100%; height: 49px; gap: 24px; overflow-x: auto; }.guest-badge { padding: 6px 8px; }.guest-main { width: min(100% - 32px, 1240px); padding-top: 24px; }.guest-hero { min-height: 0; padding: 29px 24px; }.guest-hero-mark { display: none; }.guest-hero h1 { font-size: 35px; }.guest-hero p { font-size: 13px; }.guest-actions { margin-top: 24px; }.guest-actions .button { flex: 1 1 auto; }.guest-access-note { margin-bottom: 36px; }.guest-section-heading { align-items: start; }.guest-section-heading h2 { font-size: 23px; } }
</style>
