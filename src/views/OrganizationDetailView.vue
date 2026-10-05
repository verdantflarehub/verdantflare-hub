<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";
import { formatQuotaUSD } from "../utils/quota";

const props = defineProps({ path: String });
const emit = defineEmits(["toast", "context-change"]);
const organizationId = computed(() => props.path.split("/").filter(Boolean).at(-1));
const record = ref(null);
const form = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const credit = ref(null);
const creditError = ref("");
const creditAmount = ref("");
const creditRequestId = ref("");
const grantingCredit = ref(false);
const showCreateMember = ref(false);
const guestQuery = ref("");
const guestPage = ref({ users: [], nextCursor: "" });
const guestsLoading = ref(false);
const guestError = ref("");
const selectedGuest = ref(null);
const memberRole = ref("成员");
const editingMember = ref(null);
const memberDraft = ref({ role: "成员", status: "待邀请" });
const organizationForm = (organization, appIds) => ({
  name: organization.name,
  shortName: organization.shortName,
  defaultRegion: organization.defaultRegion || "cn-east-1",
  industry: organization.industry || "",
  billingEmail: organization.billingEmail || "",
  plan: organization.plan,
  status: organization.status,
  appIds: [...appIds],
});

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    record.value = await controlApi.getManagedOrganization(organizationId.value);
    form.value = organizationForm(record.value.organization, record.value.appIds);
    await loadCredit();
  } catch (cause) {
    record.value = null;
    error.value = cause instanceof Error ? cause.message : "客户组织加载失败";
  } finally {
    loading.value = false;
  }
};
const loadCredit = async () => {
  creditError.value = "";
  try {
    credit.value = await controlApi.getOrganizationApiCredit(organizationId.value);
  } catch (cause) {
    credit.value = null;
    creditError.value = cause instanceof Error ? cause.message : "网关额度加载失败";
  }
};
const grantCredit = async () => {
  const amountCents = Math.round(Number(creditAmount.value) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 1 || amountCents > 100000 || Math.abs(amountCents / 100 - Number(creditAmount.value)) > 0.000001) {
    creditError.value = "请输入 0.01–1000.00 美元，最多两位小数";
    return;
  }
  if (!creditRequestId.value) creditRequestId.value = crypto.randomUUID();
  grantingCredit.value = true;
  creditError.value = "";
  try {
    credit.value = await controlApi.grantOrganizationApiCredit(organizationId.value, { amountCents, requestId: creditRequestId.value });
    creditAmount.value = "";
    creditRequestId.value = "";
    emit("toast", "API 额度已分配");
  } catch (cause) {
    creditError.value = cause instanceof Error ? cause.message : "分配额度失败";
  } finally {
    grantingCredit.value = false;
  }
};
watch(organizationId, () => {
  creditRequestId.value = "";
  creditAmount.value = "";
  credit.value = null;
  load();
}, { immediate: true });

const save = async (status = form.value.status) => {
  saving.value = true;
  error.value = "";
  try {
    record.value = await controlApi.updateManagedOrganization(organizationId.value, {
      ...form.value,
      status,
      expectedEntitlementVersion: record.value.organization.entitlementVersion,
    });
    form.value = organizationForm(record.value.organization, record.value.appIds);
    emit("context-change");
    emit("toast", "客户组织与权益已保存");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存失败";
  } finally {
    saving.value = false;
  }
};

const loadGuests = async (append = false) => {
  guestsLoading.value = true;
  guestError.value = "";
  try {
    const page = await controlApi.listGuests({ q: guestQuery.value.trim(), limit: 50, ...(append ? { cursor: guestPage.value.nextCursor } : {}) });
    guestPage.value = { users: append ? [...guestPage.value.users, ...page.users] : page.users, nextCursor: page.nextCursor };
    if (!append) selectedGuest.value = null;
  } catch (cause) {
    guestError.value = cause instanceof Error ? cause.message : "游客列表加载失败";
  } finally {
    guestsLoading.value = false;
  }
};
const openGuestPicker = () => {
  showCreateMember.value = true;
  guestQuery.value = "";
  guestPage.value = { users: [], nextCursor: "" };
  loadGuests();
};
const selectGuest = (guest) => {
  selectedGuest.value = guest;
  memberRole.value = record.value.members.find((member) => member.email.toLowerCase() === guest.email.toLowerCase() && !member.centerUserId)?.role || "成员";
};
const createMember = async () => {
  if (!selectedGuest.value) return;
  saving.value = true;
  error.value = "";
  try {
    await controlApi.bindManagedMember(organizationId.value, { loginUserId: selectedGuest.value.id, role: memberRole.value });
    record.value = await controlApi.getManagedOrganization(organizationId.value);
    showCreateMember.value = false;
    selectedGuest.value = null;
    emit("toast", "用户已加入组织，可重新登录查看权限");
  } catch (cause) {
    guestError.value = cause instanceof Error ? cause.message : "绑定成员失败";
  } finally {
    saving.value = false;
  }
};

