<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "./AppIcon.vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps({ organizationId: String, modelId: { type: String, required: true } });
const models = ref([]);
const modelsError = ref("");
const usage = ref(null);
const usageError = ref("");
const runs = ref([]);
const runsError = ref("");
const selectedRunId = ref("");
const prompt = ref("");
const chargeConfirmed = ref(false);
const submitting = ref(false);
const submitError = ref("");
const pendingRequest = ref(null);
let pollTimer;

const modelAvailable = computed(() => models.value.some((model) => model.id === props.modelId && model.experienceMode === "chat"));
const selectedRun = computed(() => runs.value.find((run) => run.id === selectedRunId.value) || null);
const canSubmit = computed(() => modelAvailable.value && !modelsError.value && !usageError.value
  && usage.value?.enabled && usage.value.remaining > 0 && prompt.value.trim().length > 0 && prompt.value.trim().length <= 2000
  && chargeConfirmed.value && !submitting.value && selectedRun.value?.status !== "submitting");
const statusLabel = (status) => ({ submitting: "运行中", completed: "成功", failed: "失败", outcome_unknown: "结果待核" })[status] || status;
const errorLabel = (code) => ({ insufficient_quota: "组织额度不足", organization_disabled: "组织网关账号已停用", upstream_rejected: "模型服务拒绝了请求", upstream_result_unknown: "上游可能已收到请求；请先核对用量，不要立即重试", submission_interrupted: "提交过程被中断，结果可能已计费" })[code] || "本次体验未完成";
const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "—" : date.toLocaleString("zh-CN");
};

const loadAvailability = async () => {
  modelsError.value = "";
  usageError.value = "";
  try { models.value = (await controlApi.listModels()) || []; }
  catch (cause) { modelsError.value = cause instanceof Error ? cause.message : "模型目录加载失败"; }
  try { usage.value = await controlApi.getApiUsage(); }
  catch (cause) { usageError.value = cause instanceof Error ? cause.message : "组织额度读取失败"; }
};
const schedulePoll = (id) => {
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(() => pollRun(id), 2500);
};
const pollRun = async (id) => {
  try {
    const updated = await controlApi.getModelExperienceRun(id);
    const index = runs.value.findIndex((run) => run.id === id);
    if (index >= 0) runs.value.splice(index, 1, updated);
    else runs.value.unshift(updated);
    if (updated.status === "submitting") schedulePoll(id);
    else await loadAvailability();
  } catch (cause) {
    runsError.value = cause instanceof Error ? cause.message : "体验状态查询失败";
  }
};
const loadRuns = async () => {
  runsError.value = "";
  try {
    runs.value = (await controlApi.listModelExperienceRuns()) || [];
    if (!runs.value.some((run) => run.id === selectedRunId.value && run.modelId === props.modelId)) selectedRunId.value = runs.value.find((run) => run.modelId === props.modelId)?.id || "";
    if (selectedRun.value?.status === "submitting") schedulePoll(selectedRun.value.id);
  } catch (cause) {
    runsError.value = cause instanceof Error ? cause.message : "体验记录加载失败";
  }
};
const refresh = () => Promise.all([loadAvailability(), loadRuns()]);
const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  submitError.value = "";
  const request = pendingRequest.value || { requestId: crypto.randomUUID(), modelId: props.modelId, prompt: prompt.value.trim() };
  pendingRequest.value = request;
  try {
    const run = await controlApi.createModelExperienceRun(request);
    pendingRequest.value = null;
    if (!runs.value.some((item) => item.id === run.id)) runs.value.unshift(run);
    selectedRunId.value = run.id;
    prompt.value = "";
    chargeConfirmed.value = false;
    if (run.status === "submitting") schedulePoll(run.id);
    else await loadAvailability();
  } catch (cause) {
    submitError.value = `${cause instanceof Error ? cause.message : "提交失败"}。请先刷新记录核对；再次提交只会使用同一请求 ID，不会创建第二个任务。`;
    await loadRuns();
    const recovered = runs.value.find((run) => run.requestId === request.requestId);
    if (recovered) {
      pendingRequest.value = null;
      selectedRunId.value = recovered.id;
      submitError.value = "请求已到达服务器，已从体验记录恢复；请查看右侧状态。";
    }
  } finally { submitting.value = false; }
};
watch(() => [props.organizationId, props.modelId], () => {
  window.clearTimeout(pollTimer);
  selectedRunId.value = "";
  runs.value = [];
  usage.value = null;
  chargeConfirmed.value = false;
  pendingRequest.value = null;
  refresh();
});
onMounted(refresh);
onUnmounted(() => window.clearTimeout(pollTimer));
</script>

