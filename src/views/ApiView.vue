<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { apiKeys as seedKeys, apiTasks } from "../data/mock";
import { navigate } from "../router";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const emit = defineEmits(["toast"]);
const modelSearch = ref("");
const keys = ref(structuredClone(seedKeys));
const showKeyModal = ref(false);
const keyName = ref("");
const creatingKey = ref(false);
const createdSecret = ref("");
const requestedModelId = new URLSearchParams(props.query).get("model") || "";
const models = ref([]);
const modelsLoading = ref(true);
const modelsError = ref("");
const selectedModel = ref(requestedModelId);
const prompt = ref("一位穿着银白舞台服装的舞者，在流动的青绿色灯光中完成一段现代舞，电影感，稳定镜头。 ");
const codeLanguage = ref("curl");
const isRunning = ref(false);
const resultState = ref("idle");

const section = computed(() => props.path.split("/")[2] || "models");
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

onMounted(loadModels);

const titleMap = {
  models: ["MODEL MARKET", "模型市场", "浏览组织已授权的模型、价格、能力范围与调用方式。"],
  keys: ["API CREDENTIALS", "API Keys", "创建有范围和有效期的组织级访问凭证。"],
  playground: ["API PLAYGROUND", "Playground", "用组织额度调试模型请求并查看标准响应。"],
  tasks: ["TASKS & LOGS", "任务与日志", "查看调用状态、错误原因与用量元数据。"],
  usage: ["API USAGE", "用量与预算", "跟踪模型用量、预算进度与调用分布。"],
};
const pageTitle = computed(() => titleMap[section.value] || titleMap.models);

const createKey = async () => {
  if (!keyName.value.trim()) return;
  creatingKey.value = true;
  try {
    const result = await controlApi.createApiKey({ name: keyName.value.trim(), scopes: ["models:read", "tasks:write"] });
    createdSecret.value = result.secret;
    keys.value.unshift({ id: result.id, name: result.name, prefix: `${result.secret.slice(0, 13)}••••••••${result.secret.slice(-4)}`, scopes: result.scopes, created: "刚刚", lastUsed: "从未使用", status: "有效" });
  } finally {
    creatingKey.value = false;
  }
};

const finishKeyModal = () => {
  showKeyModal.value = false;
  keyName.value = "";
  createdSecret.value = "";
};

const copyText = async (value, message = "已复制到剪贴板") => {
  await navigator.clipboard?.writeText(value);
  emit("toast", message);
};

