<script setup>
import { computed, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { organizations, releases } from "../data/mock";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const section = computed(() => (props.path.startsWith("/ops/organizations") ? "organizations" : "apps"));
const releaseFilter = ref("全部");
const orgSearch = ref("");
const filteredReleases = computed(() => releases.filter((item) => releaseFilter.value === "全部" || item.status === releaseFilter.value));
const filteredOrganizations = computed(() => organizations.filter((org) => org.name.toLowerCase().includes(orgSearch.value.toLowerCase())));
</script>

<template>
  <div class="page ops-page">
    <header v-if="section === 'apps'" class="page-header"><div><span class="page-overline internal-overline">INTERNAL · APP OPERATIONS</span><h1>应用发布</h1><p>管理候选版本、Manifest、验证通道与客户发布范围。</p></div><button class="button primary" @click="$emit('toast', '候选应用已创建')"><AppIcon name="plus" :size="17" />收录候选应用</button></header>
    <header v-else class="page-header"><div><span class="page-overline internal-overline">INTERNAL · CUSTOMER SUCCESS</span><h1>客户组织</h1><p>管理组织套餐、业务权益、冻结状态和有效期。</p></div><button class="button primary" @click="$emit('toast', '新建客户组织流程已打开')"><AppIcon name="plus" :size="17" />新建客户组织</button></header>

    <template v-if="section === 'apps'">
      <section class="metric-grid compact"><MetricCard label="候选版本" value="29" detail="3 个今日更新" icon="release" tone="mint" /><MetricCard label="Preview" value="17" detail="覆盖 8 个组织" icon="market" tone="blue" /><MetricCard label="待许可复核" value="10" detail="2 个高优先级" icon="warning" tone="coral" /></section>
      <div class="task-filters release-filters"><button v-for="filter in ['全部', '已发布', '灰度中', '许可复核', '适配中']" :key="filter" :class="{ active: releaseFilter === filter }" @click="releaseFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input placeholder="搜索应用或版本" /></label></div>
      <div class="data-table release-table"><div class="table-head"><span>应用</span><span>版本 / 通道</span><span>标准验证</span><span>客户范围</span><span>更新时间</span><span>状态</span><span /></div><div v-for="release in filteredReleases" :key="release.app" class="table-row"><strong>{{ release.app }}</strong><span><b>{{ release.version }}</b><small>{{ release.channel }}</small></span><span>{{ release.validation }} Station</span><span>{{ release.audience }}</span><span>{{ release.updated }}</span><StatusBadge :label="release.status" /><button class="row-action" :aria-label="`管理 ${release.app} 发布`">•••</button></div></div>
      <section class="ops-flow"><div><span class="flow-number done">1</span><strong>Candidate</strong></div><i /><div><span class="flow-number active">2</span><strong>Manifest & 验证</strong></div><i /><div><span class="flow-number">3</span><strong>Preview</strong></div><i /><div><span class="flow-number">4</span><strong>Stable</strong></div><i /><div><span class="flow-number">5</span><strong>暂停 / 回滚</strong></div></section>
    </template>

    <template v-else>
      <section class="metric-grid compact"><MetricCard label="客户组织" value="42" detail="4 个试用组织" icon="clients" tone="mint" /><MetricCard label="付费席位" value="286" detail="本月新增 18" icon="members" tone="blue" /><MetricCard label="权益待到期" value="3" detail="未来 30 天" icon="warning" tone="coral" /></section>
      <div class="customer-tools"><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="orgSearch" placeholder="搜索组织名称或 ID" /></label><div class="task-filters"><button class="active">全部</button><button>Enterprise</button><button>Studio</button><button>Pilot</button></div></div>
      <div class="data-table organization-table"><div class="table-head"><span>客户组织</span><span>套餐</span><span>成员</span><span>应用权益</span><span>本月用量</span><span>有效期</span><span>状态</span><span /></div><div v-for="org in filteredOrganizations" :key="org.id" class="table-row"><span><strong>{{ org.name }}</strong><small>{{ org.id }}</small></span><span>{{ org.plan }}</span><span>{{ org.members }}</span><span>{{ org.apps }}</span><span>{{ org.apiUsage }}</span><span>{{ org.expires }}</span><StatusBadge :label="org.status" /><button class="row-action" :aria-label="`管理客户组织 ${org.name}`">•••</button></div></div>
      <section class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>前端可见不等于服务端授权</strong><p>所有组织、权益、冻结与发布操作都必须由 Control Service 对内部角色和权益版本再次校验。</p></div></section>
    </template>
  </div>
</template>
