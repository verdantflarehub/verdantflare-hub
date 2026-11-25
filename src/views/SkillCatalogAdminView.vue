<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";

const emit = defineEmits(["toast"]);
const entries = ref([]);
const selectedId = ref("");
const draft = ref(null);
const audit = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const conflict = ref(false);
const query = ref("");
const filtered = computed(() => {
  const term = query.value.trim().toLowerCase();
  return entries.value.filter((entry) => !term || [entry.entryId, entry.name, entry.category].some((value) => String(value || "").toLowerCase().includes(term)));
});
const select = async (entry) => {
  const id = entry.entryId;
  selectedId.value = id;
  draft.value = { ...entry };
  audit.value = [];
  conflict.value = false;
  try {
    const events = (await controlApi.getSkillAudit(id))?.items || [];
    if (selectedId.value === id) audit.value = events;
  }
  catch { /* Audit is supplementary; saving still uses the entry revision. */ }
};
const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const result = await controlApi.listManagedSkills();
    if (!Array.isArray(result?.items)) throw new Error("技能目录响应格式不正确");
    entries.value = result.items;
    const selected = entries.value.find((entry) => entry.entryId === selectedId.value) || entries.value[0];
    if (selected) await select(selected);
    else { selectedId.value = ""; draft.value = null; audit.value = []; }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "技能目录加载失败";
  } finally { loading.value = false; }
};
const save = async () => {
  if (!draft.value || saving.value) return;
  saving.value = true;
  error.value = "";
  conflict.value = false;
  const id = draft.value.entryId;
  try {
    const result = await controlApi.patchManagedSkill(id, {
      name: draft.value.name,
      summary: draft.value.summary,
      description: draft.value.description,
      category: draft.value.category,
      sortOrder: Number(draft.value.sortOrder),
      visibility: draft.value.visibility,
    }, draft.value.revision);
    entries.value = entries.value.map((entry) => entry.entryId === id ? result : entry)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.entryId.localeCompare(b.entryId));
    await select(result);
    emit("toast", "技能目录资料已保存");
  } catch (cause) {
    conflict.value = cause?.status === 409;
    error.value = conflict.value ? "资料已被其他管理员修改，请重新加载后再编辑。" : (cause instanceof Error ? cause.message : "保存失败");
  } finally { saving.value = false; }
};
const releases = ref([]);
const releaseBusy = ref(false);
const releaseError = ref("");
const releaseStatusLabel = (value) => ({ candidate: "待发布", published: "已发布", withdrawn: "已撤回" })[value] || value;
const loadReleases = async () => {
  try { releases.value = (await controlApi.listSkillReleases())?.items || []; }
  catch (cause) { releaseError.value = cause instanceof Error ? cause.message : "发行列表加载失败"; }
};
const runRelease = async (action, message) => {
  if (releaseBusy.value) return;
  releaseBusy.value = true;
  releaseError.value = "";
  try { await action(); await loadReleases(); emit("toast", message); }
  catch (cause) { releaseError.value = cause instanceof Error ? cause.message : "操作失败"; }
  finally { releaseBusy.value = false; }
};
const uploadRelease = (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) runRelease(() => controlApi.uploadSkillRelease(file), "发行包已校验并登记，发布后成员即可下载");
};
const publishRelease = (release) => {
  if (window.confirm(`发布 ${release.releaseId}？发布后所有组织成员都能在技能市场下载这一版。`)) runRelease(() => controlApi.publishSkillRelease(release.releaseId), "已发布");
};
const withdrawRelease = (release) => {
  if (window.confirm(`撤回 ${release.releaseId}？撤回后不能再下载，也不能重新发布。`)) runRelease(() => controlApi.withdrawSkillRelease(release.releaseId), "已撤回");
};
const visibilityLabel = (value) => ({ draft: "草稿", listed: "已列出", hidden: "隐藏", paused: "暂停" })[value] || value;
onMounted(() => { load(); loadReleases(); });
</script>

