<script setup>
import { onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";

const emit = defineEmits(["toast"]);
const models = ref([]);
const gatewayModels = ref([]);
const gatewayError = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const selectedId = ref("");
const draft = ref(null);
const categoriesText = ref("");

const blank = () => ({ id: "", name: "", provider: "", summary: "", categories: [], context: "", maxInput: "", maxOutput: "", inputPrice: "", outputPrice: "", cachePrice: "", priceUnit: "", publicVisible: false, experienceMode: "" });
const select = (model) => {
  selectedId.value = model?.id || "";
  draft.value = model ? { ...model, experienceMode: model.experienceMode || "" } : blank();
  categoriesText.value = (model?.categories || []).join("、");
  error.value = "";
};
const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    models.value = await controlApi.listManagedModels();
    if (selectedId.value) select(models.value.find((item) => item.id === selectedId.value));
    else if (!draft.value) select(null);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "模型目录加载失败";
  } finally { loading.value = false; }
  try {
    gatewayModels.value = await controlApi.listGatewayModels();
    gatewayError.value = "";
  } catch (cause) {
    gatewayModels.value = [];
    gatewayError.value = cause instanceof Error ? cause.message : "模型网关目录核验失败";
  }
};
const save = async () => {
  if (!draft.value) return;
  saving.value = true;
  error.value = "";
  try {
    const payload = { ...draft.value, experienceMode: draft.value.publicVisible ? draft.value.experienceMode : "", categories: categoriesText.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) };
    const result = selectedId.value
      ? await controlApi.updateManagedModel(selectedId.value, payload)
      : await controlApi.createManagedModel(payload);
    selectedId.value = result.id;
    await load();
    emit("toast", result.experienceMode === "chat" ? "模型已上架并开放文本体验" : result.publicVisible ? "模型已上架，在线体验关闭" : "模型草稿已保存，WWW 不会展示");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "模型保存失败";
  } finally { saving.value = false; }
};
onMounted(load);
</script>

<template>
  <div class="page ops-page">
    <header class="page-header"><div><span class="page-overline internal-overline">MODEL PUBLICATION</span><h1>模型上架</h1><p>同一上架状态控制 WWW 与 Hub 展示；只展示网关当前列出的模型。公开报价不代表最终结算价格。</p></div><button class="button secondary" @click="select(null)"><AppIcon name="plus" :size="17" />新建草稿</button></header>
    <section v-if="error" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
    <section v-if="gatewayError" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>网关目录不可用</strong><p>{{ gatewayError }}。可编辑草稿，暂不能上架；请检查 Control 的网关凭据。</p></div><button class="button secondary" @click="load">重新核验</button></section>
    <p v-if="loading">正在读取模型目录…</p>
    <div class="model-admin-grid">
      <section class="content-panel"><div class="section-heading"><div><h2>目录记录</h2><p>{{ models.length }} 条落库记录</p></div></div>
        <div v-if="models.length" class="data-table model-admin-list"><div class="table-head"><span>模型</span><span>状态</span><span /></div><button v-for="model in models" :key="model.id" class="table-row" :class="{ selected: selectedId === model.id }" type="button" @click="select(model)"><span><strong>{{ model.name }}</strong><small>{{ model.id }} · {{ model.provider }}</small></span><span>{{ model.publicVisible ? (gatewayError ? '核验失败' : gatewayModels.includes(model.id) ? model.experienceMode === 'chat' ? '已上架 · 可体验' : '已上架 · 体验关闭' : '网关未列出') : '草稿' }}</span><AppIcon name="arrow" :size="15" /></button></div>
        <p v-else-if="!loading">暂无模型。新建草稿并填写经审核的资料后再公开。</p>
      </section>
      <section v-if="draft" class="content-panel manifest-panel"><div class="section-heading"><div><h2>{{ selectedId ? '编辑模型' : '新建模型草稿' }}</h2><p>模型 ID 必须与 new-api 完全一致；未核实的价格或规格留空。</p></div></div>
        <div class="two-column-form"><label class="form-field"><span>模型 ID</span><input v-model.trim="draft.id" :disabled="!!selectedId" list="gateway-model-options" required /><datalist id="gateway-model-options"><option v-for="id in gatewayModels" :key="id" :value="id" /></datalist></label><label class="form-field"><span>名称</span><input v-model.trim="draft.name" required /></label><label class="form-field"><span>提供方</span><input v-model.trim="draft.provider" required /></label><label class="form-field"><span>类别（用顿号分隔）</span><input v-model="categoriesText" required /></label></div>
        <label class="form-field"><span>公开简介</span><textarea v-model.trim="draft.summary" rows="3" required /></label>
        <div class="two-column-form"><label class="form-field"><span>上下文</span><input v-model.trim="draft.context" /></label><label class="form-field"><span>最大输入</span><input v-model.trim="draft.maxInput" /></label><label class="form-field"><span>最大输出</span><input v-model.trim="draft.maxOutput" /></label><label class="form-field"><span>报价单位（如 点/百万 tokens）</span><input v-model.trim="draft.priceUnit" /></label><label class="form-field"><span>输入报价</span><input v-model.trim="draft.inputPrice" /></label><label class="form-field"><span>输出报价</span><input v-model.trim="draft.outputPrice" /></label><label class="form-field"><span>缓存报价</span><input v-model.trim="draft.cachePrice" /></label><label class="form-field"><span>WWW / Hub 状态</span><select v-model="draft.publicVisible" :disabled="!selectedId"><option :value="false">草稿，不公开</option><option :value="true" :disabled="!gatewayModels.includes(draft.id)">上架至 WWW 与 Hub</option></select></label></div>
        <label class="form-field"><span>Hub 在线体验</span><select v-model="draft.experienceMode" :disabled="!selectedId || !draft.publicVisible || !!gatewayError || !gatewayModels.includes(draft.id)"><option value="">关闭体验</option><option value="chat">开放文本对话体验（真实计费）</option></select></label>
        <p class="model-experience-history-empty">上架与体验分别控制。仅为支持 OpenAI Chat Completions 的文本模型开启；每次调用使用组织真实 API 额度，视频与图像模型需独立体验流程。</p>
        <p v-if="draft.id && !gatewayError && !gatewayModels.includes(draft.id)" class="ops-note">该模型未出现在当前网关 Token 的模型列表；上架前请确认渠道、分组与计费配置。</p>
        <footer><button class="button primary" :disabled="saving || !draft.id || !draft.name || !draft.provider || !draft.summary || !categoriesText" @click="save">{{ saving ? '正在保存…' : '保存模型资料' }}</button></footer>
      </section>
    </div>
  </div>
</template>
