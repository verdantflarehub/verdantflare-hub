<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";
import { formatQuotaUSD, formatUsagePercent } from "../utils/quota";

const props = defineProps({ path: String, organization: Object, organizations: Array });
const emit = defineEmits(["toast", "context-change"]);
const members = ref([]);
const billing = ref(null);
const billingLoading = ref(false);
const billingError = ref("");
const membersError = ref("");
const saving = ref(false);
const organizationDraft = ref({ name: "", defaultRegion: "cn-east-1", industry: "", billingEmail: "" });
const showInvite = ref(false);
const editingMember = ref(null);
const memberDraft = ref({ role: "成员", status: "待邀请" });
const guestQuery = ref("");
const guestPage = ref({ users: [], nextCursor: "" });
const guestsLoading = ref(false);
const guestError = ref("");
const selectedGuest = ref(null);
let guestRequest = 0;
let loadedGuestQuery = "";
const memberRole = ref("成员");
const transferTarget = ref("");
const transferRole = ref("成员");
const transferTargets = ref([]);
const transferError = ref("");
const transferLoading = ref(false);

const section = computed(() => props.path.split("/")[2] || "organization");
const canManageMembers = computed(() => props.organization?.roles?.includes("organization_admin"));
const titles = {
  organization: ["ORGANIZATION", "组织信息", "管理组织资料、区域与业务标识。"],
  members: ["MEMBERS & ROLES", "成员与角色", "选择已验证的待开通账号，分配组织角色并管理成员。"],
  billing: ["PLAN & BILLING", "套餐与账单", "查看套餐、真实额度、赠送记录与付款状态。"],
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
const loadBilling = async () => {
  billingLoading.value = true;
  billingError.value = "";
  try {
    billing.value = await controlApi.getBilling();
  } catch (cause) {
    billingError.value = cause instanceof Error ? cause.message : "账单摘要加载失败";
  } finally {
    billingLoading.value = false;
  }
};
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN");
};
watch([section, () => props.organization?.organizationId], ([value]) => {
  members.value = [];
  billing.value = null;
  if (value === "members" && props.organization) loadMembers();
  if (value === "billing" && props.organization) loadBilling();
}, { immediate: true });

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

const loadGuests = async (append = false) => {
  const request = ++guestRequest;
  if (!append) {
    loadedGuestQuery = guestQuery.value.trim();
    guestPage.value = { users: [], nextCursor: "" };
    selectedGuest.value = null;
  }
  guestsLoading.value = true;
  guestError.value = "";
  try {
    const page = await controlApi.listCurrentOrganizationGuests({ q: loadedGuestQuery, limit: 50, ...(append ? { cursor: guestPage.value.nextCursor } : {}) });
    if (request !== guestRequest) return;
    guestPage.value = { users: append ? [...guestPage.value.users, ...page.users] : page.users, nextCursor: page.nextCursor };
  } catch (cause) {
    if (request !== guestRequest) return;
    guestError.value = cause instanceof Error ? cause.message : "待开通账号加载失败";
  } finally {
    if (request === guestRequest) guestsLoading.value = false;
  }
};
const openGuestPicker = () => {
  showInvite.value = true;
  guestQuery.value = "";
  guestPage.value = { users: [], nextCursor: "" };
  memberRole.value = "成员";
  loadGuests();
};
const bindGuest = async () => {
  if (!selectedGuest.value) return;
  saving.value = true;
  guestError.value = "";
  try {
    await controlApi.bindCurrentOrganizationMember({ loginUserId: selectedGuest.value.id, role: memberRole.value });
    await loadMembers();
    showInvite.value = false;
    selectedGuest.value = null;
    emit("context-change");
    emit("toast", "账号已加入当前组织");
  } catch (cause) {
    guestError.value = cause instanceof Error ? cause.message : "绑定成员失败";
  } finally {
    saving.value = false;
  }
};