<template>
  <div class="skill-admin-page">
    <header class="page-header"><div><h1>技能目录</h1><p>维护展示资料、可见范围和成员可下载的技能发行。</p></div></header>
    <section class="skill-admin-panel skill-release-admin" aria-label="技能发行">
      <div class="skill-admin-panel-head">
        <div><h2>技能发行</h2><p>上传 Luna 交付的 vf-hub-skill-input ZIP；Control 校验 11 个技能包、依赖和同版指南的摘要后登记。</p></div>
        <label class="button secondary" :class="{ disabled: releaseBusy }">{{ releaseBusy ? "处理中…" : "上传发行包" }}<input type="file" accept=".zip" hidden :disabled="releaseBusy" @change="uploadRelease" /></label>
      </div>
      <div v-if="releaseError" class="skill-form-error" role="alert">{{ releaseError }}</div>
      <div class="skill-table-wrap"><table><thead><tr><th>版本</th><th>来源</th><th>状态</th><th>文件</th><th>操作</th></tr></thead><tbody>
        <tr v-for="release in releases" :key="release.releaseId"><td><strong>{{ release.releaseId }}</strong><small>{{ new Date(release.createdAt).toLocaleString() }}</small></td><td>{{ release.authentication === "unsigned" ? "工程候选 · 未签名" : release.authentication }}</td><td><span :class="{ positive: release.status === 'published' }">{{ releaseStatusLabel(release.status) }}</span></td><td>{{ release.files.length }} 个</td>
          <td><button v-if="release.status === 'candidate'" type="button" :disabled="releaseBusy" @click="publishRelease(release)">发布</button><button v-if="release.status === 'published'" type="button" :disabled="releaseBusy" @click="withdrawRelease(release)">撤回</button></td></tr>
      </tbody></table></div>
      <p v-if="!releases.length" class="skill-table-empty">还没有登记发行。</p>
    </section>
    <p class="skill-admin-note">目录资料与安装包分开管理。成员在技能市场看到的下载内容，始终是最近一次发布且未撤回的版本。</p>
    <div v-if="loading" class="skill-admin-feedback" role="status">正在读取目录…</div>
    <div v-else-if="error && !draft" class="skill-admin-feedback" role="alert"><p>{{ error }}</p><button class="button secondary" type="button" @click="load">重试</button></div>
    <div v-else class="skill-admin-layout">
      <section class="skill-admin-panel" aria-label="技能目录记录">
        <div class="skill-admin-panel-head"><div><h2>目录记录</h2><p>{{ entries.length }} 条记录 · {{ entries.filter((entry) => entry.sample).length }} 条演示资料</p></div><input v-model="query" type="search" aria-label="搜索目录记录" placeholder="搜索名称或 ID" /></div>
        <div class="skill-table-wrap"><table><thead><tr><th>条目</th><th>分类</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="entry in filtered" :key="entry.entryId" :class="{ selected: selectedId === entry.entryId }"><td><strong>{{ entry.name }}</strong><small>{{ entry.entryId }}<template v-if="entry.sample"> · 演示资料</template></small></td><td>{{ entry.kind === "bundle" ? "能力组合" : "单技能" }}</td><td><span :class="{ positive: entry.visibility === 'listed' }">{{ visibilityLabel(entry.visibility) }}</span></td><td><button type="button" :disabled="saving" @click="select(entry)">配置 →</button></td></tr></tbody></table></div>
        <p v-if="!filtered.length" class="skill-table-empty">没有匹配的目录记录。</p>
      </section>
      <section class="skill-admin-panel skill-editor" aria-label="技能资料配置">
        <div class="skill-admin-panel-head"><div><h2>资料配置</h2><p>按当前修订保存；冲突不会覆盖他人修改。</p></div></div>
        <form v-if="draft" @submit.prevent="save">
          <div class="skill-form-grid"><label class="form-field">目录 ID<input :value="draft.entryId" readonly /></label><label class="form-field">类型<input :value="draft.kind === 'bundle' ? '能力组合' : '单技能'" readonly /></label></div>
          <label class="form-field">名称<input v-model.trim="draft.name" required maxlength="2000" /></label>
          <label class="form-field">简介<input v-model.trim="draft.summary" required maxlength="2000" /></label>
          <label class="form-field">说明<textarea v-model.trim="draft.description" required maxlength="2000" rows="5" /></label>
          <div class="skill-form-grid"><label class="form-field">分类<input v-model.trim="draft.category" required maxlength="2000" /></label><label class="form-field">排序<input v-model.number="draft.sortOrder" type="number" min="0" max="1000000" required /></label></div>
          <label class="form-field">目录可见状态<select v-model="draft.visibility"><option value="draft">草稿</option><option value="listed">已列出</option><option value="hidden">隐藏</option><option value="paused">暂停</option></select></label>
          <p class="skill-form-hint">当前修订 {{ draft.revision }} · {{ draft.sample ? "演示资料" : "目录资料" }}</p>
          <div v-if="error" class="skill-form-error" role="alert"><span>{{ error }}</span><button v-if="conflict" type="button" @click="load">重新加载</button></div>
          <button class="button primary" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存资料" }}</button>
        </form>
        <div v-else class="skill-admin-feedback">请选择目录条目。</div>
        <div v-if="audit.length" class="skill-audit"><h3>最近修改</h3><p v-for="event in audit.slice(0, 5)" :key="`${event.createdAt}:${event.revision}`">修订 {{ event.revision }} · {{ event.action === "create" ? "创建" : "更新" }} · {{ new Date(event.createdAt).toLocaleString() }}</p></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.skill-admin-page { min-width: 0; }
