<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";

const props = defineProps({ path: String, organization: Object });
const emit = defineEmits(["toast", "context-change"]);
const members = ref([]);
const membersError = ref("");
const saving = ref(false);
const organizationDraft = ref({ name: "", defaultRegion: "cn-east-1", industry: "", billingEmail: "" });
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

watch(() => props.organization, (organization) => {
  if (!organization) return;
  organizationDraft.value = {
    name: organization.name,
    shortName: organization.shortName,
    defaultRegion: organization.defaultRegion || "cn-east-1",
    industry: organization.industry || "",
    billingEmail: organization.billingEmail || "",
  };
}, { immediate: true });

const loadMembers = async () => {
  try {
    membersError.value = "";
    members.value = await controlApi.listMembers();
  } catch (cause) {
    membersError.value = cause instanceof Error ? cause.message : "成员加载失败";
  }
};
watch(section, (value) => { if (value === "members") loadMembers(); }, { immediate: true });

const saveOrganization = async () => {
  saving.value = true;
  try {
    await controlApi.updateOrganization(organizationDraft.value);
    emit("context-change");
    emit("toast", "组织信息已保存");
  } catch (cause) {
    emit("toast", cause instanceof Error ? cause.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

const sendInvite = async () => {
  if (!inviteEmail.value.trim()) return;
  saving.value = true;
  try {
    await controlApi.inviteMember({ email: inviteEmail.value.trim(), role: inviteRole.value });
    await loadMembers();
    inviteEmail.value = "";
    showInvite.value = false;
    emit("toast", "待接受成员记录已创建");
  } catch (cause) {
    membersError.value = cause instanceof Error ? cause.message : "创建邀请记录失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page settings-page">
    <header class="page-header"><div><span class="page-overline">{{ pageTitle[0] }}</span><h1>{{ pageTitle[1] }}</h1><p>{{ pageTitle[2] }}</p></div><button v-if="section === 'members'" class="button primary" @click="showInvite = true"><AppIcon name="plus" :size="17" />邀请成员</button></header>

    <template v-if="section === 'organization'">
      <div class="settings-layout"><section class="content-panel organization-form"><div class="section-heading"><div><h2>基本信息</h2><p>这些信息会显示在 Hub 与业务通知中。</p></div></div><div class="org-identity"><span class="org-avatar large">{{ organization.shortName }}</span></div><div class="two-column-form"><label class="form-field"><span>组织名称</span><input v-model.trim="organizationDraft.name" /></label><label class="form-field"><span>组织 ID</span><div class="read-only-input"><code>{{ organization.organizationId }}</code></div></label><label class="form-field"><span>默认区域</span><select v-model="organizationDraft.defaultRegion"><option value="cn-east-1">华东 · 上海</option><option value="cn-north-1">华北 · 北京</option></select></label><label class="form-field"><span>行业</span><input v-model.trim="organizationDraft.industry" /></label></div><label class="form-field"><span>账单联系邮箱</span><input v-model.trim="organizationDraft.billingEmail" type="email" /></label><footer><button class="button primary" :disabled="saving" @click="saveOrganization">{{ saving ? '正在保存…' : '保存更改' }}</button></footer></section><aside class="content-panel context-panel"><h2>业务上下文</h2><dl><div><dt>当前套餐</dt><dd>{{ organization.plan }}</dd></div><div><dt>你的角色</dt><dd>{{ organization.roles?.join('、') || '成员' }}</dd></div><div><dt>权益版本</dt><dd>v{{ organization.entitlementVersion }}</dd></div></dl><div class="context-note"><AppIcon name="warning" :size="18" /><p>身份认证由 Login Service 管理。修改邮箱、密码或企业 SSO 请前往登录账户中心。</p></div><a href="https://login.verdantflarehub.com" target="_blank" rel="noreferrer">打开账户中心<AppIcon name="external" :size="15" /></a></aside></div>
    </template>

    <template v-else-if="section === 'members'">
      <section v-if="membersError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>成员操作未完成</strong><p>{{ membersError }}</p></div><button class="button secondary" @click="loadMembers">重试</button></section>
      <div class="member-summary"><span><strong>{{ members.length }}</strong> 成员记录</span><span><strong>{{ members.filter((member) => member.role === '组织管理员').length }}</strong> 管理员</span><span><strong>{{ members.filter((member) => member.status === '待邀请').length }}</strong> 待接受</span></div>
      <div class="data-table member-table"><div class="table-head"><span>成员</span><span>角色</span><span>加入时间</span><span>状态</span><span /></div><div v-for="member in members" :key="member.email" class="table-row"><span class="member-cell"><i>{{ member.avatar }}</i><span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span></span><span>{{ member.role }}</span><span>{{ member.joined }}</span><StatusBadge :label="member.status" /><span /></div></div>
      <section class="role-guide"><div><AppIcon name="members" :size="22" /><span><strong>角色决定能做什么，权益决定能使用什么</strong><small>待接受成员记录不会自动创建 Login 账号，也不会发送邮件。</small></span></div></section>
    </template>

    <template v-else-if="section === 'billing'">
      <section class="plan-hero"><div><span class="page-overline">CURRENT PLAN</span><h2>{{ organization.plan }}</h2><p>适合持续内容生产、应用体验与团队 API 接入。</p><div class="plan-tags"><span>18 个成员席位</span><span>22 个应用</span><span>41,000 API 点 / 月</span><span>2 个体验并发</span></div></div><aside><span>当前周期</span><strong>2026.07.01 — 07.31</strong><small>2026 年 8 月 1 日自动续期</small><button class="button light" @click="$emit('toast', '套餐咨询已提交')">联系套餐顾问</button></aside></section>
      <section class="metric-grid compact"><MetricCard label="API 本月使用" value="28,160 点" detail="预算的 68.7%" icon="usage" tone="mint" /><MetricCard label="体验本月使用" value="142 点" detail="剩余 680 点" icon="experience" tone="blue" /><MetricCard label="成员席位" value="4 / 18" detail="14 个席位可用" icon="members" tone="violet" /></section>
      <div class="billing-columns"><section><div class="section-heading"><div><h2>账单摘要</h2><p>人民币 · 含税金额</p></div><button class="text-button">全部账单</button></div><div class="data-table invoice-table"><div class="table-head"><span>账期</span><span>账单号</span><span>金额</span><span>状态</span></div><div class="table-row"><strong>2026 年 6 月</strong><code>VF-202606-0138</code><span>¥ 32,800.00</span><StatusBadge label="成功" /></div><div class="table-row"><strong>2026 年 5 月</strong><code>VF-202605-0122</code><span>¥ 29,460.00</span><StatusBadge label="成功" /></div></div></section><section class="content-panel billing-contact"><h2>账单联系方式</h2><p>账单与用量提醒将发送给以下联系人。</p><div class="contact-row"><span>财</span><div><strong>财务团队</strong><small>finance@verdantflare.com</small></div></div><button class="button secondary">更新联系方式</button></section></div>
    </template>

    <Transition name="modal"><div v-if="showInvite" class="modal-backdrop" @click.self="showInvite = false"><section class="modal-card invite-modal"><header><div><span class="page-overline">INVITE MEMBER</span><h2>创建待接受成员</h2><p>此操作保存成员记录；账号开通仍由 Login 管理。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showInvite = false"><AppIcon name="close" /></button></header><label class="form-field"><span>邮箱地址</span><input v-model="inviteEmail" type="email" placeholder="name@company.com" autofocus /></label><label class="form-field"><span>组织角色</span><select v-model="inviteRole"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><div class="invite-note">保存后不会自动发送邮件，也不会授予应用或模型权益。</div><footer><button class="button secondary" @click="showInvite = false">取消</button><button class="button primary" :disabled="!inviteEmail.trim() || saving" @click="sendInvite">{{ saving ? '正在保存…' : '创建记录' }}</button></footer></section></div></Transition>
  </div>
</template>
