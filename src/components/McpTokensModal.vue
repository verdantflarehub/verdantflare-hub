<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import { listMcpToolNames } from "../api/mcpTools";
import { useModal } from "../composables/useModal";
import AppIcon from "./AppIcon.vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps({ modelValue: Boolean, purpose: { type: String, default: "app_publish" } });
const emit = defineEmits(["update:modelValue", "toast"]);
const open = computed({ get: () => props.modelValue, set: (value) => emit("update:modelValue", value) });
const saving = ref(false);
const { dialogRef, closeModal } = useModal(open, saving);
const tokens = ref([]);
const loading = ref(false);
const error = ref("");
const draft = ref({ name: "", expiresInDays: 90 });
const created = ref(null);
const toolCheck = ref({ loading: false, names: [], error: "" });
let requestVersion = 0;
const endpoint = `${window.location.origin}/mcp`;
const isModel = computed(() => props.purpose === "model_publish");
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN");
};
const load = async () => {
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  try {
    const items = await controlApi.listMcpTokens(props.purpose);
    if (version === requestVersion && open.value) tokens.value = items;
  } catch (cause) {
    if (version === requestVersion && open.value) error.value = cause instanceof Error ? cause.message : "访问令牌加载失败";
  } finally {
    if (version === requestVersion) loading.value = false;
  }
};
watch(open, (visible) => {
  if (visible) load();
  else {
    requestVersion += 1;
    loading.value = false;
    created.value = null;
    toolCheck.value = { loading: false, names: [], error: "" };
    tokens.value = [];
    draft.value = { name: "", expiresInDays: 90 };
    error.value = "";
  }
});
const create = async () => {
  if (saving.value || draft.value.name.trim().length < 2) return;
  saving.value = true;
  error.value = "";
  try {
    created.value = await controlApi.createMcpToken({ name: draft.value.name.trim(), expiresInDays: Number(draft.value.expiresInDays), purpose: props.purpose });
    toolCheck.value = { loading: false, names: [], error: "" };
    draft.value = { name: "", expiresInDays: 90 };
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "签发访问令牌失败";
  } finally {
    saving.value = false;
  }
};
const revoke = async (token) => {
  if (saving.value || !window.confirm(`吊销「${token.name}」后，使用它的 AI 工具将立即无法调用。确认吊销？`)) return;
  saving.value = true;
  error.value = "";
  try {
    await controlApi.revokeMcpToken(token.id);
    if (created.value?.id === token.id) {
      created.value = null;
      toolCheck.value = { loading: false, names: [], error: "" };
    }
    await load();
    emit("toast", "访问令牌已吊销");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "吊销访问令牌失败";
  } finally {
    saving.value = false;
  }
};
const copy = async () => {
  try {
    await navigator.clipboard.writeText(created.value.secret);
    emit("toast", "令牌已复制");
  } catch {
    emit("toast", "复制失败，请手动选择文本");
  }
};
const closeCreated = () => {
  created.value = null;
  toolCheck.value = { loading: false, names: [], error: "" };
};
const verifyTools = async () => {
  if (!isModel.value || !created.value?.secret || toolCheck.value.loading) return;
  const secret = created.value.secret;
  toolCheck.value = { loading: true, names: [], error: "" };
  try {
    const names = await listMcpToolNames(endpoint, secret);
    if (created.value?.secret === secret && open.value) {
      toolCheck.value = names.length
        ? { loading: false, names, error: "" }
        : { loading: false, names: [], error: "当前令牌未发现模型上架工具" };
    }
  } catch (cause) {
    if (created.value?.secret === secret && open.value) {
      toolCheck.value = { loading: false, names: [], error: cause instanceof Error ? cause.message : "MCP 工具发现失败" };
    }
  }
};
</script>