.skill-release-admin { margin-bottom: 16px; }
.skill-release-admin .skill-form-error { margin: 12px 18px 0; }
.skill-release-admin label.disabled { opacity: .6; pointer-events: none; }
.skill-admin-note { margin: 0 0 18px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; color: var(--muted-strong); font-size: 12px; line-height: 1.7; }
.skill-admin-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(330px, .8fr); gap: 16px; align-items: start; }
.skill-admin-panel { min-width: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface, #111b15); overflow: hidden; }
.skill-admin-panel-head { min-height: 70px; padding: 15px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid var(--line); }
.skill-admin-panel-head h2 { margin: 0; font-size: 17px; }
.skill-admin-panel-head p { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
.skill-admin-panel-head input { width: min(220px, 48%); min-height: 36px; padding: 0 11px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--paper); }
.skill-table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 530px; border-collapse: collapse; text-align: left; }
th, td { padding: 13px 15px; border-bottom: 1px solid var(--line); font-size: 12px; vertical-align: middle; }
th { color: var(--muted); font-size: 11px; font-weight: 550; }
td:first-child { max-width: 270px; }
td strong, td small { display: block; overflow-wrap: anywhere; }
td small { margin-top: 3px; color: var(--muted); font-size: 10px; }
td .positive { color: var(--green); }
tr.selected { background: rgba(76, 227, 154, .06); }
td button { border: 0; background: transparent; color: var(--green); white-space: nowrap; cursor: pointer; }
.skill-table-empty { padding: 18px; color: var(--muted); }
.skill-editor form { padding: 18px; display: grid; gap: 14px; }
.skill-editor label { min-width: 0; display: grid; gap: 6px; color: var(--muted-strong); font-size: 11px; }
.skill-editor .form-field + .form-field { margin-top: 0; }
.skill-editor input, .skill-editor textarea, .skill-editor select { width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background-color: var(--surface, #0d140f); color: var(--paper); font: inherit; }
.skill-editor select { padding-right: 42px; }
.skill-editor textarea { resize: vertical; }
.skill-editor input[readonly] { color: var(--muted); }
.skill-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.skill-form-hint { margin: 0; color: var(--muted); font-size: 11px; }
.skill-form-error { padding: 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--paper); font-size: 12px; }
.skill-form-error button { margin-left: 8px; border: 0; background: transparent; color: var(--green); cursor: pointer; }
.skill-editor form > .button { justify-self: start; }
.skill-admin-feedback { min-height: 120px; padding: 28px; display: grid; place-items: center; color: var(--muted); text-align: center; }
.skill-audit { padding: 18px; border-top: 1px solid var(--line); }
.skill-audit h3 { margin: 0 0 9px; font-size: 13px; }
.skill-audit p { margin: 5px 0; color: var(--muted); font-size: 11px; }
@media (max-width: 1120px) { .skill-admin-layout { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .skill-admin-panel-head { align-items: stretch; flex-direction: column; }.skill-admin-panel-head input { width: 100%; }.skill-form-grid { grid-template-columns: 1fr; } }
</style>
