<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import BrandAppIcon from "../components/BrandAppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import McpTokensModal from "../components/McpTokensModal.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { currentSearch, navigate } from "../router";
import { useModal } from "../composables/useModal";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const section = computed(() => props.path.startsWith("/ops/organizations") ? "organizations" : "apps");
const releases = ref([]);
const organizations = ref([]);
const loading = ref(false);
const error = ref("");
const search = ref("");
const releaseFilter = ref("全部");
const planFilter = ref("全部");
const showCreate = ref(false);
const showMcpTokens = ref(false);
watch(currentSearch, async (query) => {
  if (section.value === "apps" && new URLSearchParams(query).get("tokens") === "1") {
    await nextTick();
    showMcpTokens.value = true;
  }
}, { immediate: true });
const saving = ref(false);
const createError = ref("");
const { dialogRef, closeModal } = useModal(showCreate, saving);
const form = ref({ id: "", name: "", shortName: "", groupId: "image", category: "", summary: "", developer: "", plan: "Pilot" });
const appBasicsComplete = computed(() => /^[a-z0-9][a-z0-9-]{1,62}$/.test(form.value.id)
  && [...form.value.name].length >= 2 && Boolean(form.value.groupId && form.value.category && form.value.summary));

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    if (section.value === "apps") releases.value = await controlApi.listReleases();
    else organizations.value = await controlApi.listOperationsOrganizations();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "运营数据加载失败";
  } finally {
    loading.value = false;
  }
};
watch(section, load, { immediate: true });

const filteredReleases = computed(() => releases.value.filter((item) =>
  (releaseFilter.value === "全部" || item.status === releaseFilter.value)
  && `${item.app} ${item.appId} ${item.version}`.toLowerCase().includes(search.value.toLowerCase()),
));
const filteredOrganizations = computed(() => organizations.value.filter((item) =>
  (planFilter.value === "全部" || item.plan === planFilter.value)
  && `${item.name} ${item.id}`.toLowerCase().includes(search.value.toLowerCase()),
));

