<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const emit = defineEmits(["toast"]);
const modelSearch = ref("");
const keys = ref([]);
const keysLoading = ref(false);
const keysError = ref("");
const apiTasks = ref([]);
const tasksLoading = ref(false);
const tasksError = ref("");
const taskFilter = ref("全部");
const taskSearch = ref("");
const usage = ref(null);
const usageLoading = ref(false);
const usageError = ref("");
const showKeyModal = ref(false);
const keyName = ref("");
const keyScopes = ref(["models:read", "tasks:write"]);
const expiresInDays = ref(90);
const creatingKey = ref(false);
const createdSecret = ref("");
const requestedModelId = new URLSearchParams(props.query).get("model") || "";
const models = ref([]);
const modelsLoading = ref(true);
const modelsError = ref("");
const selectedModel = ref(requestedModelId);
const prompt = ref("一位穿着银白舞台服装的舞者，在流动的青绿色灯光中完成一段现代舞，电影感，稳定镜头。 ");
const codeLanguage = ref("curl");

const section = computed(() => props.path.split("/")[2] || "models");
const filteredTasks = computed(() => apiTasks.value.filter((task) =>
  (taskFilter.value === "全部" || task.status === taskFilter.value)
  && (!taskSearch.value.trim() || task.id.toLowerCase().includes(taskSearch.value.trim().toLowerCase())),
));
const usageByModel = computed(() => Object.entries(usage.value?.byModel || {}).map(([name, value], index) => ({ name, value, tone: ["mint", "blue", "violet", "coral"][index % 4] })));
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
  if (value === "keys") loadKeys();
  if (value === "tasks") loadTasks();
  if (value === "usage") loadUsage();
}, { immediate: true });

const titleMap = {
  models: ["MODEL MARKET", "模型市场", "浏览 Control 返回的模型目录、能力范围与调用方式。"],
  keys: ["API CREDENTIALS", "API Keys", "管理 Control 中的组织级凭证记录；模型网关授权尚未接入。"],
  playground: ["API PLAYGROUND", "Playground", "查看模型参数与调用示例；在线提交尚未接入模型 API。"],
  tasks: ["TASKS & LOGS", "任务与日志", "查看调用状态、错误原因与用量元数据。"],
  usage: ["API USAGE", "用量与预算", "跟踪模型用量、预算进度与调用分布。"],
};
const pageTitle = computed(() => titleMap[section.value] || titleMap.models);

const createKey = async () => {
  if (!keyName.value.trim()) return;
  creatingKey.value = true;
  try {
    const result = await controlApi.createApiKey({ name: keyName.value.trim(), scopes: keyScopes.value, expiresInDays: Number(expiresInDays.value) });
    createdSecret.value = result.secret;
    await loadKeys();
  } catch (cause) {
    keysError.value = cause instanceof Error ? cause.message : "创建 API Key 失败";
  } finally {
    creatingKey.value = false;
  }
};

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

const finishKeyModal = () => {
  showKeyModal.value = false;
  keyName.value = "";
  keyScopes.value = ["models:read", "tasks:write"];
  expiresInDays.value = 90;
  createdSecret.value = "";
};

const copyText = async (value, message = "已复制到剪贴板") => {
  await navigator.clipboard?.writeText(value);
  emit("toast", message);
};

const codeSamples = {
  curl: `curl https://api.verdantflarehub.com/v1/videos \\\n  -H "Authorization: Bearer $VF_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "verdantflare-sd2",\n    "prompt": "A cinematic modern dancer..."\n  }'`,
  javascript: `const task = await client.videos.create({\n  model: "verdantflare-sd2",\n  prompt: "A cinematic modern dancer...",\n});\n\nconsole.log(task.id);`,
  python: `task = client.videos.create(\n    model="verdantflare-sd2",\n    prompt="A cinematic modern dancer...",\n)\n\nprint(task.id)`,
};
</script>

