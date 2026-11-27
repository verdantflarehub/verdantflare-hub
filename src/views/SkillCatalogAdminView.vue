<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import McpTokensModal from "../components/McpTokensModal.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";
import { useModal } from "../composables/useModal";
import { formatSize, formatTime, kindLabel, packagesFor, releaseStatusLabel, sourceLabel, visibilityLabel } from "../utils/skillOps.js";

const emit = defineEmits(["toast"]);
const entries = ref([]);
const releases = ref([]);
const currentReleaseId = ref("");
const loading = ref(true);
const error = ref("");
const search = ref("");
const visibilityFilter = ref("全部");
const showMcpTokens = ref(false);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const [skills, releaseList] = await Promise.all([controlApi.listManagedSkills(), controlApi.listSkillReleases()]);
    if (!Array.isArray(skills?.items)) throw new Error("技能目录响应格式不正确");
    entries.value = skills.items;
    releases.value = releaseList?.items || [];
    currentReleaseId.value = releaseList?.currentReleaseId || "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "技能目录加载失败";
  } finally {
    loading.value = false;
  }
};
onMounted(async () => {
  await load();
  // The skill detail page links here with #skill-releases.
  if (window.location.hash === "#skill-releases") document.getElementById("skill-releases")?.scrollIntoView({ block: "start" });
});

const currentRelease = computed(() => releases.value.find((release) => release.releaseId === currentReleaseId.value) || null);
const filteredEntries = computed(() => entries.value.filter((entry) =>
  (visibilityFilter.value === "全部" || visibilityLabel(entry.visibility) === visibilityFilter.value)
  && `${entry.name} ${entry.entryId} ${entry.category}`.toLowerCase().includes(search.value.trim().toLowerCase()),
));
const currentPackages = (entry) => packagesFor(currentRelease.value, entry);

// Publishing goes through the same Control gate as the MCP; a release without
// a source receipt from the skills repository is refused there, not just hidden here.
const releaseBusy = ref(false);
const releaseError = ref("");
const runRelease = async (action, message) => {
  if (releaseBusy.value) return;
  releaseBusy.value = true;
  releaseError.value = "";
  try { await action(); await load(); emit("toast", message); }
  catch (cause) { releaseError.value = cause instanceof Error ? cause.message : "操作失败"; }
  finally { releaseBusy.value = false; }
};
const publishRelease = (release) => {
  if (window.confirm(`发布 ${release.releaseId}？发布后所有组织成员都能在技能市场下载这一版。`)) runRelease(() => controlApi.publishSkillRelease(release.releaseId, release.archiveSha256), `已发布 ${release.releaseId}`);
};
const withdrawRelease = (release) => {
  const reason = window.prompt(`撤回 ${release.releaseId}？撤回后不能再下载，也不能重新发布。请填写撤回原因：`);
  if (reason !== null) runRelease(() => controlApi.withdrawSkillRelease(release.releaseId, release.archiveSha256, reason.trim()), `已撤回 ${release.releaseId}`);
};
const packageCount = (release) => release.files.filter((file) => file.kind === "package").length;
const guideCount = (release) => release.files.filter((file) => file.kind === "guide").length;
const releaseSize = (release) => formatSize(release.files.reduce((sum, file) => sum + (file.size || 0), 0));

const showCreate = ref(false);
const saving = ref(false);
const createError = ref("");
const { dialogRef, closeModal } = useModal(showCreate, saving);
const blankForm = () => ({ entryId: "", name: "", category: "", summary: "", description: "" });
const form = ref(blankForm());
const basicsComplete = computed(() => /^[a-z0-9][a-z0-9-]{1,62}$/.test(form.value.entryId)
  && [...form.value.name].length >= 2 && Boolean(form.value.category && form.value.summary));