const editMember = (member) => {
  editingMember.value = member;
  memberDraft.value = { role: member.role, status: member.status };
  transferRole.value = member.role;
  transferTarget.value = "";
  transferError.value = "";
  transferLoading.value = false;
  transferTargets.value = (props.organizations || []).filter((org) => org.organizationId !== props.organization?.organizationId && org.roles?.includes("organization_admin"));
  if (props.organization?.roles?.includes("customer_success_admin")) {
    transferLoading.value = true;
    controlApi.listOperationsOrganizations().then((page) => {
      transferTargets.value = (Array.isArray(page) ? page : page.organizations || []).filter((org) => org.id !== props.organization?.organizationId && org.status !== "冻结").map((org) => ({ organizationId: org.id, name: org.name }));
    }).catch((cause) => {
      transferError.value = cause instanceof Error ? cause.message : "目标组织加载失败";
    }).finally(() => { transferLoading.value = false; });
  }
};

const transferMember = async () => {
  if (!editingMember.value?.centerUserId || !transferTarget.value) return;
  saving.value = true;
  transferError.value = "";
  try {
    const payload = { targetOrganizationId: transferTarget.value, role: transferRole.value };
    if (props.organization?.roles?.includes("customer_success_admin")) {
      await controlApi.transferManagedMember(props.organization.organizationId, editingMember.value.id, payload);
    } else {
      await controlApi.transferCurrentOrganizationMember(editingMember.value.id, payload);
    }
    await loadMembers();
    editingMember.value = null;
    emit("context-change");
    emit("toast", "成员已调整至目标组织");
  } catch (cause) {
    transferError.value = cause instanceof Error ? cause.message : "调整组织失败";
  } finally {
    saving.value = false;
  }
};