const openCreate = () => {
  createError.value = "";
  form.value = { id: "", name: "", shortName: "", groupId: "image", category: "", summary: "", developer: "", plan: "Pilot" };
  showCreate.value = true;
};
const create = async () => {
  if (saving.value) return;
  saving.value = true;
  createError.value = "";
  try {
    if (section.value === "apps") {
      const record = await controlApi.createManagedApp({
        id: form.value.id,
        name: form.value.name,
        groupId: form.value.groupId,
        sortOrder: 1000,
        category: form.value.category,
        summary: form.value.summary,
        developer: form.value.developer,
        icon: "market",
        tone: "mint",
      });
      showCreate.value = false;
      emit("toast", "应用基本信息已保存；下一步上传 Helm Chart 预检");
      navigate(`/ops/apps/${record.app.id}/releases`);
    } else {
      const record = await controlApi.createManagedOrganization({ name: form.value.name, shortName: form.value.shortName, plan: form.value.plan });
      showCreate.value = false;
      emit("toast", "客户组织已创建");
      navigate(`/ops/organizations/${record.organization.organizationId}`);
    }
  } catch (cause) {
    createError.value = cause instanceof Error ? cause.message : "创建失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page ops-page">
    <header class="page-header"><div><span class="page-overline internal-overline">{{ section === 'apps' ? 'INTERNAL · APP OPERATIONS' : 'INTERNAL · CUSTOMER SUCCESS' }}</span><h1>{{ section === 'apps' ? '应用目录' : '客户组织' }}</h1><p>{{ section === 'apps' ? '管理 Control 中的应用资料、Chart OCI 版本与 apps.yaml 分发目录。' : '管理组织套餐、业务权益和冻结状态。' }}</p></div><div class="detail-command-actions"><button v-if="section === 'apps'" class="button secondary" @click="showMcpTokens = true"><AppIcon name="key" :size="16" />MCP 访问令牌</button><a v-if="section === 'apps'" class="button secondary" :href="controlApi.opsAppsYamlUrl()" target="_blank" rel="noopener noreferrer">查看 apps.yaml 目录</a><button class="button primary" @click="openCreate"><AppIcon name="plus" :size="17" />{{ section === 'apps' ? '新建应用资料' : '新建客户组织' }}</button></div></header>
    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>

    <template v-if="section === 'apps'">
      <section class="metric-grid compact"><MetricCard label="应用总数" :value="String(releases.length)" detail="当前发布列表" icon="release" tone="mint" /><MetricCard label="可安装分发" :value="String(releases.filter((item) => item.enabled && item.publishedVersion && !item.disabledReason).length)" detail="已启用固定 Chart OCI 版本" icon="market" tone="blue" /><MetricCard label="仅目录 / 草稿" :value="String(releases.filter((item) => !item.publishedVersion).length)" detail="等待 Chart OCI 登记或上架" icon="warning" tone="coral" /></section>
      <div class="task-filters release-filters"><button v-for="filter in ['全部', '已发布', '灰度中', '目录已上架', '候选', '已暂停', '已停用']" :key="filter" :class="{ active: releaseFilter === filter }" @click="releaseFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input v-model="search" placeholder="搜索应用或版本" /></label></div>
      <p v-if="loading">正在加载发布记录…</p>
      <div v-else class="data-table release-table"><div class="table-head"><span>应用</span><span>版本 / 通道</span><span>Chart OCI 状态</span><span>客户范围</span><span>更新时间</span><span>目录状态</span><span>操作</span></div><div v-for="release in filteredReleases" :key="release.appId" class="table-row"><span class="table-app-cell"><span class="table-app-icon" aria-hidden="true"><BrandAppIcon :icon-url="release.publicIconUrl" :icon-ref="release.iconRef" :brand="release.brand" fallback-icon="market" :size="20" /></span><span><strong>{{ release.app }}</strong><small>{{ release.appId }} · {{ release.groupId || '未分组' }}</small></span></span><span><b>{{ release.publishedVersion || release.version || '待登记' }}</b><small>{{ release.channel }}</small></span><span class="table-state">{{ release.publishedVersion ? `OCI ${release.publishedVersion}` : (release.disabledReason || '仅目录展示') }}</span><span>{{ release.audience }}</span><span>{{ release.updated || '—' }}</span><StatusBadge :label="release.status === '已停用' ? '已停用' : release.channel === 'Preview' ? '目录预览' : release.status" /><button class="table-action" :aria-label="`管理 ${release.app} 发布`" @click="navigate(`/ops/apps/${release.appId}/releases`)">配置<AppIcon name="arrow" :size="15" /></button></div></div>
      <p v-if="!loading && !filteredReleases.length">没有符合条件的应用。</p>
    </template>

    <template v-else>
      <section class="metric-grid compact"><MetricCard label="客户组织" :value="String(organizations.length)" detail="来自 Control Service" icon="clients" tone="mint" /><MetricCard label="成员" :value="String(organizations.reduce((sum, item) => sum + item.members, 0))" detail="所有组织" icon="members" tone="blue" /><MetricCard label="已冻结" :value="String(organizations.filter((item) => item.status === '冻结').length)" detail="权益暂停" icon="warning" tone="coral" /></section>
      <div class="customer-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="search" placeholder="搜索组织名称或 ID" /></label><div class="task-filters"><button v-for="plan in ['全部', 'Enterprise', 'Studio', 'Pilot']" :key="plan" :class="{ active: planFilter === plan }" @click="planFilter = plan">{{ plan }}</button></div></div>
      <p v-if="loading">正在加载客户组织…</p>
      <div v-else class="data-table organization-table"><div class="table-head"><span>客户组织</span><span>套餐</span><span>成员</span><span>应用权益</span><span>API 用量</span><span>有效期</span><span>状态</span><span>操作</span></div><div v-for="org in filteredOrganizations" :key="org.id" class="table-row"><span><strong>{{ org.name }}</strong><small>{{ org.id }}</small></span><span>{{ org.plan || '未配置' }}</span><span>{{ org.members }}</span><span>{{ org.apps }}</span><span>{{ org.apiUsage }}</span><span>{{ org.expires }}</span><StatusBadge :label="org.status" /><button class="table-action" :aria-label="`管理客户组织 ${org.name}`" @click="navigate(`/ops/organizations/${org.id}`)">配置<AppIcon name="arrow" :size="15" /></button></div></div>
      <p v-if="!loading && !filteredOrganizations.length">没有符合条件的组织。</p>
    </template>

    <McpTokensModal v-if="section === 'apps'" v-model="showMcpTokens" @toast="(message) => emit('toast', message)" />

    <Transition name="modal">
      <dialog v-if="showCreate" ref="dialogRef" class="modal-backdrop" aria-labelledby="create-record-title" :aria-busy="saving" @cancel.prevent="closeModal" @click.self="closeModal">
        <section class="modal-card invite-modal">
          <header><div><span class="page-overline">{{ section === 'apps' ? 'NEW APP RECORD' : 'NEW ORGANIZATION' }}</span><h2 id="create-record-title">{{ section === 'apps' ? '新建应用资料' : '新建客户组织' }}</h2></div><button class="icon-button" aria-label="关闭弹窗" :disabled="saving" @click="closeModal"><AppIcon name="close" /></button></header>
          <fieldset class="modal-fields" :disabled="saving">
          <template v-if="section === 'apps'">
            <p class="candidate-help">第一步填写应用基本信息。星号为创建必填；创建后补齐客户展示资料，再上传 Chart 预检。静态报告不会发布或安装应用。</p>
            <label class="form-field"><span>应用 ID *（2–63 位小写字母、数字或连字符）</span><input v-model.trim="form.id" autofocus placeholder="例如 comfyui" /></label>
            <label class="form-field"><span>应用名称 *（至少 2 个字符）</span><input v-model.trim="form.name" /></label>
            <label class="form-field"><span>应用主分组 *</span><select v-model="form.groupId"><option value="image">Image</option><option value="music">Music</option><option value="video">Video</option><option value="desktop">Desktop</option><option value="system">System</option><option value="channel">Channel</option><option value="agent">Agent（仅目录）</option></select></label>
            <label class="form-field"><span>市场分类 *</span><input v-model.trim="form.category" placeholder="例如 图像创作" /></label>
            <label class="form-field"><span>开发者／维护方</span><input v-model.trim="form.developer" placeholder="应用展示资料；版本发布者另行登记" /></label>
            <label class="form-field"><span>简介 *</span><input v-model.trim="form.summary" placeholder="一句话说明用途，不填写安装承诺" /></label>
          </template>
          <template v-else>
            <label class="form-field"><span>组织名称</span><input v-model.trim="form.name" autofocus /></label>
            <label class="form-field"><span>简称（可选）</span><input v-model.trim="form.shortName" /></label>
            <label class="form-field"><span>套餐</span><select v-model="form.plan"><option>Pilot</option><option>Studio</option><option>Enterprise</option></select></label>
          </template>
          </fieldset>
          <p v-if="createError" class="form-error" role="alert">{{ createError }}</p>
          <footer><button class="button secondary" :disabled="saving" @click="closeModal">取消</button><button class="button primary" :disabled="saving || (section === 'apps' ? !appBasicsComplete : !form.name)" @click="create">{{ saving ? '正在保存…' : '创建' }}</button></footer>
        </section>
      </dialog>
    </Transition>
  </div>
</template>

<style scoped>
.table-app-cell {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.table-app-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(244, 241, 232, 0.04);
  color: var(--paper);
}
</style>