const openCreate = () => {
  createError.value = "";
  form.value = blankForm();
  showCreate.value = true;
};
const create = async () => {
  if (saving.value || !basicsComplete.value) return;
  saving.value = true;
  createError.value = "";
  try {
    const entry = await controlApi.createManagedSkill({
      entryId: form.value.entryId,
      name: form.value.name,
      category: form.value.category,
      summary: form.value.summary,
      description: form.value.description || form.value.summary,
      sortOrder: 1000,
    });
    showCreate.value = false;
    emit("toast", "技能资料已保存为草稿；检查资料后可上架");
    navigate(`/ops/skills/${encodeURIComponent(entry.entryId)}`);
  } catch (cause) {
    createError.value = cause instanceof Error ? cause.message : "创建失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page ops-page">
    <header class="page-header"><div><span class="page-overline internal-overline">INTERNAL · SKILL OPERATIONS</span><h1>技能目录</h1><p>管理 Control 中的技能资料、技能发行与成员可下载的当前版本。</p></div><div class="detail-command-actions"><button class="button secondary" @click="showMcpTokens = true"><AppIcon name="key" :size="16" />技能发布 MCP 令牌</button><button class="button primary" @click="openCreate"><AppIcon name="plus" :size="17" />新建技能资料</button></div></header>
    <section v-if="error" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>

    <section class="metric-grid compact"><MetricCard label="技能条目" :value="String(entries.length)" :detail="`单技能 ${entries.filter((entry) => entry.kind !== 'bundle').length} · 能力组合 ${entries.filter((entry) => entry.kind === 'bundle').length}`" icon="playground" tone="mint" /><MetricCard label="已列出" :value="String(entries.filter((entry) => entry.visibility === 'listed').length)" detail="成员可在技能市场看到" icon="market" tone="blue" /><MetricCard label="当前发行" :value="currentReleaseId || '未发布'" :detail="currentReleaseId ? '成员下载的就是这一版' : '等待 MCP 登记并发布'" icon="release" tone="coral" /></section>
    <div class="task-filters release-filters"><button v-for="filter in ['全部', '已列出', '草稿', '隐藏', '已暂停']" :key="filter" :class="{ active: visibilityFilter === filter }" @click="visibilityFilter = filter">{{ filter }}</button><label class="search-field small"><AppIcon name="search" :size="16" /><input v-model="search" placeholder="搜索技能名称或 ID" /></label></div>
    <p v-if="loading">正在加载技能目录…</p>
    <div v-else class="data-table skill-table"><div class="table-head"><span>技能</span><span>类型 / 分类</span><span>当前发行</span><span>更新时间</span><span>目录状态</span><span>操作</span></div><div v-for="entry in filteredEntries" :key="entry.entryId" class="table-row"><span class="table-app-cell"><span class="table-app-icon" aria-hidden="true"><AppIcon :name="entry.kind === 'bundle' ? 'market' : 'playground'" :size="18" /></span><span><strong>{{ entry.name }}</strong><small>{{ entry.entryId }}<template v-if="entry.sample"> · 演示资料</template></small></span></span><span><b>{{ kindLabel(entry.kind) }}</b><small>{{ entry.category }}</small></span><span class="table-state">{{ currentPackages(entry).length ? `${currentReleaseId} · ${currentPackages(entry).length} 个包` : (currentReleaseId ? '当前发行未包含' : '尚无发行') }}</span><span>{{ formatTime(entry.updatedAt) }}</span><StatusBadge :label="visibilityLabel(entry.visibility)" /><button class="table-action" :aria-label="`配置技能 ${entry.name}`" @click="navigate(`/ops/skills/${encodeURIComponent(entry.entryId)}`)">配置<AppIcon name="arrow" :size="15" /></button></div></div>
    <p v-if="!loading && !filteredEntries.length">没有符合条件的技能。</p>

    <section id="skill-releases" class="content-panel candidate-version-panel skill-release-panel" aria-label="技能发行">
      <div class="section-heading"><div><h2>技能发行</h2><p>由技能发布 MCP 从 verdantflare-skills 仓库发布工作流的 Release 登记；Control 核对来源、技能包、依赖和同版指南后成为候选。发布后成员下载的就是这一版。</p></div><span class="candidate-internal-tag">{{ currentReleaseId ? `当前发行 ${currentReleaseId}` : '未发布可下载版本' }}</span></div>
      <div v-if="releaseError" class="ops-note" role="alert"><AppIcon name="warning" :size="18" /><div><strong>发行操作未完成</strong><p>{{ releaseError }}</p></div></div>
      <div v-if="!loading && !releases.length" class="candidate-empty">还没有登记发行。请签发技能发布 MCP 令牌，由 AI 工具调用 <code>skill_publish.register</code> 登记。</div>
      <div v-for="release in releases" :key="release.releaseId" class="candidate-version-card">
        <div class="candidate-version-header">
          <div><strong>{{ release.releaseId }}</strong><span> · {{ packageCount(release) }} 个技能包 · {{ guideCount(release) }} 份指南 · {{ releaseSize(release) }}</span></div>
          <div class="detail-command-actions">
            <StatusBadge :label="release.releaseId === currentReleaseId ? '当前发布' : releaseStatusLabel(release.status)" />
            <button v-if="release.status === 'candidate'" class="button primary" :disabled="releaseBusy || !release.source" :title="release.source ? '' : '没有来源回执，不能发布'" @click="publishRelease(release)">{{ releaseBusy ? '处理中…' : '发布为当前发行' }}</button>
            <button v-if="release.status === 'published'" class="button secondary" :disabled="releaseBusy" @click="withdrawRelease(release)">撤回</button>
          </div>
        </div>
        <p>来源：<span :title="release.source ? `${release.source.repository} ${release.source.tag} ${release.source.commit}` : ''">{{ sourceLabel(release) }}</span><template v-if="release.source"> · 标签 <code>{{ release.source.tag }}</code></template></p>
        <p>发行包 SHA-256：<code>{{ release.archiveSha256 }}</code></p>
        <p>登记 {{ formatTime(release.createdAt) }}<template v-if="release.publishedAt"> · 发布 {{ formatTime(release.publishedAt) }}</template><template v-if="release.withdrawnAt"> · 撤回 {{ formatTime(release.withdrawnAt) }}</template></p>
      </div>
    </section>

    <McpTokensModal v-model="showMcpTokens" purpose="skill_publish" @toast="(message) => emit('toast', message)" />

    <Transition name="modal">
      <dialog v-if="showCreate" ref="dialogRef" class="modal-backdrop" aria-labelledby="create-skill-title" :aria-busy="saving" @cancel.prevent="closeModal" @click.self="closeModal">
        <section class="modal-card invite-modal">
          <header><div><span class="page-overline">NEW SKILL RECORD</span><h2 id="create-skill-title">新建技能资料</h2></div><button class="icon-button" aria-label="关闭弹窗" :disabled="saving" @click="closeModal"><AppIcon name="close" /></button></header>
          <fieldset class="modal-fields" :disabled="saving">
            <p class="candidate-help">第一步填写技能基本信息。星号为创建必填；创建后为草稿，补齐说明再上架。技能包不在这里上传，由技能发布 MCP 从技能仓库登记发行。</p>
            <label class="form-field"><span>技能 ID *（2–63 位小写字母、数字或连字符，与技能包目录名一致）</span><input v-model.trim="form.entryId" autofocus placeholder="例如 verdantflare-storyboard" /></label>
            <label class="form-field"><span>技能名称 *（至少 2 个字符）</span><input v-model.trim="form.name" /></label>
            <label class="form-field"><span>市场分类 *</span><input v-model.trim="form.category" placeholder="例如 视频创作" /></label>
            <label class="form-field"><span>简介 *</span><input v-model.trim="form.summary" placeholder="一句话说明用途" /></label>
            <label class="form-field"><span>说明</span><textarea v-model.trim="form.description" rows="3" placeholder="可稍后补充；留空时先使用简介" /></label>
          </fieldset>
          <p v-if="createError" class="form-error" role="alert">{{ createError }}</p>
          <footer><button class="button secondary" :disabled="saving" @click="closeModal">取消</button><button class="button primary" :disabled="saving || !basicsComplete" @click="create">{{ saving ? '正在保存…' : '创建' }}</button></footer>
        </section>
      </dialog>
    </Transition>
  </div>
</template>

<style scoped>
.skill-table .table-head, .skill-table .table-row { grid-template-columns: 1.35fr .75fr .85fr .8fr .55fr 22px; }
.skill-table b { color: var(--paper); font-size: 9px; }
.skill-table small { display: block; }
.skill-table .table-row > span:nth-child(2) { display: flex; flex-direction: column; gap: 4px; }
.table-app-cell { display: flex !important; flex-direction: row !important; align-items: center; gap: 11px; min-width: 0; }
.table-app-icon { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 7px; background: rgba(244, 241, 232, 0.04); color: var(--paper); }
.skill-release-panel { margin-top: 24px; }
.skill-release-panel .ops-note { margin: 0 0 12px; }
</style>