const runPlayground = () => {
  isRunning.value = true;
  resultState.value = "running";
  window.setTimeout(() => {
    isRunning.value = false;
    resultState.value = "complete";
    emit("toast", "任务已完成，用量 134 点");
  }, 1400);
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
      <button v-if="section === 'tasks'" class="button secondary" @click="$emit('toast', '任务列表已刷新')">刷新状态</button>
      <button v-if="section === 'usage'" class="button secondary" @click="$emit('toast', '用量报表导出任务已创建')">导出用量</button>
    </header>

    <template v-if="section === 'models'">
      <div class="catalog-banner"><div><span>API 快速开始</span><h2>从模型到第一次成功调用，只需要一个 Key。</h2><p>API 网关继续由 api.verdantflarehub.com 提供；Hub 负责组织权益、凭证管理和使用入口。</p></div><button class="button light" @click="navigate('/api/keys')">创建 API Key<AppIcon name="arrow" :size="16" /></button></div>
      <section v-if="modelsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>模型市场加载失败</strong><p>{{ modelsError }}</p></div><button class="button secondary" @click="loadModels">重新加载</button></section>
      <div class="catalog-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="modelSearch" type="search" placeholder="搜索模型或提供方" /></label><span>{{ modelsLoading ? '正在加载模型…' : `${filteredModels.length} 个模型对本组织可用` }}</span></div>
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>当前组织尚未获得该模型</strong><p>模型 {{ unavailableRequestedModel }} 不在当前组织的授权目录中，可联系管理员申请权益。</p></div></section>
      <section class="model-list">
        <article v-for="model in filteredModels" :key="model.id" class="model-row" :class="{ 'is-targeted': model.id === requestedModelId }">
          <div class="model-logo">{{ model.name.slice(0, 2).toUpperCase() }}</div>
          <div class="model-title"><strong>{{ model.name }}</strong><span>{{ model.provider }} · {{ model.type }}</span></div>
          <dl><div><dt>上下文 / 输入</dt><dd>{{ model.context }}</dd></div><div><dt>典型响应</dt><dd>{{ model.latency }}</dd></div><div><dt>参考价格</dt><dd>{{ model.price }}</dd></div></dl>
          <StatusBadge :label="model.status" />
          <button class="row-link" @click="navigate(`/api/playground?model=${encodeURIComponent(model.id)}`)">调试<AppIcon name="arrow" :size="15" /></button>
        </article>
      </section>
    </template>

    <template v-else-if="section === 'keys'">
      <section class="security-callout"><AppIcon name="key" :size="22" /><div><strong>Key 只在创建时完整显示一次</strong><p>请使用范围最小、有效期明确的 Key；不要将生产 Key 写入前端代码、仓库或日志。</p></div><a href="#">查看安全指南</a></section>
      <div class="data-table keys-table">
        <div class="table-head"><span>名称</span><span>Key</span><span>权限范围</span><span>创建时间</span><span>最后使用</span><span>状态</span><span /></div>
        <div v-for="key in keys" :key="key.id" class="table-row"><span><strong>{{ key.name }}</strong><small>{{ key.id }}</small></span><code>{{ key.prefix }}</code><span class="scope-list"><i v-for="scope in key.scopes" :key="scope">{{ scope }}</i></span><span>{{ key.created }}</span><span>{{ key.lastUsed }}</span><StatusBadge :label="key.status" /><button class="row-action" :aria-label="`管理 ${key.name}`">•••</button></div>
      </div>
      <section class="code-quickstart"><div class="code-heading"><div><span>QUICKSTART</span><strong>验证你的第一个请求</strong></div><button @click="copyText(codeSamples.curl)"><AppIcon name="copy" :size="15" />复制</button></div><pre><code>{{ codeSamples.curl }}</code></pre></section>
    </template>

    <template v-else-if="section === 'playground'">
      <section v-if="unavailableRequestedModel" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>目标模型当前不可用</strong><p>已为你打开默认模型；{{ unavailableRequestedModel }} 尚未授权给当前组织。</p></div></section>
      <div class="playground-shell">
        <section class="playground-form">
          <label class="form-field"><span>模型</span><select v-model="selectedModel" :disabled="modelsLoading || models.length === 0"><option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}</option></select></label>
          <label class="form-field"><span>提示词</span><textarea v-model="prompt" rows="8" /></label>
          <div class="inline-fields"><label class="form-field"><span>时长</span><select><option>5 秒</option><option>10 秒</option></select></label><label class="form-field"><span>画面比例</span><select><option>16:9</option><option>9:16</option><option>1:1</option></select></label></div>
          <div class="request-estimate"><span>预计消耗</span><strong>约 134 点</strong><small>实际用量以任务完成记录为准</small></div>
          <button class="button primary full" :disabled="isRunning || !prompt.trim()" @click="runPlayground"><AppIcon name="spark" :size="17" />{{ isRunning ? '正在生成…' : '运行请求' }}</button>
        </section>
        <section class="playground-result">
          <header><div><span>响应预览</span><small>{{ resultState === 'complete' ? 'task_9D2A · 200 OK' : '等待请求' }}</small></div><StatusBadge v-if="resultState === 'complete'" label="成功" /></header>
          <div v-if="resultState === 'idle'" class="result-empty"><div><AppIcon name="playground" :size="30" /></div><strong>配置并运行一次请求</strong><p>任务响应、媒体预览和用量会显示在这里。</p></div>
          <div v-else-if="resultState === 'running'" class="result-loading"><div class="loading-ring" /><strong>正在提交视频任务</strong><span>准备资源并进入生成队列…</span></div>
          <div v-else class="generated-result"><div class="result-art"><span class="dancer-head" /><span class="dancer-body" /><i class="light-line one" /><i class="light-line two" /><i class="light-line three" /></div><div class="result-meta"><span>1920 × 1080 · 5 秒 · MP4</span><button><AppIcon name="external" :size="15" />打开结果</button></div></div>
        </section>
      </div>
      <section class="playground-code"><div class="code-tabs"><button v-for="lang in ['curl', 'javascript', 'python']" :key="lang" :class="{ active: codeLanguage === lang }" @click="codeLanguage = lang">{{ lang }}</button><button class="copy-code" @click="copyText(codeSamples[codeLanguage])"><AppIcon name="copy" :size="15" />复制代码</button></div><pre><code>{{ codeSamples[codeLanguage] }}</code></pre></section>
    </template>

    <template v-else-if="section === 'tasks'">
      <div class="metric-grid compact"><MetricCard label="今日任务" value="146" detail="较昨日 +12%" icon="tasks" tone="mint" /><MetricCard label="运行中" value="1" detail="平均队列 18 秒" icon="experience" tone="blue" /><MetricCard label="成功率" value="98.6%" detail="过去 24 小时" icon="check" tone="violet" /></div>
      <div class="task-filters"><button class="active">全部</button><button>运行中</button><button>成功</button><button>失败</button><label class="search-field small"><AppIcon name="search" :size="16" /><input placeholder="搜索 Task ID" /></label></div>
      <div class="data-table tasks-table"><div class="table-head"><span>Task ID</span><span>模型</span><span>创建时间</span><span>耗时</span><span>用量</span><span>状态</span><span /></div><div v-for="task in apiTasks" :key="task.id" class="table-row"><code>{{ task.id }}</code><strong>{{ task.model }}</strong><span>{{ task.created }}</span><span>{{ task.duration }}</span><span>{{ task.usage }}</span><StatusBadge :label="task.status" /><button class="row-action" :aria-label="`查看任务 ${task.id} 操作`">•••</button></div></div>
    </template>

    <template v-else-if="section === 'usage'">
      <section class="budget-band"><div><span>本月 API 预算</span><strong>28,160 <small>/ 41,000 点</small></strong><p>已使用 68.7%，按当前趋势预计月底使用 39,240 点。</p></div><div class="budget-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><circle class="progress" cx="40" cy="40" r="32" /></svg><strong>68.7%</strong></div></section>
      <div class="usage-layout"><section class="content-panel"><div class="section-heading"><div><h2>每日用量</h2><p>7 月 1 日—7 月 17 日</p></div><span class="chart-total">28,160 点</span></div><div class="line-chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><defs><linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28efbb" stop-opacity=".25"/><stop offset="1" stop-color="#28efbb" stop-opacity="0"/></linearGradient></defs><path class="grid-line" d="M0 40H700M0 100H700M0 160H700M0 210H700"/><path class="area" d="M0 180 C55 160, 70 145, 110 152 S170 96, 220 110 S280 68, 330 90 S390 135, 440 92 S500 54, 550 65 S630 38,700 50 V220H0Z"/><path class="line" d="M0 180 C55 160, 70 145, 110 152 S170 96, 220 110 S280 68, 330 90 S390 135, 440 92 S500 54, 550 65 S630 38,700 50"/></svg><div class="line-chart-labels"><span>7/1</span><span>7/5</span><span>7/9</span><span>7/13</span><span>今天</span></div></div></section><section class="content-panel model-distribution"><div class="section-heading"><div><h2>模型分布</h2><p>按消耗点数</p></div></div><div v-for="item in [{n:'VerdantFlare SD2',v:52,c:'mint'},{n:'GLM-5.2',v:23,c:'blue'},{n:'DeepSeek-V4 Pro',v:16,c:'violet'},{n:'其他',v:9,c:'coral'}]" :key="item.n" class="distribution-row"><div><span><i :class="item.c" />{{ item.n }}</span><strong>{{ item.v }}%</strong></div><div class="distribution-track"><i :class="item.c" :style="{ width: `${item.v}%` }" /></div></div></section></div>
    </template>

    <Transition name="modal">
      <div v-if="showKeyModal" class="modal-backdrop" @click.self="finishKeyModal">
        <section class="modal-card key-modal"><header><div><span class="page-overline">NEW CREDENTIAL</span><h2>{{ createdSecret ? '保存你的 API Key' : '创建 API Key' }}</h2><p>{{ createdSecret ? '离开此窗口后将无法再次查看完整 Key。' : '使用最小权限，并为不同环境创建独立 Key。' }}</p></div><button class="icon-button" aria-label="关闭弹窗" @click="finishKeyModal"><AppIcon name="close" /></button></header>
          <template v-if="!createdSecret"><label class="form-field"><span>Key 名称</span><input v-model="keyName" placeholder="例如：内容生产服务" autofocus /></label><label class="form-field"><span>权限范围</span><div class="checkbox-list"><label><input type="checkbox" checked disabled /><span><strong>models:read</strong><small>读取已授权模型</small></span></label><label><input type="checkbox" checked /><span><strong>tasks:write</strong><small>创建和读取任务</small></span></label><label><input type="checkbox" /><span><strong>usage:read</strong><small>读取组织用量</small></span></label></div></label><footer><button class="button secondary" @click="finishKeyModal">取消</button><button class="button primary" :disabled="!keyName.trim() || creatingKey" @click="createKey">{{ creatingKey ? '正在创建…' : '创建 Key' }}</button></footer></template>
          <template v-else><div class="secret-box"><code>{{ createdSecret }}</code><button @click="copyText(createdSecret, 'API Key 已复制')"><AppIcon name="copy" :size="16" />复制</button></div><div class="secret-warning"><AppIcon name="warning" :size="18" /><span>请立即保存到安全的密钥管理工具，不要发送到聊天或邮件。</span></div><footer><button class="button primary full" @click="finishKeyModal">我已安全保存</button></footer></template>
        </section>
      </div>
    </Transition>
  </div>
</template>
