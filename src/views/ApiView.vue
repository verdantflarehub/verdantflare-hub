<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import CatalogCard from "../components/CatalogCard.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";
import { formatQuotaUSD, formatUsagePercent } from "../utils/quota";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const emit = defineEmits(["toast"]);
const modelSearch = ref("");
const keys = ref([]);
const keysLoading = ref(false);
const keysError = ref("");
const showCreateKey = ref(false);
const keyDraft = ref({ name: "", scopes: [], expiresInDays: 90, requestId: "" });
const creatingKey = ref(false);
const createdKey = ref(null);
const probeResults = ref({});
const probingKeyId = ref("");
const apiTasks = ref([]);
const tasksLoading = ref(false);
const tasksError = ref("");
const taskFilter = ref("全部");
const taskSearch = ref("");
const usage = ref(null);
const usageLoading = ref(false);
const usageError = ref("");
const requestedModelId = new URLSearchParams(props.query).get("model") || "";
const models = ref([]);
const modelsLoading = ref(true);
const modelsError = ref("");
const selectedModel = ref(requestedModelId);
const codeLanguage = ref("curl");
const canManageKeys = computed(() => props.organization?.roles?.includes("organization_admin") || false);

const section = computed(() => props.path.split("/")[2] || "models");
const filteredTasks = computed(() => apiTasks.value.filter((task) =>
  (taskFilter.value === "全部" || task.status === taskFilter.value)
  && (!taskSearch.value.trim() || task.id.toLowerCase().includes(taskSearch.value.trim().toLowerCase())),
));
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
};
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
};
const filteredModels = computed(() => {
  const keyword = modelSearch.value.trim().toLowerCase();
  return models.value.filter((model) => !keyword || [model.name, model.provider, model.type].some((value) => value.toLowerCase().includes(keyword)));
});
const modelCardTags = (model) => [
  model.context && `上下文 ${model.context}`,
  model.inputPrice && `输入 ${model.inputPrice} ${model.priceUnit || ""}`.trim(),
  model.outputPrice && `输出 ${model.outputPrice} ${model.priceUnit || ""}`.trim(),
].filter(Boolean);
const modelCardActions = (model) => [
  { label: "调用示例", to: `/api/playground?model=${encodeURIComponent(model.id)}` },
  { label: model.experienceMode === "chat" ? "在线体验" : "查看体验入口", to: `/experience?model=${encodeURIComponent(model.id)}`, primary: model.experienceMode === "chat" },
];
const unavailableRequestedModel = computed(() =>
  !modelsLoading.value && requestedModelId && !models.value.some((model) => model.id === requestedModelId)
    ? requestedModelId
    : ""
);

const loadModels = async () => {
  modelsLoading.value = true;
  modelsError.value = "";
  try {
    models.value = (await controlApi.listModels()) || [];
    if (!models.value.some((model) => model.id === selectedModel.value)) {
      selectedModel.value = models.value[0]?.id || "";
    }
  } catch (cause) {
    modelsError.value = cause instanceof Error ? cause.message : "模型市场加载失败";
  } finally {
    modelsLoading.value = false;
  }
};

const loadKeys = async () => {
  keysLoading.value = true;
  keysError.value = "";
  try {
    keys.value = (await controlApi.listApiKeys()) || [];
  } catch (cause) {
    keysError.value = cause instanceof Error ? cause.message : "API Key 加载失败";
  } finally {
    keysLoading.value = false;
  }
};
const loadTasks = async () => {
  tasksLoading.value = true;
  tasksError.value = "";
  try {
    apiTasks.value = (await controlApi.listApiTasks()) || [];
  } catch (cause) {
    tasksError.value = cause instanceof Error ? cause.message : "任务列表加载失败";
  } finally {
    tasksLoading.value = false;
  }
};
const loadUsage = async () => {
  usageLoading.value = true;
  usageError.value = "";
  try {
    usage.value = await controlApi.getApiUsage();
  } catch (cause) {
    usageError.value = cause instanceof Error ? cause.message : "用量加载失败";
  } finally {
    usageLoading.value = false;
  }
};
watch([section, () => props.organization?.organizationId], ([value]) => {
  if (value === "models" || value === "playground") loadModels();
  if (value === "keys") { loadKeys(); loadModels(); }
  if (value === "tasks") loadTasks();
  if (value === "usage") loadUsage();
}, { immediate: true });
watch(() => props.organization?.organizationId, () => {
  createdKey.value = null;
  probeResults.value = {};
  showCreateKey.value = false;
});

