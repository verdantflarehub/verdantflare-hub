<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import { navigate } from "../router";

const props = defineProps({ path: { type: String, required: true } });
const emit = defineEmits(["toast"]);
const models = ref([]);
const gatewayModels = ref([]);
const gatewayError = ref("");
const loading = ref(false);
const gatewayLoading = ref(false);
const saving = ref(false);
const error = ref("");
const search = ref("");
const draft = ref(null);
const categoriesText = ref("");

const routeId = computed(() => {
  if (props.path === "/ops/models") return null;
  const segment = props.path.slice("/ops/models/".length);
  if (segment === "new") return "";
  try { return decodeURIComponent(segment); } catch { return segment; }
});
const isDetail = computed(() => routeId.value !== null);
const isNew = computed(() => routeId.value === "");
const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase();
  return models.value.filter((model) => !query || [model.name, model.id, model.provider, ...(model.categories || [])]
    .some((value) => String(value || "").toLowerCase().includes(query)));
});
const canSave = computed(() => draft.value && draft.value.id.trim() && draft.value.name.trim()
  && draft.value.provider.trim() && draft.value.summary.trim() && categoriesText.value.trim());
const blank = () => ({ id: "", name: "", provider: "", summary: "", categories: [], context: "", maxInput: "", maxOutput: "", inputPrice: "", outputPrice: "", cachePrice: "", priceUnit: "", publicVisible: false, experienceMode: "" });
const select = (model) => {
  draft.value = model ? { ...model, experienceMode: model.experienceMode || "" } : blank();
  categoriesText.value = (model?.categories || []).join("、");
};
const gatewayState = (model) => gatewayLoading.value ? "核验中" : gatewayError.value
  ? "待核验" : gatewayModels.value.includes(model.id) ? "已列出" : "未列出";

const loadGateway = async () => {
  gatewayLoading.value = true;
  gatewayError.value = "";
  try {
    gatewayModels.value = await controlApi.listGatewayModels();
  } catch (cause) {
    gatewayModels.value = [];
    gatewayError.value = cause instanceof Error ? cause.message : "模型网关目录核验失败";
  } finally { gatewayLoading.value = false; }
};
const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    models.value = await controlApi.listManagedModels();
    if (isDetail.value) {
      const model = isNew.value ? null : models.value.find((item) => item.id === routeId.value);
      if (!isNew.value && !model) {
        draft.value = null;
        error.value = "模型记录不存在或已被移除";
      } else select(model);
    }
  } catch (cause) {
    draft.value = null;
    error.value = cause instanceof Error ? cause.message : "模型目录加载失败";
  } finally { loading.value = false; }
  await loadGateway();
};
const save = async () => {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      ...draft.value,
      experienceMode: draft.value.publicVisible ? draft.value.experienceMode : "",
      categories: categoriesText.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
    };
    const result = isNew.value
      ? await controlApi.createManagedModel(payload)
      : await controlApi.updateManagedModel(routeId.value, payload);
    emit("toast", result.experienceMode === "chat" ? "模型已上架并开放文本体验"
      : result.publicVisible ? "模型已上架，在线体验关闭" : "模型草稿已保存，WWW 不会展示");
    if (isNew.value) navigate(`/ops/models/${encodeURIComponent(result.id)}`);
    else await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "模型保存失败";
  } finally { saving.value = false; }
};
onMounted(load);
</script>