const saveMember = async () => {
  if (!editingMember.value) return;
  saving.value = true;
  membersError.value = "";
  try {
    await controlApi.updateMember(editingMember.value.id, memberDraft.value);
    await loadMembers();
    editingMember.value = null;
    emit("context-change");
    emit("toast", "成员角色与状态已保存");
  } catch (cause) {
    membersError.value = cause instanceof Error ? cause.message : "保存成员失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page settings-page">
    <header class="page-header"><div><span class="page-overline">{{ pageTitle[0] }}</span><h1>{{ pageTitle[1] }}</h1><p>{{ pageTitle[2] }}</p></div><button v-if="section === 'members' && canManageMembers" class="button primary" @click="openGuestPicker"><AppIcon name="plus" :size="17" />从待开通账号添加</button></header>

    <template v-if="section === 'organization'">
      <div class="settings-layout"><section class="content-panel organization-form"><div class="section-heading"><div><h2>基本信息</h2><p>这些信息会显示在 Hub 与业务通知中。</p></div></div><div class="org-identity"><span class="org-avatar large">{{ organization.shortName }}</span></div><div class="two-column-form"><label class="form-field"><span>组织名称</span><input v-model.trim="organizationDraft.name" /></label><label class="form-field"><span>组织 ID</span><div class="read-only-input"><code>{{ organization.organizationId }}</code></div></label><label class="form-field"><span>默认区域</span><select v-model="organizationDraft.defaultRegion"><option value="cn-east-1">华东 · 上海</option><option value="cn-north-1">华北 · 北京</option></select></label><label class="form-field"><span>行业</span><input v-model.trim="organizationDraft.industry" /></label></div><label class="form-field"><span>账单联系邮箱</span><input v-model.trim="organizationDraft.billingEmail" type="email" /></label><footer><button class="button primary" :disabled="saving" @click="saveOrganization">{{ saving ? '正在保存…' : '保存更改' }}</button></footer></section><aside class="content-panel context-panel"><h2>业务上下文</h2><dl><div><dt>当前套餐</dt><dd>{{ organization.plan || '未配置' }}</dd></div><div><dt>你的角色</dt><dd>{{ organization.roles?.join('、') || '成员' }}</dd></div><div><dt>权益版本</dt><dd>v{{ organization.entitlementVersion }}</dd></div></dl><div class="context-note"><AppIcon name="warning" :size="18" /><p>身份认证由 Login Service 管理。修改邮箱、密码或企业 SSO 请前往登录账户中心。</p></div><a href="https://login.verdantflarehub.com" target="_blank" rel="noreferrer">打开账户中心<AppIcon name="external" :size="15" /></a></aside></div>
    </template>

    <template v-else-if="section === 'members'">
      <section v-if="membersError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>成员操作未完成</strong><p>{{ membersError }}</p></div><button class="button secondary" @click="loadMembers">重试</button></section>
      <div class="member-summary"><span><strong>{{ members.length }}</strong> 成员记录</span><span><strong>{{ members.filter((member) => member.role === '组织管理员').length }}</strong> 管理员</span><span><strong>{{ members.filter((member) => member.status === '待邀请').length }}</strong> 待接受</span></div>
      <div class="data-table member-table"><div class="table-head"><span>成员</span><span>角色</span><span>加入时间</span><span>状态</span><span /></div><div v-for="member in members" :key="member.id" class="table-row"><span class="member-cell"><i>{{ member.avatar }}</i><span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span></span><span>{{ member.role }}</span><span>{{ member.joined }}</span><StatusBadge :label="member.status" /><button v-if="canManageMembers" class="row-action" :aria-label="`管理成员 ${member.email}`" @click="editMember(member)"><AppIcon name="arrow" :size="15" /></button><span v-else /></div></div>
      <section class="role-guide"><div><AppIcon name="members" :size="22" /><span><strong>已绑定用户的角色与停用状态即时影响 Hub 权限</strong><small>待开通账号来自 Login；历史待绑定记录不代表该账号已加入组织。</small></span></div></section>
    </template>

    <template v-else-if="section === 'billing'">
      <section v-if="billingError" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>额度与发放记录暂不可用</strong><p>{{ billingError }}</p></div><button class="button secondary" @click="loadBilling">重新加载</button></section>
      <p v-if="billingLoading">正在读取套餐与账单…</p>
      <template v-if="billing && !billingError">
        <section class="plan-hero"><div><span class="page-overline">CURRENT PLAN</span><h2>{{ billing.plan || '未配置套餐' }}</h2><p>套餐名称来自组织资料；额度与用量来自模型网关，不代表已付款。</p><div class="plan-tags"><span>API 额度按实际消耗结算</span><span>管理员赠送额度单独留痕</span></div></div><aside><span>组织 API 余额</span><strong>{{ formatQuotaUSD(billing.usage.remainingQuota) }}</strong><small>使用量与在线体验显示同一网关余额</small><button class="button secondary" :disabled="billingLoading" @click="loadBilling">刷新记录</button></aside></section>
        <section class="metric-grid compact"><MetricCard label="累计分配" :value="formatQuotaUSD(billing.usage.budgetQuota)" detail="网关累计额度" icon="usage" tone="mint" /><MetricCard label="已使用" :value="formatQuotaUSD(billing.usage.usedQuota)" :detail="formatUsagePercent(billing.usage.usedQuota, billing.usage.budgetQuota)" icon="tasks" tone="blue" /><MetricCard label="剩余" :value="formatQuotaUSD(billing.usage.remainingQuota)" detail="当前可用额度" icon="check" tone="violet" /></section>
        <div class="billing-columns"><section class="content-panel"><div class="section-heading"><div><h2>额度账单</h2><p>每次管理员赠送额度（包括首次赠送）都有独立记录；这不是客户付款或税务发票。</p></div></div><div class="data-table invoice-table credit-grant-table"><div class="table-head"><span>发放时间</span><span>类型</span><span>金额</span><span>状态</span></div><div v-for="grant in billing.creditGrants" :key="grant.id" class="table-row"><strong>{{ formatDate(grant.createdAt) }}</strong><span>管理员赠送额度<small>记录号 {{ grant.id }}</small></span><span>{{ formatQuotaUSD(grant.amountCents * 5000) }}</span><StatusBadge label="已到账" /></div></div><p v-if="!billing.creditGrants.length" class="billing-empty">暂无额度账单记录。</p></section><section class="content-panel billing-contact"><h2>付费账单与发票</h2><p>当前未接入收款与开票系统；赠送额度无需付款，也不会生成发票。</p><div class="contact-row"><span>财</span><div><strong>账单联系邮箱</strong><small>{{ organization.billingEmail || '尚未填写' }}</small></div></div><button class="button secondary" @click="navigate('/settings/organization')">更新联系方式</button></section></div>
      </template>
    </template>

    <Transition name="modal"><div v-if="showInvite" class="modal-backdrop" @click.self="showInvite = false"><section class="modal-card invite-modal guest-picker"><header><div><span class="page-overline">REGISTERED USERS</span><h2>选择待开通账号</h2><p>列出全站已验证邮箱、尚未绑定组织的账号；新注册账号不预先属于任何组织。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showInvite = false"><AppIcon name="close" /></button></header><label class="form-field"><span>搜索账号（可选）</span><input v-model.trim="guestQuery" type="search" placeholder="按邮箱筛选，留空查看全部" @keyup.enter="loadGuests()" /></label><button class="button secondary" :disabled="guestsLoading" @click="loadGuests()">查询</button><p v-if="guestError" class="form-error" role="alert">{{ guestError }}</p><div class="guest-options" role="listbox" aria-label="待开通账号"><button v-for="guest in guestPage.users" :key="guest.id" type="button" class="guest-option" :class="{ selected: selectedGuest?.id === guest.id }" role="option" :aria-selected="selectedGuest?.id === guest.id" @click="selectedGuest = guest"><span><strong>{{ guest.email }}</strong><small>已验证 · {{ formatDate(guest.createdAt) }} 注册</small></span><AppIcon :name="selectedGuest?.id === guest.id ? 'check' : 'arrow'" :size="16" /></button><p v-if="!guestsLoading && !guestPage.users.length && !guestError" class="guest-empty">暂无符合条件的待开通账号。</p></div><button v-if="guestPage.nextCursor" class="button secondary" :disabled="guestsLoading" @click="loadGuests(true)">加载更多</button><p v-if="guestsLoading">正在读取账号…</p><label v-if="selectedGuest" class="form-field"><span>在当前组织授予 {{ selectedGuest.email }} 的角色</span><select v-model="memberRole"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><p class="invite-note">确认后立即授予当前组织访问权；不自动增加 API 额度或应用权益。</p><footer><button class="button secondary" @click="showInvite = false">取消</button><button class="button primary" :disabled="saving || !selectedGuest" @click="bindGuest">{{ saving ? '正在绑定…' : '确认加入组织' }}</button></footer></section></div></Transition>
    <Transition name="modal"><div v-if="editingMember" class="modal-backdrop" @click.self="editingMember = null"><section class="modal-card invite-modal"><header><div><span class="page-overline">MEMBER MANAGEMENT</span><h2>管理成员</h2><p>{{ editingMember.email }} · {{ editingMember.centerUserId ? '已绑定 Login' : '尚未绑定 Login' }}</p></div><button class="icon-button" aria-label="关闭弹窗" @click="editingMember = null"><AppIcon name="close" /></button></header><label class="form-field"><span>组织角色</span><select v-model="memberDraft.role"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><label class="form-field"><span>状态</span><select v-model="memberDraft.status"><template v-if="editingMember.centerUserId"><option>正常</option><option>停用</option></template><template v-else><option>待邀请</option><option>未绑定</option><option>已取消</option></template></select></label><div class="invite-note">{{ editingMember.centerUserId ? '停用后，该用户将失去此组织的 Hub 访问权限。' : '未绑定记录不会授予登录或组织访问权限。' }}</div><footer><button class="button secondary" @click="editingMember = null">取消</button><button class="button primary" :disabled="saving" @click="saveMember">{{ saving ? '正在保存…' : '保存成员' }}</button></footer><div v-if="editingMember.centerUserId" class="member-transfer"><h3>调整所属组织</h3><p>从当前组织移出并加入目标组织；不会转移 API 额度或应用权益。</p><p v-if="transferLoading">正在读取可管理组织…</p><p v-if="transferError" class="form-error" role="alert">{{ transferError }}</p><label class="form-field"><span>目标组织</span><select v-model="transferTarget" :disabled="transferLoading"><option value="">请选择目标组织</option><option v-for="target in transferTargets" :key="target.organizationId" :value="target.organizationId">{{ target.name }}</option></select></label><label class="form-field"><span>目标组织角色</span><select v-model="transferRole"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><p v-if="!transferLoading && !transferTargets.length" class="invite-note">暂无可调整的目标组织；组织管理员需同时管理来源和目标组织。</p><button class="button secondary" :disabled="saving || !transferTarget" @click="transferMember">{{ saving ? '正在调整…' : '确认调整组织' }}</button></div></section></div></Transition>
  </div>
</template>