const titleMap = {
  models: ["MODEL MARKET", "模型市场", "展示运营已上架且当前网关可见的模型；目录不代表健康测试通过或当前组织拥有调用权限。"],
  keys: ["API CREDENTIALS", "API Keys", "创建限定模型的组织级网关 Key，按实际分配额度调用。"],
  playground: ["API PLAYGROUND", "调用示例", "选择已上架模型，复制示例并用自己的 API Key 调用。"],
  tasks: ["TASKS & LOGS", "任务与日志", "模型网关任务尚未接入；不展示初始化样例任务。"],
  usage: ["API USAGE", "用量与额度", "显示模型网关的组织累计分配、已用与剩余额度；不含未接入的逐日明细。"],
};
const pageTitle = computed(() => titleMap[section.value] || titleMap.models);

const revokeKey = async (key) => {
  if (!window.confirm(`确定撤销「${key.name}」？此操作不可恢复。`)) return;
  keysError.value = "";
  try {
    await controlApi.revokeApiKey(key.id);
    await loadKeys();
    emit("toast", "API Key 已撤销");
  } catch (cause) {
    keysError.value = cause instanceof Error ? cause.message : "撤销 API Key 失败";
  }
};

const openCreateKey = () => {
  keyDraft.value = { name: "", scopes: models.value[0] ? [models.value[0].id] : [], expiresInDays: 90, requestId: crypto.randomUUID() };
  keysError.value = "";
  showCreateKey.value = true;
};
const createKey = async () => {
  creatingKey.value = true;
  keysError.value = "";
  try {
    createdKey.value = await controlApi.createApiKey(keyDraft.value);
    showCreateKey.value = false;
    await loadKeys();
    emit("toast", "API Key 已创建，请立即保存密钥");
  } catch (cause) {
    keysError.value = cause instanceof Error ? cause.message : "创建 API Key 失败";
  } finally {
    creatingKey.value = false;
  }
};
const probeKey = async (key) => {
  probingKeyId.value = key.id;
  try {
    probeResults.value = { ...probeResults.value, [key.id]: await controlApi.probeApiKey(key.id) };
  } catch (cause) {
    probeResults.value = { ...probeResults.value, [key.id]: { ok: false, reason: cause instanceof Error ? cause.message : "网关不可用" } };
  } finally {
    probingKeyId.value = "";
  }
};
const probeReason = (probe) => ({ ok: "Key 可用", revoked: "已撤销", expired: "已过期", organization_disabled: "组织已停用", insufficient_quota: "额度不足", no_available_models: "授权模型当前不可用" })[probe.reason] || probe.reason;

const copyText = async (value, message = "已复制到剪贴板") => {
  try {
    await navigator.clipboard.writeText(value);
    emit("toast", message);
  } catch {
    emit("toast", "复制失败，请手动选择文本");
  }
};

const codeSamples = computed(() => selectedModel.value === "verdantflare-sd2" ? {
  curl: `# 请先设置 VF_API_KEY；保存 REQUEST_ID，超时后查询原任务。\nREQUEST_ID=$(uuidgen)\ncurl https://api.verdantflarehub.com/v1/videos -H "Authorization: Bearer $VF_API_KEY" -H "Idempotency-Key: $REQUEST_ID" -H "Content-Type: application/json" -d '{"model":"verdantflare-sd2","messages":[{"role":"user","content":[{"type":"text","text":"城市夜景视频"}]}],"duration":8}'`,
  javascript: `// Node.js 18+；请先设置 VF_API_KEY。请求 ID 须在提交前持久化，超时后查询原任务。\nimport { randomUUID } from "node:crypto";\nconst requestId = randomUUID();\nconst response = await fetch("https://api.verdantflarehub.com/v1/videos", { method: "POST", headers: { Authorization: "Bearer " + process.env.VF_API_KEY, "Idempotency-Key": requestId, "Content-Type": "application/json" }, body: JSON.stringify({ model: "verdantflare-sd2", messages: [{ role: "user", content: [{ type: "text", text: "城市夜景视频" }] }], duration: 8 }) });\nconsole.log(response.status, await response.json());`,
  python: `# 请先设置 VF_API_KEY；请求 ID 须在提交前持久化，超时后查询原任务。\nimport os, uuid, requests\nrequest_id = str(uuid.uuid4())\nresponse = requests.post("https://api.verdantflarehub.com/v1/videos", headers={"Authorization": "Bearer " + os.environ["VF_API_KEY"], "Idempotency-Key": request_id}, json={"model": "verdantflare-sd2", "messages": [{"role": "user", "content": [{"type": "text", "text": "城市夜景视频"}]}], "duration": 8})\nprint(response.status_code, response.json())`,
} : {
  curl: `curl https://api.verdantflarehub.com/v1/chat/completions -H "Authorization: Bearer $VF_API_KEY" -H "Content-Type: application/json" -d '{"model":"${selectedModel.value}","messages":[{"role":"user","content":"你好"}]}'`,
  javascript: `// Node.js 18+；请先设置 VF_API_KEY。\nconst response = await fetch("https://api.verdantflarehub.com/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + process.env.VF_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model: "${selectedModel.value}", messages: [{ role: "user", content: "你好" }] }) });\nconsole.log(response.status, await response.json());`,
  python: `# 请先设置 VF_API_KEY。\nimport os, requests\nresponse = requests.post("https://api.verdantflarehub.com/v1/chat/completions", headers={"Authorization": "Bearer " + os.environ["VF_API_KEY"]}, json={"model": "${selectedModel.value}", "messages": [{"role": "user", "content": "你好"}]})\nprint(response.status_code, response.json())`,
});
</script>