<template>
  <Transition name="modal">
    <dialog v-if="open" ref="dialogRef" class="modal-backdrop" aria-labelledby="mcp-token-title" :aria-busy="saving" @cancel.prevent="closeModal" @click.self="closeModal">
      <section class="modal-card mcp-token-modal">
        <header><div><span class="page-overline">HUB MARKET MCP</span><h2 id="mcp-token-title">{{ isModel ? '模型上架' : '应用发布' }} · MCP 访问令牌</h2><p>为 AI 工具签发、查看和吊销{{ isModel ? '模型管理' : '应用发布' }}令牌。</p></div><button class="icon-button" aria-label="关闭令牌管理" :disabled="saving" @click="closeModal"><AppIcon name="close" /></button></header>
        <p v-if="isModel" class="ops-note">已开放受限的渠道、计费、真实探针与分阶段上架工具。写入仍需当前模型运营权限、配置修订和幂等请求 ID；供应商密钥仅通过一次性 HTTPS 上传，不要放进 AI 对话。</p>
        <section class="security-callout"><AppIcon name="key" :size="22" /><div><strong>在 AI 工具中配置</strong><p><code>HUB_MCP_URL={{ endpoint }}</code> 与 <code>HUB_MCP_BEARER_TOKEN</code>。令牌代表你本人；角色被撤销或令牌被吊销后立即失效。明文只在签发时显示一次。</p></div></section>
        <section v-if="created" class="content-panel key-secret-panel"><div class="section-heading"><div><h2>请立即保存新令牌</h2><p>关闭后不会再次显示。请勿提交到代码库或发送给他人。</p></div><button class="icon-button" aria-label="关闭令牌展示" @click="closeCreated"><AppIcon name="close" :size="16" /></button></div><div class="key-secret-row"><code>{{ created.secret }}</code><button class="button secondary" @click="copy"><AppIcon name="copy" :size="15" />复制令牌</button></div><p>{{ created.expiresAt ? `有效至 ${formatDate(created.expiresAt)}` : '不过期，可随时吊销' }}</p><div v-if="isModel" class="mcp-tool-check"><button class="button secondary" :disabled="toolCheck.loading" @click="verifyTools">{{ toolCheck.loading ? '正在验证…' : '验证工具清单' }}</button><p v-if="toolCheck.error" role="alert">{{ toolCheck.error }}</p><div v-if="toolCheck.names.length" role="status"><strong>已发现 {{ toolCheck.names.length }} 个模型工具</strong><ul><li v-for="name in toolCheck.names" :key="name">{{ name }}</li></ul></div></div></section>
        <section class="content-panel"><div class="section-heading"><div><h2>签发新令牌</h2><p>按用途命名，便于日后识别与吊销。</p></div></div><div class="two-column-form"><label class="form-field"><span>用途名称</span><input v-model.trim="draft.name" maxlength="50" :placeholder="isModel ? '例如：AI 模型管理' : '例如：AI 应用发布'" /></label><label class="form-field"><span>有效期</span><select v-model="draft.expiresInDays"><option :value="30">30 天</option><option :value="90">90 天</option><option :value="180">180 天</option><option :value="365">365 天</option><option :value="0">不过期</option></select></label></div><footer><button class="button primary" :disabled="saving || draft.name.trim().length < 2" @click="create">{{ saving ? '正在签发…' : '签发令牌' }}</button></footer></section>
        <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>访问令牌操作失败</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
        <p v-if="loading">正在加载访问令牌…</p>
        <div class="data-table keys-table"><div class="table-head"><span>名称</span><span>令牌</span><span>有效期</span><span>创建时间</span><span>最近使用</span><span>状态</span><span>操作</span></div><div v-for="token in tokens" :key="token.id" class="table-row"><strong>{{ token.name }}</strong><code>{{ token.prefix }}</code><span>{{ token.expiresAt ? formatDate(token.expiresAt) : '不过期' }}</span><span>{{ formatDate(token.createdAt) }}</span><span>{{ token.lastUsedAt ? formatDate(token.lastUsedAt) : '—' }}</span><StatusBadge :label="token.status" /><button v-if="token.status === '有效'" class="table-action danger" :aria-label="`吊销 ${token.name}`" :disabled="saving" @click="revoke(token)">吊销<AppIcon name="arrow" :size="15" /></button><span v-else class="table-action-unavailable">—</span></div></div>
        <p v-if="!loading && !error && !tokens.length" class="billing-empty">尚未签发访问令牌。</p>
      </section>
    </dialog>
  </Transition>
</template>