<template>
  <section class="content-panel model-experience-panel">
    <div class="section-heading"><div><h2>模型在线体验</h2><p>{{ models.find((model) => model.id === modelId)?.name || modelId }} · 每次提交都会使用当前组织的真实 API 额度。</p></div><StatusBadge :label="modelAvailable && usage?.enabled && usage.remaining > 0 && !modelsError && !usageError ? '可调用' : '待核验'" /></div>
    <div class="model-experience-balance"><span>组织 API 余额</span><strong>{{ usage && !usageError ? `$${usage.remaining.toFixed(2)}` : '暂不可用' }}</strong><button class="text-button" @click="refresh">刷新状态</button></div>
    <div v-if="modelsError || usageError" class="ops-note"><AppIcon name="warning" :size="18" /><div><strong>暂时无法发起体验</strong><p>{{ modelsError || usageError }}</p></div></div>
    <div class="model-experience-layout">
      <div class="model-experience-form">
        <label class="form-field"><span>输入问题或创作指令</span><textarea v-model="prompt" rows="8" maxlength="2000" :disabled="!modelAvailable || !!pendingRequest" placeholder="例如：为一部环保主题短片写一段 80 字的开场旁白。" /></label>
        <div class="model-experience-limit"><span>最多 2,000 字；输出最多 256 tokens</span><span>{{ prompt.trim().length }} / 2,000</span></div>
        <label class="model-experience-consent"><input v-model="chargeConfirmed" type="checkbox" :disabled="!modelAvailable || !usage?.enabled || usage.remaining <= 0" /><span>我了解这是实际模型调用，会按组织网关规则扣除 API 额度。</span></label>
        <button class="button primary" :disabled="!canSubmit" @click="submit"><AppIcon name="spark" :size="17" />{{ submitting ? '正在创建任务…' : pendingRequest ? '核对/继续原请求' : '开始真实体验' }}</button>
        <p v-if="pendingRequest" class="ops-note">原请求状态尚未确认。继续时会沿用同一请求 ID；如果原请求未到达服务器，这一步可能首次产生费用。</p>
        <p v-if="usage && usage.remaining <= 0" class="form-error">组织额度不足，请联系客户成功管理员分配 API 额度。</p>
        <p v-else-if="usage && !usage.enabled" class="form-error">组织网关账号已停用，请联系管理员。</p>
        <p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p>
      </div>
      <div class="model-experience-result" aria-live="polite">
        <template v-if="selectedRun">
          <div class="model-experience-result-head"><span>任务 {{ selectedRun.id }}</span><StatusBadge :label="statusLabel(selectedRun.status)" /></div>
          <p class="model-experience-prompt">{{ selectedRun.prompt }}</p>
          <div v-if="selectedRun.status === 'completed'" class="model-experience-answer">{{ selectedRun.response }}</div>
          <div v-else-if="selectedRun.status === 'submitting'" class="model-experience-pending"><div class="loading-ring" /><span>模型正在生成；离开页面后可从体验记录恢复。</span></div>
          <div v-else class="model-experience-failure"><AppIcon name="warning" :size="20" /><span>{{ errorLabel(selectedRun.errorCode) }}</span></div>
          <div class="model-experience-meta"><span>提交 {{ formatTime(selectedRun.createdAt) }}</span><span v-if="selectedRun.status === 'completed'">实际用量 {{ selectedRun.totalTokens }} tokens（输入 {{ selectedRun.promptTokens }} / 输出 {{ selectedRun.outputTokens }}）</span><span>结果保留至 {{ formatTime(selectedRun.expiresAt) }}</span></div>
        </template>
        <div v-else class="model-experience-empty"><AppIcon name="chat" :size="28" /><strong>等待你的第一次真实体验</strong><span>提交后，这里会显示模型原始回复和实际 token 用量。</span></div>
      </div>
    </div>
    <div class="model-experience-history"><div class="section-heading"><div><h3>最近 24 小时</h3><p>只显示你在当前组织发起的任务；超时结果不自动重试。</p></div><button class="text-button" @click="loadRuns">刷新记录</button></div><p v-if="runsError" class="form-error">{{ runsError }}</p><div v-if="runs.some((run) => run.modelId === modelId)" class="model-experience-run-list"><button v-for="run in runs.filter((item) => item.modelId === modelId)" :key="run.id" :class="{ active: selectedRunId === run.id }" @click="selectedRunId = run.id; run.status === 'submitting' && schedulePoll(run.id)"><span><strong>{{ run.modelId }}</strong><small>{{ formatTime(run.createdAt) }}</small></span><StatusBadge :label="statusLabel(run.status)" /><AppIcon name="chevron" :size="16" /></button></div><p v-else-if="!runsError" class="model-experience-history-empty">暂无模型体验记录。</p></div>
  </section>
</template>
