<script setup>
import { computed, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { apps, members, organizations } from "../data/mock";
import { navigate } from "../router";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const organizationId = computed(() => props.path.split("/").filter(Boolean).at(-1));
const organization = computed(() => organizations.find((item) => item.id === organizationId.value));
const entitlements = ref(apps.slice(0, 4).map((app, index) => ({ ...app, enabled: index < 3 })));
const frozen = ref(false);

const save = () => emit("toast", "客户权益草稿已在原型中保存");
</script>

<template>
  <div v-if="organization" class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/ops/organizations')"><AppIcon name="arrow" :size="16" />返回客户组织</button>
    <section class="detail-command-bar internal-detail">
      <div class="org-avatar detail-org-avatar">{{ organization.name.slice(0, 1) }}</div>
      <div class="detail-title-copy"><span class="page-overline internal-overline">CUSTOMER ORGANIZATION</span><h1>{{ organization.name }}</h1><p><code>{{ organization.id }}</code> · {{ organization.plan }} · 有效期 {{ organization.expires }}</p></div>
      <div class="detail-command-actions"><StatusBadge :label="frozen ? '已冻结' : organization.status" /><button class="button danger" @click="frozen = !frozen">{{ frozen ? '解除冻结' : '冻结权益' }}</button><button class="button primary" @click="save">保存更改</button></div>
    </section>

    <section class="metric-grid compact"><MetricCard label="成员席位" :value="String(organization.members)" detail="按套餐限制" icon="members" tone="mint" /><MetricCard label="应用权益" :value="String(organization.apps)" detail="含 Preview 应用" icon="market" tone="blue" /><MetricCard label="本月 API" :value="organization.apiUsage" detail="用量摘要" icon="usage" tone="violet" /></section>

    <div class="detail-two-column organization-detail-grid">
      <section class="content-panel">
        <div class="section-heading"><div><h2>应用与模型权益</h2><p>套餐基础权益与客户单独授权合并计算。</p></div><span>权益版本 v12</span></div>
        <div class="entitlement-list"><label v-for="item in entitlements" :key="item.id"><span class="app-card-icon" :class="item.tone"><AppIcon :name="item.icon" :size="19" /></span><span><strong>{{ item.name }}</strong><small>{{ item.channel }} · {{ item.version }} · {{ item.gpu }}</small></span><input v-model="item.enabled" type="checkbox" /></label></div>
      </section>
      <aside class="content-panel customer-policy">
        <div class="section-heading"><div><h2>套餐与限制</h2><p>组织层的业务约束。</p></div></div>
        <label class="form-field"><span>套餐</span><select :value="organization.plan"><option>Enterprise</option><option>Studio</option><option>Pilot</option></select></label>
        <label class="form-field"><span>默认区域</span><select><option>中国大陆 · 华东</option><option>中国大陆 · 华北</option></select></label>
        <label class="form-field"><span>API 月预算</span><input value="41,000 点" /></label>
        <label class="form-field"><span>体验并发</span><input value="2" /></label>
      </aside>
    </div>

    <section class="content-panel organization-members">
      <div class="section-heading"><div><h2>成员与角色</h2><p>这里只管理业务角色；密码与身份协议仍由 Login 管理。</p></div><button class="text-button" @click="$emit('toast', '邀请成员流程已打开')">邀请成员</button></div>
      <div class="data-table member-table"><div class="table-head"><span>成员</span><span>角色</span><span>加入时间</span><span>状态</span><span /></div><div v-for="member in members.slice(0, 3)" :key="member.email" class="table-row"><span class="member-cell"><i>{{ member.avatar }}</i><span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span></span><span>{{ member.role }}</span><span>{{ member.joined }}</span><StatusBadge :label="member.status" /><button class="row-action">•••</button></div></div>
    </section>
  </div>
  <div v-else class="page"><button class="back-button" @click="navigate('/ops/organizations')"><AppIcon name="arrow" :size="16" />返回客户组织</button><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>找不到客户组织</strong><span>{{ organizationId }} 不存在，或当前角色无权查看。</span></section></div>
</template>