<template>
  <div class="page ops-page">
    <button v-if="isDetail" class="back-button" type="button" @click="navigate('/ops/models')"><AppIcon name="arrow" :size="16" />返回模型列表</button>
    <header class="page-header">
      <div>
        <span class="page-overline internal-overline">MODEL PUBLICATION</span>
        <h1>{{ isDetail ? (isNew ? "新建模型草稿" : draft?.name || "模型配置") : "模型上架" }}</h1>
        <p v-if="isDetail">模型 ID 必须与 new-api 一致；公开资料、价格和在线体验在此配置。</p>
        <p v-else>同一上架状态控制 WWW 与 Hub 展示；只展示网关当前列出的模型。公开报价不代表最终结算价格。</p>
      </div>
      <button v-if="isDetail && draft" class="button primary" type="button" :disabled="saving || !canSave" @click="save">{{ saving ? "正在保存…" : "保存模型资料" }}</button>
      <button v-else-if="!isDetail" class="button primary" type="button" @click="navigate('/ops/models/new')"><AppIcon name="plus" :size="17" />新建草稿</button>
    </header>

    <section v-if="error" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" type="button" @click="load">重新加载</button></section>
    <section v-if="gatewayError" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>网关目录不可用</strong><p>{{ gatewayError }}。可编辑草稿，暂不能上架；请检查 Control 的网关凭据。</p></div><button class="button secondary" type="button" @click="loadGateway">重新核验</button></section>

    <template v-if="!isDetail">
      <div class="model-admin-toolbar">
        <div><h2>目录记录</h2><p>{{ models.length }} 条落库记录；点击模型进入详情配置。</p></div>
        <label class="search-field"><AppIcon name="search" :size="17" /><input v-model="search" type="search" aria-label="搜索模型" placeholder="搜索名称、ID 或提供方" /></label>
      </div>
      <p v-if="loading">正在读取模型目录…</p>
      <div v-else-if="filteredModels.length" class="data-table model-admin-list">
        <div class="table-head"><span>模型</span><span>提供方</span><span>网关</span><span>WWW / Hub</span><span>在线体验</span><span>操作</span></div>
        <button v-for="model in filteredModels" :key="model.id" class="table-row" type="button" :aria-label="`配置模型 ${model.name}`" @click="navigate(`/ops/models/${encodeURIComponent(model.id)}`)">
          <span class="model-admin-name"><strong>{{ model.name }}</strong><small>{{ model.id }}</small></span>
          <span class="model-admin-provider">{{ model.provider }}</span>
          <span class="model-admin-state model-admin-gateway" :class="{ positive: gatewayState(model) === '已列出' }">{{ gatewayState(model) }}</span>
          <span class="model-admin-state model-admin-visibility" :class="{ positive: model.publicVisible }">{{ model.publicVisible ? "已公开" : "草稿" }}</span>
          <span class="model-admin-state model-admin-experience" :class="{ positive: model.publicVisible && model.experienceMode === 'chat' }">{{ model.publicVisible && model.experienceMode === "chat" ? "可体验" : "关闭" }}</span>
          <span class="model-admin-open">配置<AppIcon name="arrow" :size="15" /></span>
        </button>
      </div>
      <div v-else-if="!error" class="empty-state"><AppIcon :name="search ? 'search' : 'models'" :size="28" /><strong>{{ search ? "没有匹配的模型" : "暂无模型记录" }}</strong><span>{{ search ? "试试其他名称、ID 或提供方。" : "新建草稿并填写经审核的资料后再公开。" }}</span></div>
    </template>

    <form v-else-if="draft" class="model-detail-form" @submit.prevent="save">
      <section class="content-panel">
        <div class="section-heading"><div><h2>基本资料</h2><p>目录中展示的名称、提供方、分类和简介。</p></div></div>
        <div class="two-column-form">
          <label class="form-field"><span>模型 ID</span><input v-model.trim="draft.id" :disabled="!isNew" list="gateway-model-options" required /><datalist id="gateway-model-options"><option v-for="id in gatewayModels" :key="id" :value="id" /></datalist></label>
          <label class="form-field"><span>名称</span><input v-model.trim="draft.name" required /></label>
          <label class="form-field"><span>提供方</span><input v-model.trim="draft.provider" required /></label>
          <label class="form-field"><span>类别（用顿号分隔）</span><input v-model="categoriesText" required /></label>
        </div>
        <label class="form-field"><span>公开简介</span><textarea v-model.trim="draft.summary" rows="3" required /></label>
      </section>

      <section class="content-panel">
        <div class="section-heading"><div><h2>规格与公开报价</h2><p>未核实的价格或规格留空；展示报价不代表最终结算价格。</p></div></div>
        <div class="two-column-form">
          <label class="form-field"><span>上下文</span><input v-model.trim="draft.context" /></label>
          <label class="form-field"><span>最大输入</span><input v-model.trim="draft.maxInput" /></label>
          <label class="form-field"><span>最大输出</span><input v-model.trim="draft.maxOutput" /></label>
          <label class="form-field"><span>报价单位（如 点/百万 tokens）</span><input v-model.trim="draft.priceUnit" /></label>
          <label class="form-field"><span>输入报价</span><input v-model.trim="draft.inputPrice" /></label>
          <label class="form-field"><span>输出报价</span><input v-model.trim="draft.outputPrice" /></label>
          <label class="form-field"><span>缓存报价</span><input v-model.trim="draft.cachePrice" /></label>
        </div>
      </section>

      <section class="content-panel">
        <div class="section-heading"><div><h2>发布与体验</h2><p>上架与体验分别控制；草稿不向 WWW 和 Hub 公开。</p></div></div>
        <div class="two-column-form">
          <label class="form-field"><span>WWW / Hub 状态</span><select v-model="draft.publicVisible" :disabled="isNew"><option :value="false">草稿，不公开</option><option :value="true" :disabled="gatewayLoading || !!gatewayError || !gatewayModels.includes(draft.id)">上架至 WWW 与 Hub</option></select></label>
          <label class="form-field"><span>Hub 在线体验</span><select v-model="draft.experienceMode" :disabled="isNew || !draft.publicVisible || gatewayLoading || !!gatewayError || !gatewayModels.includes(draft.id)"><option value="">关闭体验</option><option value="chat">开放文本对话体验（真实计费）</option></select></label>
        </div>
        <p class="model-admin-help">仅为支持 OpenAI Chat Completions 的文本模型开启在线体验；每次调用使用组织真实 API 额度。视频和图像模型需独立体验流程。</p>
        <p v-if="draft.id && !gatewayLoading && !gatewayError && !gatewayModels.includes(draft.id)" class="ops-note">该模型未出现在当前网关 Token 的模型列表；上架前请确认渠道、分组与计费配置。</p>
      </section>
      <div class="model-detail-actions"><button class="button secondary" type="button" @click="navigate('/ops/models')">返回列表</button><button class="button primary" type="submit" :disabled="saving || !canSave">{{ saving ? "正在保存…" : "保存模型资料" }}</button></div>
    </form>
    <p v-else-if="isDetail && loading">正在读取模型资料…</p>
  </div>
</template>
