<script setup>
import { computed, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { members as seedMembers } from "../data/mock";

const props = defineProps({ path: String, organization: Object });
const emit = defineEmits(["toast"]);
const members = ref(structuredClone(seedMembers));
const showInvite = ref(false);
const inviteEmail = ref("");
const inviteRole = ref("成员");

const section = computed(() => props.path.split("/")[2] || "organization");
const titles = {
  organization: ["ORGANIZATION", "组织信息", "管理组织资料、区域与业务标识。"],
  members: ["MEMBERS & ROLES", "成员与角色", "邀请成员并分配组织内的最小业务权限。"],
  billing: ["PLAN & BILLING", "套餐与账单", "查看套餐权益、预算和账单摘要。"],
};
const pageTitle = computed(() => titles[section.value] || titles.organization);

const sendInvite = () => {
  if (!inviteEmail.value.trim()) return;
  members.value.push({ name: inviteEmail.value.split("@")[0], email: inviteEmail.value, role: inviteRole.value, joined: "等待接受", status: "待邀请", avatar: inviteEmail.value.slice(0, 1).toUpperCase() });
  inviteEmail.value = "";
  showInvite.value = false;
  emit("toast", "邀请已发送");
};
</script>

<template>
  <div class="page settings-page">
    <header class="page-header"><div><span class="page-overline">{{ pageTitle[0] }}</span><h1>{{ pageTitle[1] }}</h1><p>{{ pageTitle[2] }}</p></div><button v-if="section === 'members'" class="button primary" @click="showInvite = true"><AppIcon name="plus" :size="17" />邀请成员</button></header>

    <template v-if="section === 'organization'">
      <div class="settings-layout"><section class="content-panel organization-form"><div class="section-heading"><div><h2>基本信息</h2><p>这些信息会显示在 Hub 与业务通知中。</p></div></div><div class="org-identity"><span class="org-avatar large">{{ organization.shortName }}</span><button class="button secondary">更换标识</button></div><div class="two-column-form"><label class="form-field"><span>组织名称</span><input :value="organization.name" /></label><label class="form-field"><span>组织 ID</span><div class="read-only-input"><code>{{ organization.organizationId }}</code><AppIcon name="copy" :size="16" /></div></label><label class="form-field"><span>默认区域</span><select><option>华东 · 上海</option><option>华北 · 北京</option></select></label><label class="form-field"><span>行业</span><select><option>媒体与内容制作</option><option>软件与互联网</option></select></label></div><label class="form-field"><span>账单联系邮箱</span><input value="finance@verdantflare.com" /></label><footer><button class="button primary" @click="$emit('toast', '组织信息已保存')">保存更改</button></footer></section><aside class="content-panel context-panel"><h2>业务上下文</h2><dl><div><dt>当前套餐</dt><dd>{{ organization.plan }}</dd></div><div><dt>你的角色</dt><dd>组织管理员</dd></div><div><dt>权益版本</dt><dd>v{{ organization.entitlementVersion }}</dd></div><div><dt>Center User</dt><dd><code>cu_01HUB7C9Q</code></dd></div></dl><div class="context-note"><AppIcon name="warning" :size="18" /><p>身份认证由 Login Service 管理。修改邮箱、密码或企业 SSO 请前往登录账户中心。</p></div><a href="https://login.verdantflarehub.com" target="_blank" rel="noreferrer">打开账户中心<AppIcon name="external" :size="15" /></a></aside></div>
    </template>

    <template v-else-if="section === 'members'">
      <div class="member-summary"><span><strong>{{ members.length }}</strong> 成员</span><span><strong>2</strong> 管理员</span><span><strong>1</strong> 待接受邀请</span><label class="search-field small"><AppIcon name="search" :size="16" /><input placeholder="搜索成员" /></label></div>
      <div class="data-table member-table"><div class="table-head"><span>成员</span><span>角色</span><span>加入时间</span><span>状态</span><span /></div><div v-for="member in members" :key="member.email" class="table-row"><span class="member-cell"><i>{{ member.avatar }}</i><span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span></span><span>{{ member.role }}</span><span>{{ member.joined }}</span><StatusBadge :label="member.status" /><button class="row-action" :aria-label="`管理成员 ${member.name}`">•••</button></div></div>
      <section class="role-guide"><div><AppIcon name="members" :size="22" /><span><strong>角色决定能做什么，权益决定能使用什么</strong><small>成员角色不会自动授予付费模型、应用或体验额度。</small></span></div><button class="text-button">了解权限模型</button></section>
    </template>

    <template v-else-if="section === 'billing'">
      <section class="plan-hero"><div><span class="page-overline">CURRENT PLAN</span><h2>{{ organization.plan }}</h2><p>适合持续内容生产、应用体验与团队 API 接入。</p><div class="plan-tags"><span>18 个成员席位</span><span>22 个应用</span><span>41,000 API 点 / 月</span><span>2 个体验并发</span></div></div><aside><span>当前周期</span><strong>2026.07.01 — 07.31</strong><small>2026 年 8 月 1 日自动续期</small><button class="button light" @click="$emit('toast', '套餐咨询已提交')">联系套餐顾问</button></aside></section>
      <section class="metric-grid compact"><MetricCard label="API 本月使用" value="28,160 点" detail="预算的 68.7%" icon="usage" tone="mint" /><MetricCard label="体验本月使用" value="142 点" detail="剩余 680 点" icon="experience" tone="blue" /><MetricCard label="成员席位" value="4 / 18" detail="14 个席位可用" icon="members" tone="violet" /></section>
      <div class="billing-columns"><section><div class="section-heading"><div><h2>账单摘要</h2><p>人民币 · 含税金额</p></div><button class="text-button">全部账单</button></div><div class="data-table invoice-table"><div class="table-head"><span>账期</span><span>账单号</span><span>金额</span><span>状态</span></div><div class="table-row"><strong>2026 年 6 月</strong><code>VF-202606-0138</code><span>¥ 32,800.00</span><StatusBadge label="成功" /></div><div class="table-row"><strong>2026 年 5 月</strong><code>VF-202605-0122</code><span>¥ 29,460.00</span><StatusBadge label="成功" /></div></div></section><section class="content-panel billing-contact"><h2>账单联系方式</h2><p>账单与用量提醒将发送给以下联系人。</p><div class="contact-row"><span>财</span><div><strong>财务团队</strong><small>finance@verdantflare.com</small></div></div><button class="button secondary">更新联系方式</button></section></div>
    </template>

    <Transition name="modal"><div v-if="showInvite" class="modal-backdrop" @click.self="showInvite = false"><section class="modal-card invite-modal"><header><div><span class="page-overline">INVITE MEMBER</span><h2>邀请组织成员</h2><p>受邀用户仍需通过 Login 完成认证。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showInvite = false"><AppIcon name="close" /></button></header><label class="form-field"><span>邮箱地址</span><input v-model="inviteEmail" type="email" placeholder="name@company.com" autofocus /></label><label class="form-field"><span>组织角色</span><select v-model="inviteRole"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><div class="invite-note">邀请不会自动授予应用或模型权益，能力范围仍由组织 Entitlement 决定。</div><footer><button class="button secondary" @click="showInvite = false">取消</button><button class="button primary" :disabled="!inviteEmail.trim()" @click="sendInvite">发送邀请</button></footer></section></div></Transition>
  </div>
</template>
