<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";
import { formatSize, formatTime, kindLabel, listingMissing, packagesFor, sourceLabel, visibilityLabel } from "../utils/skillOps.js";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const entryId = computed(() => {
  try { return decodeURIComponent(props.path.split("/").filter(Boolean)[2] || ""); }
  catch { return ""; }
});
const record = ref(null);
const form = ref(null);
const audit = ref([]);
const currentRelease = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const conflict = ref(false);

const editable = (entry) => ({ name: entry.name, summary: entry.summary, description: entry.description, category: entry.category, sortOrder: entry.sortOrder, visibility: entry.visibility });
const loadSupplementary = async (id) => {
  // Audit and release are supplementary; saving relies on the entry revision only.
  const [events, releases] = await Promise.allSettled([controlApi.getSkillAudit(id), controlApi.listSkillReleases()]);
  if (entryId.value !== id) return;
  audit.value = events.status === "fulfilled" ? (events.value?.items || []) : [];
  if (releases.status === "fulfilled") {
    const list = releases.value?.items || [];
    currentRelease.value = list.find((release) => release.releaseId === releases.value?.currentReleaseId) || null;
  }
};
const load = async () => {
  const id = entryId.value;
  if (!id) return;
  loading.value = true;
  error.value = "";
  conflict.value = false;
  try {
    const entry = await controlApi.getManagedSkill(id);
    if (entryId.value !== id) return;
    record.value = entry;
    form.value = editable(entry);
    await loadSupplementary(id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "技能资料加载失败";
  } finally {
    loading.value = false;
  }
};
watch(entryId, () => { record.value = null; form.value = null; audit.value = []; load(); }, { immediate: true });

const missing = computed(() => listingMissing(form.value));
const packages = computed(() => packagesFor(currentRelease.value, record.value));
const memberDownload = computed(() => {
  if (!record.value) return "";
  if (record.value.visibility !== "listed") return `目录状态为“${visibilityLabel(record.value.visibility)}”，成员在技能市场看不到此技能。`;
  if (!currentRelease.value) return "已列出，但还没有发布任何技能发行；成员只能浏览资料，不能下载。";
  if (!packages.value.length) return `已列出，但当前发行 ${currentRelease.value.releaseId} 不含此技能的包；成员只能浏览资料。`;
  return `成员可在技能市场下载 ${currentRelease.value.releaseId} 中的 ${packages.value.length} 个技能包。`;
});

const save = async (visibility) => {
  if (!form.value || saving.value) return;
  saving.value = true;
  error.value = "";
  conflict.value = false;
  const id = record.value.entryId;
  try {
    const updated = await controlApi.patchManagedSkill(id, { ...form.value, sortOrder: Number(form.value.sortOrder), visibility: visibility || form.value.visibility }, record.value.revision);
    record.value = updated;
    form.value = editable(updated);
    await loadSupplementary(id);
    emit("toast", visibility === "listed" ? "技能资料已上架到技能市场" : "技能资料已保存");
  } catch (cause) {
    conflict.value = cause?.status === 409;
    error.value = conflict.value ? "资料已被其他管理员修改，请重新加载后再编辑。" : (cause instanceof Error ? cause.message : "保存失败");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/ops/skills')"><AppIcon name="arrow" :size="16" />返回技能发布</button>
    <p v-if="loading && !record">正在加载技能资料…</p>
    <section v-if="error" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p><p v-if="record && !conflict">已填写内容仍保留，请检查后重新保存。</p></div><button v-if="!record || conflict" class="button secondary" @click="load">重新加载</button></section>
    <template v-if="record && form">
      <section class="detail-command-bar internal-detail">
        <div class="app-large-icon mint"><AppIcon :name="record.kind === 'bundle' ? 'market' : 'playground'" :size="31" /></div>
        <div class="detail-title-copy"><span class="page-overline internal-overline">SKILL RECORD</span><h1>{{ record.name }} · {{ packages.length ? currentRelease.releaseId : '发行待发布' }}</h1><p>技能 ID：<code>{{ record.entryId }}</code> · 修订 <code>rev {{ record.revision }}</code> · {{ kindLabel(record.kind) }}<template v-if="record.sample"> · 演示资料</template></p></div>
        <div class="detail-command-actions"><StatusBadge :label="visibilityLabel(record.visibility)" /><button v-if="record.visibility === 'listed'" class="button secondary" @click="navigate(`/skills/${encodeURIComponent(record.entryId)}`)">查看已上架详情</button><button class="button secondary" :disabled="saving" @click="save()">保存资料</button><button v-if="record.visibility !== 'listed'" class="button primary" :disabled="saving || missing.length > 0" @click="save('listed')">上架技能资料</button></div>
      </section>

      <nav class="release-section-nav" aria-label="技能发布页内导航"><a href="#skill-basics">技能资料</a><a href="#skill-release">技能发行</a><a href="#skill-audit">修改记录</a></nav>

      <section class="content-panel release-readiness-panel">
        <div class="section-heading"><div><h2>发布检查</h2><p>目录资料与技能包分开管理：资料在本页编辑，技能包只来自技能发布 MCP 登记并发布的发行。</p></div></div>
        <div class="readiness-grid"><div><strong>01 · 资料上架</strong><p>{{ missing.length ? `还需填写：${missing.join('、')}` : (record.visibility === 'listed' ? '展示必填项已齐，已在技能市场列出。' : '展示必填项已齐，可上架资料。') }}</p></div><div><strong>02 · 技能发行</strong><p>{{ packages.length ? `当前发行 ${currentRelease.releaseId} 包含此技能（${packages.length} 个包）。` : (currentRelease ? `当前发行 ${currentRelease.releaseId} 不含此技能；需在技能仓库加入后重新登记发行。` : '尚未发布技能发行；由技能发布 MCP 从技能仓库登记后在技能目录页发布。') }}</p></div><div><strong>03 · 成员下载</strong><p>{{ memberDownload }}</p></div></div>
      </section>

      <section id="skill-basics" class="content-panel manifest-panel release-section" tabindex="-1" aria-label="技能目录资料">
        <div class="section-heading"><div><h2>第一步 · 技能目录资料</h2><p>星号字段为资料上架必填；按当前修订保存，冲突不会覆盖他人修改。</p></div></div>
        <fieldset class="skill-fields" :disabled="saving">
          <div class="two-column-form"><label class="form-field"><span>技能名称 *</span><input v-model.trim="form.name" maxlength="2000" /></label><label class="form-field"><span>类型</span><input :value="kindLabel(record.kind)" disabled /></label><label class="form-field"><span>市场分类 *</span><input v-model.trim="form.category" maxlength="2000" /></label><label class="form-field"><span>目录排序（0–1000000）</span><input v-model.number="form.sortOrder" type="number" min="0" max="1000000" /></label><label class="form-field"><span>目录可见状态</span><select v-model="form.visibility"><option value="draft">草稿</option><option value="listed">已列出</option><option value="hidden">隐藏</option><option value="paused">已暂停</option></select></label></div>
          <label class="form-field"><span>一句话简介 *</span><textarea v-model.trim="form.summary" rows="2" maxlength="2000" /></label>
          <label class="form-field"><span>技能说明 *</span><textarea v-model.trim="form.description" rows="5" maxlength="2000" /></label>
        </fieldset>
        <div v-if="record.kind === 'bundle' && record.previewSkillIds?.length" class="candidate-help">包含的技能：<code v-for="id in record.previewSkillIds" :key="id" class="skill-chip">{{ id }}</code></div>
      </section>

      <section id="skill-release" class="content-panel candidate-version-panel release-section" tabindex="-1" aria-label="技能发行">
        <div class="section-heading"><div><h2>第二步 · 技能发行</h2><p>技能包由技能发布 MCP 从 verdantflare-skills 仓库发布工作流的 Release 登记，在技能目录页统一发布或撤回；所有技能共用同一个当前发行。</p></div><span class="candidate-internal-tag">{{ currentRelease ? `当前发行 ${currentRelease.releaseId}` : '未发布可下载版本' }}</span></div>
        <div v-if="!currentRelease" class="candidate-empty">还没有发布技能发行。签发技能发布 MCP 令牌后，由 AI 工具调用 <code>skill_publish.register</code> 登记，再到技能目录页发布。</div>
        <div v-else-if="!packages.length" class="candidate-empty">当前发行 {{ currentRelease.releaseId }} 不含 <code>{{ record.entryId }}</code> 的技能包。请先在技能仓库加入该技能，再由发布工作流生成新发行并登记。</div>
        <div v-for="file in packages" :key="file.name" class="candidate-version-card">
          <div class="candidate-version-header"><div><strong>{{ file.skillId }}</strong><span> · {{ currentRelease.releaseId }} · {{ formatSize(file.size) }}</span></div><StatusBadge label="当前发布" /></div>
          <p>文件：<code>{{ file.name }}</code></p>
          <p>SHA-256：<code>{{ file.sha256 }}</code></p>
          <p>依赖：{{ file.requires?.length ? file.requires.join('、') : '无' }}</p>
          <p>来源：{{ sourceLabel(currentRelease) }} · 发布 {{ formatTime(currentRelease.publishedAt) }}</p>
        </div>
        <div class="detail-command-actions skill-release-link"><button class="button secondary" @click="navigate('/ops/skills#skill-releases')">管理技能发行</button></div>
      </section>

      <section id="skill-audit" class="content-panel release-section" tabindex="-1" aria-label="修改记录">
        <div class="section-heading"><div><h2>修改记录</h2><p>每次保存生成新修订；记录操作者组织与修订号。</p></div></div>
        <div v-if="!audit.length" class="candidate-empty">还没有修改记录。</div>
        <ul v-else class="skill-audit-list"><li v-for="event in audit.slice(0, 10)" :key="`${event.createdAt}:${event.revision}`"><strong>rev {{ event.revision }}</strong><span>{{ event.action === 'create' ? '创建' : '更新' }} · {{ formatTime(event.createdAt) }}</span></li></ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.skill-fields { margin: 0; padding: 0; border: 0; min-width: 0; }
.skill-fields .two-column-form + .form-field { margin-top: 0; }
.skill-fields > .form-field { margin-bottom: 15px; }
.skill-chip { display: inline-block; margin: 0 6px 6px 0; padding: 3px 7px; border: 1px solid var(--line); border-radius: 5px; }
.release-section { margin-top: 20px; }
.skill-release-link { margin-top: 16px; }
.skill-audit-list { margin: 0; padding: 0; list-style: none; }
.skill-audit-list li { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
.skill-audit-list li:first-child { border-top: 0; }
.skill-audit-list strong { min-width: 52px; color: var(--paper); }
</style>