<template>
  <div class="page api-page">
    <header class="page-header api-header">
      <div><span class="page-overline">{{ pageTitle[0] }}</span><h1>{{ pageTitle[1] }}</h1><p>{{ pageTitle[2] }}</p></div>
      <button v-if="section === 'models'" class="button secondary" @click="navigate('/api/keys')">查看 Key 状态<AppIcon name="arrow" :size="16" /></button>
      <button v-if="section === 'keys' && canManageKeys" class="button primary" :disabled="modelsLoading || !models.length || !!modelsError" @click="openCreateKey"><AppIcon name="plus" :size="17" />创建 API Key</button>
      <button v-if="section === 'tasks'" class="button secondary" :disabled="tasksLoading" @click="loadTasks">刷新状态</button>
      <button v-if="section === 'usage'" class="button secondary" :disabled="usageLoading" @click="loadUsage">刷新用量</button>
    </header>

    <template v-if="section === 'models'">
      <section v-if="modelsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>模型市场加载失败</strong><p>{{ modelsError }}</p></div><button class="button secondary" @click="loadModels">重新加载</button></section>
      <div class="catalog-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="modelSearch" type="search" placeholder="搜索模型或提供方" /></label><span>{{ modelsLoading ? '正在加载模型…' : `${filteredModels.length} 个目录模型` }}</span></div>
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>模型不在当前目录</strong><p>模型 {{ unavailableRequestedModel }} 未由 Control 返回，请检查模型 ID 或稍后刷新。</p></div></section>
      <section class="catalog-card-grid" aria-label="已上架模型">
        <CatalogCard v-for="model in filteredModels" :key="model.id" :title="model.name" :meta="`${model.provider} · ${model.id}`" :description="model.type" icon="models" :tags="modelCardTags(model)" :status="model.experienceMode === 'chat' ? '可体验' : '体验待接入'" :status-tone="model.experienceMode === 'chat' ? 'positive' : 'neutral'" :actions="modelCardActions(model)" :highlighted="model.id === requestedModelId" />
      </section>
      <div v-if="!modelsLoading && !modelsError && !filteredModels.length" class="empty-state"><AppIcon name="search" :size="26" /><strong>暂无已上架模型</strong><span>请运营管理员核对网关模型，并在 Hub 模型上架页公开。</span></div>
    </template>

    <template v-else-if="section === 'keys'">
      <section class="security-callout"><AppIcon name="key" :size="22" /><div><strong>组织级网关凭证</strong><p>仅组织管理员可创建；选择已上架模型和有效期。密钥只在创建成功时显示，请妥善保存。连通性测试不发起付费推理。</p></div></section>
      <section v-if="modelsError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>授权模型加载失败</strong><p>{{ modelsError }}</p></div><button class="button secondary" @click="loadModels">重试</button></section>
      <section v-if="createdKey" class="content-panel key-secret-panel"><div class="section-heading"><div><h2>请立即保存新密钥</h2><p>关闭后不会在 Hub 再次显示。不要把密钥提交到代码库或发送给他人。</p></div><button class="icon-button" aria-label="关闭密钥展示" @click="createdKey = null"><AppIcon name="close" :size="16" /></button></div><div class="key-secret-row"><code>{{ createdKey.secret }}</code><button class="button secondary" @click="copyText(createdKey.secret, '密钥已复制')"><AppIcon name="copy" :size="15" />复制密钥</button></div><p>已授权：{{ createdKey.scopes.join('、') }} · 有效至 {{ formatDate(createdKey.expiresAt) }}</p></section>
      <section v-if="keysError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>API Key 操作失败</strong><p>{{ keysError }}</p></div><button class="button secondary" @click="loadKeys">重新加载</button></section>
      <p v-if="keysLoading">正在加载 API Key…</p>
      <div class="data-table keys-table">
        <div class="table-head"><span>名称</span><span>Key</span><span>权限范围</span><span>创建时间</span><span>最后使用</span><span>状态</span><span /></div>
        <div v-for="key in keys" :key="key.id" class="table-row"><span><strong>{{ key.name }}</strong><small>{{ key.source === 'legacy' ? '历史记录 · 不可调用' : `到期 ${formatDate(key.expiresAt)}` }}</small></span><code>{{ key.prefix }}</code><span class="scope-list"><i v-for="scope in key.scopes" :key="scope">{{ scope }}</i></span><span>{{ formatDate(key.createdAt || key.created) }}</span><span>{{ formatDateTime(key.lastUsedAt || key.lastUsed) }}</span><StatusBadge :label="key.source === 'legacy' ? '历史记录' : ({ active: '有效', revoked: '已撤销', expired: '已过期' })[key.status] || key.status" /><span class="key-actions"><button v-if="key.source === 'gateway' && canManageKeys" class="row-action" :disabled="probingKeyId === key.id" :aria-label="`测试 ${key.name}`" @click="probeKey(key)"><AppIcon name="check" :size="15" /></button><button v-if="key.status === 'active' && canManageKeys" class="row-action" :aria-label="`撤销 ${key.name}`" @click="revokeKey(key)"><AppIcon name="close" :size="15" /></button></span></div>
      </div>
      <p v-if="!keysLoading && !keysError && !keys.length">当前组织尚未创建 API Key。</p>
      <div v-for="key in keys.filter((item) => probeResults[item.id])" :key="`probe-${key.id}`" class="key-probe-result" role="status"><strong>{{ key.name }}：{{ probeReason(probeResults[key.id]) }}</strong><span>剩余 ${{ ((probeResults[key.id].remainingQuota || 0) / 500000).toFixed(2) }} · 可见模型 {{ (probeResults[key.id].models || []).join('、') || '无' }} · 只读验证，未执行推理</span></div>
    </template>

    <template v-else-if="section === 'playground'">
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>目标模型当前不可用</strong><p>已为你打开默认模型；{{ unavailableRequestedModel }} 不在当前目录中。</p></div></section>
      <section class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>调用示例</strong><p>复制下方代码，使用已创建的 Key 发起真实请求；此页面不保存密钥，也不发起付费推理。可在 API Keys 页先执行只读连通性测试。</p></div></section>
      <section class="content-panel call-guide"><div class="section-heading"><div><h2>选择调用模型</h2><p>示例使用已上架模型 ID；请先在 API Keys 页创建包含该模型的 Key，并确认余额充足。</p></div><button class="button secondary" @click="navigate('/api/keys')">管理 API Keys<AppIcon name="arrow" :size="15" /></button></div><label class="form-field"><span>模型</span><select v-model="selectedModel" :disabled="modelsLoading || models.length === 0"><option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }} · {{ model.id }}</option></select></label><p v-if="modelsError" class="form-error">{{ modelsError }}</p><p v-if="!modelsLoading && !modelsError && !models.length">暂无已上架模型，暂不能生成调用示例。</p><p class="credit-help">执行示例会实际计费；下方代码只供复制，本页不会替你提交请求。</p></section>
      <section v-if="selectedModel && !modelsError" class="playground-code"><div class="code-tabs"><button v-for="lang in ['curl', 'javascript', 'python']" :key="lang" :class="{ active: codeLanguage === lang }" @click="codeLanguage = lang">{{ lang }}</button><button class="copy-code" @click="copyText(codeSamples[codeLanguage])"><AppIcon name="copy" :size="15" />复制代码</button></div><pre><code>{{ codeSamples[codeLanguage] }}</code></pre></section>
    </template>

    <template v-else-if="section === 'tasks'">
      <section v-if="tasksError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>任务加载失败</strong><p>{{ tasksError }}</p></div><button class="button secondary" @click="loadTasks">重新加载</button></section>
      <div class="metric-grid compact"><MetricCard label="任务记录" :value="String(apiTasks.length)" detail="当前组织" icon="tasks" tone="mint" /><MetricCard label="运行中" :value="String(apiTasks.filter((task) => task.status === '运行中').length)" detail="当前状态" icon="experience" tone="blue" /><MetricCard label="成功" :value="String(apiTasks.filter((task) => task.status === '成功').length)" detail="已返回任务" icon="check" tone="violet" /></div>
      <div class="task-filters"><button v-for="filter in ['全部', '运行中', '成功', '失败']" :key="filter" :class="{ active: taskFilter === filter }" @click="taskFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input v-model="taskSearch" placeholder="搜索 Task ID" /></label></div>
      <p v-if="tasksLoading">正在加载任务…</p>
      <div class="data-table tasks-table"><div class="table-head"><span>Task ID</span><span>模型</span><span>创建时间</span><span>耗时</span><span>用量</span><span>状态</span><span /></div><div v-for="task in filteredTasks" :key="task.id" class="table-row"><code>{{ task.id }}</code><strong>{{ task.model }}</strong><span>{{ task.created }}</span><span>{{ task.duration }}</span><span>{{ task.usage }}</span><StatusBadge :label="task.status" /><span /></div></div>
      <p v-if="!tasksLoading && !tasksError && !filteredTasks.length">模型网关任务尚未接入，暂无可核验记录。</p>
    </template>

    <template v-else-if="section === 'usage'">
      <section v-if="usageError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>真实用量暂不可用</strong><p>{{ usageError }}</p></div><button class="button secondary" @click="loadUsage">重新加载</button></section>
      <p v-if="usageLoading">正在读取用量…</p>
      <template v-if="usage && !usageError">
        <section class="budget-band"><div><span>组织累计 API 额度</span><strong>{{ formatQuotaUSD(usage.usedQuota) }} <small>/ {{ formatQuotaUSD(usage.budgetQuota) }}</small></strong><p>剩余 {{ formatQuotaUSD(usage.remainingQuota) }} · 已使用 {{ formatUsagePercent(usage.usedQuota, usage.budgetQuota) }}</p></div><div class="budget-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><circle class="progress" cx="40" cy="40" r="32" :style="{ strokeDashoffset: 201 * (1 - Math.min(100, Math.max(0, usage.percentage)) / 100) }" /></svg><strong>{{ formatUsagePercent(usage.usedQuota, usage.budgetQuota) }}</strong></div></section>
        <div class="usage-layout"><section class="content-panel"><div class="section-heading"><div><h2>用量摘要</h2><p>网关组织累计总量；逐日和按模型明细尚未接入。</p></div></div><div class="metric-grid compact"><MetricCard label="累计分配" :value="formatQuotaUSD(usage.budgetQuota)" icon="usage" tone="mint" /><MetricCard label="已使用" :value="formatQuotaUSD(usage.usedQuota)" icon="tasks" tone="blue" /><MetricCard label="剩余" :value="formatQuotaUSD(usage.remainingQuota)" icon="check" tone="violet" /></div></section></div>
      </template>
    </template>

    <Transition name="modal"><div v-if="showCreateKey" class="modal-backdrop" @click.self="showCreateKey = false"><section class="modal-card key-create-modal"><header><div><span class="page-overline">NEW API KEY</span><h2>创建组织 API Key</h2><p>仅授权选中的已上架模型。密钥创建后仅显示一次。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showCreateKey = false"><AppIcon name="close" /></button></header><label class="form-field"><span>名称</span><input v-model.trim="keyDraft.name" maxlength="50" placeholder="例如：生产环境" /></label><div class="form-field"><span>授权模型</span><div class="key-model-options"><label v-for="model in models" :key="model.id"><input v-model="keyDraft.scopes" type="checkbox" :value="model.id" /><span>{{ model.name }}<small>{{ model.id }}</small></span></label></div></div><label class="form-field"><span>有效期</span><select v-model.number="keyDraft.expiresInDays"><option :value="30">30 天</option><option :value="90">90 天</option><option :value="180">180 天</option><option :value="365">365 天</option></select></label><p v-if="keysError" class="form-error">{{ keysError }}</p><footer><button class="button secondary" @click="showCreateKey = false">取消</button><button class="button primary" :disabled="creatingKey || keyDraft.name.trim().length < 2 || !keyDraft.scopes.length" @click="createKey">{{ creatingKey ? '正在创建…' : '创建并显示密钥' }}</button></footer></section></div></Transition>
  </div>
</template>