const editMember = (member) => {
  editingMember.value = member;
  memberDraft.value = { role: member.role, status: member.status };
};

const saveMember = async () => {
  saving.value = true;
  error.value = "";
  try {
    await controlApi.updateManagedMember(organizationId.value, editingMember.value.id, memberDraft.value);
    record.value = await controlApi.getManagedOrganization(organizationId.value);
    editingMember.value = null;
    emit("context-change");
    emit("toast", "成员角色与状态已保存");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存成员失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/ops/organizations')"><AppIcon name="arrow" :size="16" />返回客户组织</button>
    <p v-if="loading">正在加载客户组织…</p>
    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
    <template v-if="record && form">
      <section class="detail-command-bar internal-detail">
        <div class="org-avatar detail-org-avatar">{{ record.organization.shortName }}</div>
        <div class="detail-title-copy"><span class="page-overline internal-overline">CUSTOMER ORGANIZATION</span><h1>{{ record.organization.name }}</h1><p><code>{{ record.organization.organizationId }}</code> · {{ record.organization.plan }} · 权益版本 v{{ record.organization.entitlementVersion }}</p></div>
        <div class="detail-command-actions"><StatusBadge :label="record.organization.status" /><button class="button danger" :disabled="saving" @click="save(record.organization.status === '冻结' ? '正常' : '冻结')">{{ record.organization.status === '冻结' ? '解除冻结' : '冻结权益' }}</button><button class="button primary" :disabled="saving" @click="save()">保存更改</button></div>
      </section>

      <section class="metric-grid compact"><MetricCard label="成员记录" :value="String(record.members.length)" detail="含待接受邀请" icon="members" tone="mint" /><MetricCard label="应用权益" :value="String(record.appIds.length)" detail="已授权应用" icon="market" tone="blue" /><MetricCard label="权益版本" :value="`v${record.organization.entitlementVersion}`" detail="每次保存递增" icon="usage" tone="violet" /></section>

      <section class="content-panel organization-credit"><div class="section-heading"><div><h2>模型 API 额度</h2><p>网关账户余额为准；由客户成功管理员按美元追加。发放记录会出现在组织的“套餐与账单”，不代表客户付款。</p></div><button class="button secondary" :disabled="grantingCredit" @click="loadCredit">刷新额度</button></div><p v-if="creditError" class="form-error" role="alert">{{ creditError }}</p><div v-if="credit" class="metric-grid compact"><MetricCard label="累计分配" :value="formatQuotaUSD(credit.remainingQuota + credit.usedQuota)" detail="美元" icon="usage" tone="mint" /><MetricCard label="已使用" :value="formatQuotaUSD(credit.usedQuota)" detail="美元" icon="tasks" tone="blue" /><MetricCard label="剩余额度" :value="formatQuotaUSD(credit.remainingQuota)" :detail="credit.enabled ? '网关账号启用' : '网关账号已停用'" icon="check" tone="violet" /></div><div class="credit-grant-form"><label class="form-field"><span>本次追加金额（USD）</span><input v-model="creditAmount" type="number" min="0.01" max="1000" step="0.01" inputmode="decimal" placeholder="例如 10.00" /></label><button class="button primary" :disabled="grantingCredit || record.organization.status === '冻结' || !creditAmount" @click="grantCredit">{{ grantingCredit ? '正在分配…' : '确认追加额度' }}</button></div><p class="credit-help">仅追加，不覆盖原余额。网络失败后使用同一请求 ID 重试，避免重复加额。</p></section>

      <div class="detail-two-column organization-detail-grid">
        <section class="content-panel"><div class="section-heading"><div><h2>应用权益</h2><p>客户仅能看到已发布且已授权的应用。</p></div><span>v{{ record.organization.entitlementVersion }}</span></div><div class="entitlement-list"><label v-for="app in record.apps" :key="app.id"><span class="app-card-icon" :class="app.tone"><AppIcon :name="app.icon || 'market'" :size="19" /></span><span><strong>{{ app.name }}</strong><small>{{ app.channel }} · {{ app.version }} · {{ app.gpu }}</small></span><input v-model="form.appIds" type="checkbox" :value="app.id" /></label></div><p v-if="!record.apps.length">暂无可授权的已发布应用。</p></section>
        <aside class="content-panel customer-policy"><div class="section-heading"><div><h2>组织资料、套餐与状态</h2><p>资料保存到 Control；冻结后立即隐藏该组织的应用 Market。</p></div></div><label class="form-field"><span>组织名称</span><input v-model.trim="form.name" /></label><label class="form-field"><span>简称</span><input v-model.trim="form.shortName" /></label><label class="form-field"><span>默认区域</span><select v-model="form.defaultRegion"><option value="cn-east-1">华东 · 上海</option><option value="cn-north-1">华北 · 北京</option></select></label><label class="form-field"><span>行业</span><input v-model.trim="form.industry" /></label><label class="form-field"><span>账单联系邮箱</span><input v-model.trim="form.billingEmail" type="email" /></label><label class="form-field"><span>套餐</span><select v-model="form.plan"><option>Enterprise</option><option>Studio</option><option>Pilot</option></select></label><label class="form-field"><span>状态</span><select v-model="form.status"><option>正常</option><option>冻结</option></select></label></aside>
      </div>

      <section class="content-panel organization-members"><div class="section-heading"><div><h2>成员与角色</h2><p>从已注册游客中选择并绑定；待绑定记录本身不会赋予访问权。</p></div><button class="button secondary" @click="openGuestPicker"><AppIcon name="plus" :size="16" />从游客添加</button></div><div class="data-table member-table"><div class="table-head"><span>成员</span><span>角色</span><span>加入时间</span><span>状态</span><span /></div><div v-for="member in record.members" :key="member.id" class="table-row"><span class="member-cell"><i>{{ member.avatar }}</i><span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span></span><span>{{ member.role }}</span><span>{{ member.joined }}</span><StatusBadge :label="member.status" /><button class="row-action" :aria-label="`管理成员 ${member.email}`" @click="editMember(member)"><AppIcon name="arrow" :size="15" /></button></div></div><p v-if="!record.members.length">该组织尚无成员记录。</p></section>
    </template>
    <Transition name="modal"><div v-if="showCreateMember" class="modal-backdrop" @click.self="showCreateMember = false"><section class="modal-card invite-modal guest-picker"><header><div><span class="page-overline">REGISTERED GUESTS</span><h2>从游客添加成员</h2><p>仅列出已注册且通过邮箱验证、尚未绑定组织的账号。</p></div><button class="icon-button" aria-label="关闭弹窗" @click="showCreateMember = false"><AppIcon name="close" /></button></header><label class="form-field"><span>查找游客（可选）</span><input v-model.trim="guestQuery" type="search" placeholder="按邮箱筛选，留空查看全部" @keyup.enter="loadGuests()" /></label><button class="button secondary" :disabled="guestsLoading" @click="loadGuests()">查询</button><p v-if="guestError" class="form-error" role="alert">{{ guestError }}</p><div class="guest-options" role="listbox" aria-label="已注册游客"><button v-for="guest in guestPage.users" :key="guest.id" type="button" class="guest-option" :class="{ selected: selectedGuest?.id === guest.id }" role="option" :aria-selected="selectedGuest?.id === guest.id" @click="selectGuest(guest)"><span><strong>{{ guest.email }}</strong><small>已验证 · {{ new Date(guest.createdAt).toLocaleDateString('zh-CN') }} 注册</small></span><AppIcon :name="selectedGuest?.id === guest.id ? 'check' : 'arrow'" :size="16" /></button><p v-if="!guestsLoading && !guestPage.users.length && !guestError" class="guest-empty">没有符合条件的游客。</p></div><button v-if="guestPage.nextCursor" class="button secondary" :disabled="guestsLoading" @click="loadGuests(true)">加载更多</button><p v-if="guestsLoading">正在读取游客…</p><label v-if="selectedGuest" class="form-field"><span>授予 {{ selectedGuest.email }} 的组织角色</span><select v-model="memberRole"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><p class="invite-note">绑定后立即生效，不自动授权应用或增加 API 额度。</p><footer><button class="button secondary" @click="showCreateMember = false">取消</button><button class="button primary" :disabled="saving || !selectedGuest" @click="createMember">{{ saving ? '正在绑定…' : '确认加入组织' }}</button></footer></section></div></Transition>
    <Transition name="modal"><div v-if="editingMember" class="modal-backdrop" @click.self="editingMember = null"><section class="modal-card invite-modal"><header><div><span class="page-overline">MEMBER MANAGEMENT</span><h2>管理成员</h2><p>{{ editingMember.email }} · {{ editingMember.centerUserId ? '已绑定 Login' : '未绑定 Login' }}</p></div><button class="icon-button" aria-label="关闭弹窗" @click="editingMember = null"><AppIcon name="close" /></button></header><label class="form-field"><span>组织角色</span><select v-model="memberDraft.role"><option>成员</option><option>开发者</option><option>财务查看者</option><option>组织管理员</option></select></label><label class="form-field"><span>状态</span><select v-model="memberDraft.status"><template v-if="editingMember.centerUserId"><option>正常</option><option>停用</option></template><template v-else><option>待邀请</option><option>未绑定</option><option>已取消</option></template></select></label><div class="invite-note">{{ editingMember.centerUserId ? '停用后，用户将失去此组织的 Hub 访问权限。' : '未绑定记录不会授予组织访问权限。' }}</div><footer><button class="button secondary" @click="editingMember = null">取消</button><button class="button primary" :disabled="saving" @click="saveMember">{{ saving ? '正在保存…' : '保存成员' }}</button></footer></section></div></Transition>
  </div>
</template>