<template>
  <div class="page api-page">
    <header class="page-header api-header">
      <div><span class="page-overline">{{ pageTitle[0] }}</span><h1>{{ pageTitle[1] }}</h1><p>{{ pageTitle[2] }}</p></div>
      <button v-if="section === 'keys'" class="button primary" @click="showKeyModal = true"><AppIcon name="plus" :size="17" />创建 API Key</button>
      <button v-if="section === 'tasks'" class="button secondary" :disabled="tasksLoading" @click="loadTasks">刷新状态</button>
      <button v-if="section === 'usage'" class="button secondary" :disabled="usageLoading" @click="loadUsage">刷新用量</button>
    </header>

    <template v-if="section === 'models'">
      <div class="catalog-banner"><div><span>MODEL CATALOG</span><h2>先发现合适的模型，再确认调用权限。</h2><p>模型实际调用仍由 api.verdantflarehub.com 管理；Control 目录和网关授权尚未同步。</p></div><button class="button light" @click="navigate('/api/keys')">查看 API Key 记录<AppIcon name="arrow" :size="16" /></button></div>
      <section v-if="modelsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>模型市场加载失败</strong><p>{{ modelsError }}</p></div><button class="button secondary" @click="loadModels">重新加载</button></section>
      <div class="catalog-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="modelSearch" type="search" placeholder="搜索模型或提供方" /></label><span>{{ modelsLoading ? '正在加载模型…' : `${filteredModels.length} 个目录模型` }}</span></div>
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>模型不在当前目录</strong><p>模型 {{ unavailableRequestedModel }} 未由 Control 返回，请检查模型 ID 或稍后刷新。</p></div></section>
      <section class="model-list">
        <article v-for="model in filteredModels" :key="model.id" class="model-row" :class="{ 'is-targeted': model.id === requestedModelId }">
          <div class="model-logo">{{ model.name.slice(0, 2).toUpperCase() }}</div>
          <div class="model-title"><strong>{{ model.name }}</strong><span>{{ model.provider }} · {{ model.type }}</span></div>
          <dl><div><dt>上下文 / 输入</dt><dd>{{ model.context }}</dd></div><div><dt>典型响应</dt><dd>{{ model.latency }}</dd></div><div><dt>参考价格</dt><dd>{{ model.price }}</dd></div></dl>
          <StatusBadge :label="model.status" />
          <button class="row-link" @click="navigate(`/api/playground?model=${encodeURIComponent(model.id)}`)">调试<AppIcon name="arrow" :size="15" /></button>
        </article>
      </section>
      <div v-if="!modelsLoading && !modelsError && !filteredModels.length" class="empty-state"><AppIcon name="search" :size="26" /><strong>暂无可用模型</strong><span>当前组织的模型目录为空，或没有匹配的搜索结果。</span></div>
    </template>

    <template v-else-if="section === 'keys'">
      <section class="security-callout"><AppIcon name="key" :size="22" /><div><strong>Control Key 只在创建时完整显示一次</strong><p>当前 Key 仅在 Control 保存与撤销，尚未同步到模型网关；请勿将它当作可调用 verdantflare-api 的凭证。</p></div></section>
      <section v-if="keysError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>API Key 操作失败</strong><p>{{ keysError }}</p></div><button class="button secondary" @click="loadKeys">重新加载</button></section>
      <p v-if="keysLoading">正在加载 API Key…</p>
      <div class="data-table keys-table">
        <div class="table-head"><span>名称</span><span>Key</span><span>权限范围</span><span>创建时间</span><span>最后使用</span><span>状态</span><span /></div>
        <div v-for="key in keys" :key="key.id" class="table-row"><span><strong>{{ key.name }}</strong><small>{{ key.id }}</small></span><code>{{ key.prefix }}</code><span class="scope-list"><i v-for="scope in key.scopes" :key="scope">{{ scope }}</i></span><span>{{ formatDate(key.createdAt || key.created) }}</span><span>{{ formatDateTime(key.lastUsedAt || key.lastUsed) }}</span><StatusBadge :label="key.status" /><button v-if="key.status === '有效'" class="row-action" :aria-label="`撤销 ${key.name}`" @click="revokeKey(key)"><AppIcon name="close" :size="15" /></button><span v-else /></div>
      </div>
      <p v-if="!keysLoading && !keysError && !keys.length">暂无 API Key。创建后仅显示一次完整密钥。</p>
    </template>

    <template v-else-if="section === 'playground'">
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>目标模型当前不可用</strong><p>已为你打开默认模型；{{ unavailableRequestedModel }} 不在当前目录中。</p></div></section>
      <section class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>在线调试尚未连接模型网关</strong><p>此页不会模拟成功结果或扣减额度。模型调用与 Key 授权需完成与 verdantflare-api 的服务端对接。</p></div></section>
      <div class="playground-shell">
        <section class="playground-form">
          <label class="form-field"><span>模型</span><select v-model="selectedModel" :disabled="modelsLoading || models.length === 0"><option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}</option></select></label>
          <label class="form-field"><span>提示词</span><textarea v-model="prompt" rows="8" /></label>
          <div class="inline-fields"><label class="form-field"><span>时长</span><select><option>5 秒</option><option>10 秒</option></select></label><label class="form-field"><span>画面比例</span><select><option>16:9</option><option>9:16</option><option>1:1</option></select></label></div>
          <div class="request-estimate"><span>计费提示</span><strong>以模型网关为准</strong><small>当前页面不会发起请求或扣减额度</small></div>
          <button class="button primary full" disabled><AppIcon name="spark" :size="17" />在线调试待接入</button>
        </section>
        <section class="playground-result">
          <header><div><span>响应预览</span><small>未提交请求</small></div></header>
          <div class="result-empty"><div><AppIcon name="playground" :size="30" /></div><strong>暂无真实任务响应</strong><p>模型网关接入后将在此显示实际任务和用量。</p></div>
        </section>
      </div>
      <section class="playground-code"><div class="code-tabs"><button v-for="lang in ['curl', 'javascript', 'python']" :key="lang" :class="{ active: codeLanguage === lang }" @click="codeLanguage = lang">{{ lang }}</button><button class="copy-code" @click="copyText(codeSamples[codeLanguage])"><AppIcon name="copy" :size="15" />复制代码</button></div><pre><code>{{ codeSamples[codeLanguage] }}</code></pre></section>
    </template>

    <template v-else-if="section === 'tasks'">
      <section v-if="tasksError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>任务加载失败</strong><p>{{ tasksError }}</p></div><button class="button secondary" @click="loadTasks">重新加载</button></section>
      <div class="metric-grid compact"><MetricCard label="任务记录" :value="String(apiTasks.length)" detail="当前组织" icon="tasks" tone="mint" /><MetricCard label="运行中" :value="String(apiTasks.filter((task) => task.status === '运行中').length)" detail="当前状态" icon="experience" tone="blue" /><MetricCard label="成功" :value="String(apiTasks.filter((task) => task.status === '成功').length)" detail="已返回任务" icon="check" tone="violet" /></div>
      <div class="task-filters"><button v-for="filter in ['全部', '运行中', '成功', '失败']" :key="filter" :class="{ active: taskFilter === filter }" @click="taskFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input v-model="taskSearch" placeholder="搜索 Task ID" /></label></div>
      <p v-if="tasksLoading">正在加载任务…</p>
      <div class="data-table tasks-table"><div class="table-head"><span>Task ID</span><span>模型</span><span>创建时间</span><span>耗时</span><span>用量</span><span>状态</span><span /></div><div v-for="task in filteredTasks" :key="task.id" class="table-row"><code>{{ task.id }}</code><strong>{{ task.model }}</strong><span>{{ task.created }}</span><span>{{ task.duration }}</span><span>{{ task.usage }}</span><StatusBadge :label="task.status" /><span /></div></div>
      <p v-if="!tasksLoading && !tasksError && !filteredTasks.length">暂无匹配任务。</p>
    </template>

    <template v-else-if="section === 'usage'">
      <section v-if="usageError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>用量加载失败</strong><p>{{ usageError }}</p></div><button class="button secondary" @click="loadUsage">重新加载</button></section>
      <p v-if="usageLoading">正在读取用量…</p>
      <template v-if="usage && !usageError">
        <section class="budget-band"><div><span>本月 API 预算</span><strong>{{ usage.used.toLocaleString() }} <small>/ {{ usage.budget.toLocaleString() }} 点</small></strong><p>剩余 {{ usage.remaining.toLocaleString() }} 点 · 已使用 {{ usage.percentage.toFixed(1) }}%</p></div><div class="budget-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><circle class="progress" cx="40" cy="40" r="32" :style="{ strokeDashoffset: 201 * (1 - Math.min(100, Math.max(0, usage.percentage)) / 100) }" /></svg><strong>{{ usage.percentage.toFixed(1) }}%</strong></div></section>
        <div class="usage-layout"><section class="content-panel"><div class="section-heading"><div><h2>用量摘要</h2><p>当前后端提供组织总量；逐日明细尚未接入。</p></div></div><div class="metric-grid compact"><MetricCard label="预算" :value="`${usage.budget.toLocaleString()} 点`" icon="usage" tone="mint" /><MetricCard label="已使用" :value="`${usage.used.toLocaleString()} 点`" icon="tasks" tone="blue" /><MetricCard label="剩余" :value="`${usage.remaining.toLocaleString()} 点`" icon="check" tone="violet" /></div></section><section class="content-panel model-distribution"><div class="section-heading"><div><h2>模型分布</h2><p>后端返回的消耗比例</p></div></div><div v-for="item in usageByModel" :key="item.name" class="distribution-row"><div><span><i :class="item.tone" />{{ item.name }}</span><strong>{{ item.value }}%</strong></div><div class="distribution-track"><i :class="item.tone" :style="{ width: `${item.value}%` }" /></div></div><p v-if="!usageByModel.length">暂无模型用量明细。</p></section></div>
      </template>
    </template>

    <Transition name="modal">
      <div v-if="showKeyModal" class="modal-backdrop" @click.self="finishKeyModal">
        <section class="modal-card key-modal"><header><div><span class="page-overline">NEW CREDENTIAL</span><h2>{{ createdSecret ? '保存你的 API Key' : '创建 API Key' }}</h2><p>{{ createdSecret ? '离开此窗口后将无法再次查看完整 Key。' : '使用最小权限，并为不同环境创建独立 Key。' }}</p></div><button class="icon-button" aria-label="关闭弹窗" @click="finishKeyModal"><AppIcon name="close" /></button></header>
          <template v-if="!createdSecret"><label class="form-field"><span>Key 名称</span><input v-model="keyName" placeholder="例如：内容生产服务" autofocus /></label><label class="form-field"><span>权限范围</span><div class="checkbox-list"><label><input v-model="keyScopes" type="checkbox" value="models:read" disabled /><span><strong>models:read</strong><small>读取已授权模型</small></span></label><label><input v-model="keyScopes" type="checkbox" value="tasks:write" /><span><strong>tasks:write</strong><small>创建和读取任务</small></span></label><label><input v-model="keyScopes" type="checkbox" value="usage:read" /><span><strong>usage:read</strong><small>读取组织用量</small></span></label></div></label><label class="form-field"><span>有效期（天）</span><input v-model.number="expiresInDays" type="number" min="1" max="365" /></label><footer><button class="button secondary" @click="finishKeyModal">取消</button><button class="button primary" :disabled="!keyName.trim() || creatingKey || expiresInDays < 1 || expiresInDays > 365" @click="createKey">{{ creatingKey ? '正在创建…' : '创建 Key' }}</button></footer></template>
          <template v-else><div class="secret-box"><code>{{ createdSecret }}</code><button @click="copyText(createdSecret, 'API Key 已复制')"><AppIcon name="copy" :size="16" />复制</button></div><div class="secret-warning"><AppIcon name="warning" :size="18" /><span>请立即保存到安全的密钥管理工具，不要发送到聊天或邮件。</span></div><footer><button class="button primary full" @click="finishKeyModal">我已安全保存</button></footer></template>
        </section>
      </div>
    </Transition>
  </div>
</template>
