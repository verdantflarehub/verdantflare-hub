<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

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
const saving = ref(false);
const form = ref({ id: "", name: "", shortName: "", version: "0.1.0", category: "", summary: "", plan: "Pilot" });

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
  form.value = { id: "", name: "", shortName: "", version: "0.1.0", category: "", summary: "", plan: "Pilot" };
  showCreate.value = true;
};
const create = async () => {
  saving.value = true;
  error.value = "";
  try {
    if (section.value === "apps") {
      const record = await controlApi.createManagedApp({
        id: form.value.id,
        name: form.value.name,
        version: form.value.version,
        category: form.value.category,
        summary: form.value.summary,
        icon: "market",
        tone: "mint",
      });
      showCreate.value = false;
      emit("toast", "应用目录草稿已保存；请补充独立的候选版本资料");
      navigate(`/ops/apps/${record.app.id}/releases`);
    } else {
      const record = await controlApi.createManagedOrganization({ name: form.value.name, shortName: form.value.shortName, plan: form.value.plan });
      showCreate.value = false;
      emit("toast", "客户组织已创建");
      navigate(`/ops/organizations/${record.organization.organizationId}`);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "创建失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page ops-page">
    <header class="page-header"><div><span class="page-overline internal-overline">{{ section === 'apps' ? 'INTERNAL · APP OPERATIONS' : 'INTERNAL · CUSTOMER SUCCESS' }}</span><h1>{{ section === 'apps' ? '应用目录' : '客户组织' }}</h1><p>{{ section === 'apps' ? '管理 Control 中的应用资料与展示通道；候选版本需另行登记，不代表 Station 已部署。' : '管理组织套餐、业务权益和冻结状态。' }}</p></div><button class="button primary" @click="openCreate"><AppIcon name="plus" :size="17" />{{ section === 'apps' ? '新建应用资料' : '新建客户组织' }}</button></header>
    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>

    <template v-if="section === 'apps'">
      <section class="metric-grid compact"><MetricCard label="应用总数" :value="String(releases.length)" detail="来自 Control Service" icon="release" tone="mint" /><MetricCard label="Preview" :value="String(releases.filter((item) => item.channel === 'Preview').length)" detail="可授权客户" icon="market" tone="blue" /><MetricCard label="目录草稿" :value="String(releases.filter((item) => item.channel === 'Candidate').length)" detail="不等同于候选版本" icon="warning" tone="coral" /></section>
      <div class="task-filters release-filters"><button v-for="filter in ['全部', '已发布', '灰度中', '候选', '已暂停']" :key="filter" :class="{ active: releaseFilter === filter }" @click="releaseFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input v-model="search" placeholder="搜索应用或版本" /></label></div>
      <p v-if="loading">正在加载发布记录…</p>
      <div v-else class="data-table release-table"><div class="table-head"><span>应用</span><span>版本 / 通道</span><span>Station 验证</span><span>客户范围</span><span>更新时间</span><span>目录状态</span><span /></div><div v-for="release in filteredReleases" :key="release.appId" class="table-row"><strong>{{ release.app }}</strong><span><b>{{ release.version }}</b><small>{{ release.channel }}</small></span><span>未接入</span><span>{{ release.audience }}</span><span>{{ release.updated || '—' }}</span><StatusBadge :label="release.channel === 'Preview' ? '目录预览' : release.status" /><button class="row-action" :aria-label="`管理 ${release.app} 发布`" @click="navigate(`/ops/apps/${release.appId}/releases`)"><AppIcon name="arrow" :size="15" /></button></div></div>
      <p v-if="!loading && !filteredReleases.length">没有符合条件的应用。</p>
    </template>

    <template v-else>
      <section class="metric-grid compact"><MetricCard label="客户组织" :value="String(organizations.length)" detail="来自 Control Service" icon="clients" tone="mint" /><MetricCard label="成员" :value="String(organizations.reduce((sum, item) => sum + item.members, 0))" detail="所有组织" icon="members" tone="blue" /><MetricCard label="已冻结" :value="String(organizations.filter((item) => item.status === '冻结').length)" detail="权益暂停" icon="warning" tone="coral" /></section>
      <div class="customer-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="search" placeholder="搜索组织名称或 ID" /></label><div class="task-filters"><button v-for="plan in ['全部', 'Enterprise', 'Studio', 'Pilot']" :key="plan" :class="{ active: planFilter === plan }" @click="planFilter = plan">{{ plan }}</button></div></div>
      <p v-if="loading">正在加载客户组织…</p>
      <div v-else class="data-table organization-table"><div class="table-head"><span>客户组织</span><span>套餐</span><span>成员</span><span>应用权益</span><span>API 用量</span><span>有效期</span><span>状态</span><span /></div><div v-for="org in filteredOrganizations" :key="org.id" class="table-row"><span><strong>{{ org.name }}</strong><small>{{ org.id }}</small></span><span>{{ org.plan || '未配置' }}</span><span>{{ org.members }}</span><span>{{ org.apps }}</span><span>{{ org.apiUsage }}</span><span>{{ org.expires }}</span><StatusBadge :label="org.status" /><button class="row-action" :aria-label="`管理客户组织 ${org.name}`" @click="navigate(`/ops/organizations/${org.id}`)"><AppIcon name="arrow" :size="15" /></button></div></div>
      <p v-if="!loading && !filteredOrganizations.length">没有符合条件的组织。</p>
    </template>

    <Transition name="modal"><div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false"><section class="modal-card invite-modal"><header><div><span class="page-overline">{{ section === 'apps' ? 'NEW APP RECORD' : 'NEW ORGANIZATION' }}</span><h2>{{ section === 'apps' ? '新建应用资料' : '新建客户组织' }}</h2></div><button class="icon-button" aria-label="关闭弹窗" @click="showCreate = false"><AppIcon name="close" /></button></header><template v-if="section === 'apps'"><p class="candidate-help">这一步只建立目录记录；创建后到详情页登记独立、不可覆盖的候选版本。</p><label class="form-field"><span>应用 ID</span><input v-model.trim="form.id" placeholder="例如 video-studio" /></label><label class="form-field"><span>应用名称</span><input v-model.trim="form.name" /></label><label class="form-field"><span>目录展示版本</span><input v-model.trim="form.version" /></label><label class="form-field"><span>分类</span><input v-model.trim="form.category" /></label><label class="form-field"><span>简介</span><input v-model.trim="form.summary" /></label></template><template v-else><label class="form-field"><span>组织名称</span><input v-model.trim="form.name" /></label><label class="form-field"><span>简称（可选）</span><input v-model.trim="form.shortName" /></label><label class="form-field"><span>套餐</span><select v-model="form.plan"><option>Pilot</option><option>Studio</option><option>Enterprise</option></select></label></template><footer><button class="button secondary" @click="showCreate = false">取消</button><button class="button primary" :disabled="saving || !form.name || (section === 'apps' && (!form.id || !form.version))" @click="create">{{ saving ? '正在保存…' : '创建' }}</button></footer></section></div></Transition>
  </div>
</template>
