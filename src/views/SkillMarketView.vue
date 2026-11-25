<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import CatalogCard from "../components/CatalogCard.vue";
import { navigate } from "../router";

const props = defineProps({ path: { type: String, required: true } });
const items = ref([]);
const loading = ref(true);
const error = ref("");
const search = ref("");
const kind = ref("all");
const selectedId = computed(() => {
  if (!props.path.startsWith("/skills/")) return "";
  try { return decodeURIComponent(props.path.slice(8)); }
  catch { return ""; }
});
const selected = computed(() => items.value.find((item) => item.entryId === selectedId.value));
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase();
  return items.value.filter((item) => (kind.value === "all" || item.kind === kind.value)
    && (!query || [item.name, item.summary, item.category, item.entryId].some((value) => String(value || "").toLowerCase().includes(query))));
});
const release = ref(null);
const releaseNote = ref("");
const packages = computed(() => new Map((release.value?.files || []).filter((f) => f.kind === "package").map((f) => [f.skillId, f])));
const guides = computed(() => (release.value?.files || []).filter((f) => f.kind === "guide"));
const fileUrl = (name) => controlApi.skillReleaseFileUrl(release.value.releaseId, name);
const sizeLabel = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
// The skill itself plus every package it requires, in dependency-first order.
const closure = (ids) => {
  const result = [];
  const visit = (id) => {
    const file = packages.value.get(id);
    if (!file || result.includes(file)) return;
    (file.requires || []).forEach(visit);
    result.push(file);
  };
  ids.forEach(visit);
  return result;
};
const downloadsFor = (item) => item ? closure(item.kind === "bundle" ? (item.previewSkillIds || []) : [item.entryId]) : [];
const statusFor = (item) => downloadsFor(item).length ? "可下载" : "尚不可下载";
const loadRelease = async () => {
  try {
    const result = await controlApi.getSkillRelease();
    release.value = result?.available ? result.release : null;
    releaseNote.value = result?.available ? "" : "当前没有已发布的技能版本。";
  } catch (cause) {
    release.value = null;
    releaseNote.value = cause?.status === 403 ? "加入组织后才能下载技能包。" : "技能下载信息暂时无法读取。";
  }
};
const load = async () => {
  loading.value = true;
  error.value = "";
  loadRelease();
  try {
    const result = await controlApi.listSkills();
    if (!Array.isArray(result?.items)) throw new Error("技能目录响应格式不正确");
    items.value = result.items;
  } catch (cause) {
    items.value = [];
    error.value = cause instanceof Error ? cause.message : "技能目录加载失败";
  } finally { loading.value = false; }
};
onMounted(load);
</script>

<template>
  <div class="skills-page">
    <header class="page-header">
      <div>
        <h1>技能市场</h1>
        <p>按创作目标发现能力组合，也可查看单项技能。下载技能包后，按同版安装指南在桌面智能体中加载。</p>
      </div>
    </header>
    <section v-if="release" class="skill-release" aria-label="当前技能版本">
      <div>
        <strong>当前版本 {{ release.releaseId }}</strong>
        <span v-if="release.authentication === 'unsigned'" class="skill-badge">工程候选 · 未签名</span>
        <p>先读安装指南，再下载所需技能包；每个技能会连同它依赖的技能一起列出。</p>
      </div>
      <div class="skill-release-links"><a v-for="file in guides" :key="file.name" class="button secondary" :href="fileUrl(file.name)" :download="file.name">{{ file.name === "Install.md" ? "安装指南" : "技能清单" }}</a></div>
    </section>
    <p v-else-if="releaseNote && !loading" class="skill-release-note">{{ releaseNote }}</p>
    <div v-if="loading" class="skills-feedback" role="status">正在读取技能目录…</div>
    <div v-else-if="error" class="skills-feedback" role="alert"><strong>目录暂时无法加载</strong><p>{{ error }}</p><button class="button secondary" type="button" @click="load">重新加载</button></div>
    <template v-else-if="selectedId">
      <button class="skill-back" type="button" @click="navigate('/skills')">← 返回技能目录</button>
      <article v-if="selected" class="skill-detail">
        <span class="skill-kicker">{{ selected.kind === "bundle" ? "能力组合" : "单技能" }} · {{ selected.category }}<template v-if="selected.sample"> · 演示资料</template></span>
        <h2>{{ selected.name }}</h2>
        <p>{{ selected.description || selected.summary }}</p>
        <div v-if="selected.kind === 'bundle' && selected.previewSkillIds?.length" class="skill-preview"><h3>包含的技能</h3><p>下载时会连同各技能的依赖一起列出。</p><div class="skill-preview-ids"><span v-for="id in selected.previewSkillIds" :key="id">{{ id }}</span></div></div>
        <dl><div><dt>目录 ID</dt><dd>{{ selected.entryId }}</dd></div><div><dt>版本</dt><dd>{{ downloadsFor(selected).length ? release.releaseId : "—" }}</dd></div><div><dt>分发状态</dt><dd>{{ statusFor(selected) }}</dd></div></dl>
        <div v-if="downloadsFor(selected).length" class="skill-downloads">
          <h3>下载技能包</h3>
          <p>需全部下载：{{ downloadsFor(selected).length > 1 ? "包含所需依赖，" : "" }}按安装指南放入桌面智能体的技能目录。</p>
          <ul><li v-for="file in downloadsFor(selected)" :key="file.name"><a :href="fileUrl(file.name)" :download="file.name">{{ file.name }}</a><small>{{ sizeLabel(file.size) }} · SHA-256 {{ file.sha256.slice(0, 12) }}…</small></li></ul>
          <a class="button secondary" :href="fileUrl('Install.md')" download="Install.md">安装指南</a>
        </div>
        <div v-else class="skill-notice">{{ releaseNote || "当前版本没有包含这个条目的技能包。" }}</div>
      </article>
      <div v-else class="skills-feedback">该条目未公开或已从目录移除。<button class="button secondary" type="button" @click="navigate('/skills')">返回目录</button></div>
    </template>
    <template v-else>
      <div class="skill-controls">
        <input v-model="search" type="search" aria-label="搜索技能" placeholder="搜索组合、技能或场景" />
        <div class="skill-tabs" aria-label="技能类型">
          <button v-for="option in [{ value: 'all', label: '全部' }, { value: 'bundle', label: '能力组合' }, { value: 'skill', label: '单技能' }]" :key="option.value" type="button" :aria-pressed="kind === option.value" @click="kind = option.value">{{ option.label }}</button>
        </div>
      </div>
      <div v-if="!items.length" class="skills-feedback">暂无已公开的技能资料。运营人员列出目录条目后，这里会自动显示。</div>
      <div v-else-if="!filtered.length" class="skills-feedback">没有匹配的目录条目，请调整搜索条件。</div>
      <div v-else class="catalog-card-grid">
        <CatalogCard v-for="item in filtered" :key="item.entryId" :title="item.name" :meta="`${item.kind === 'bundle' ? '能力组合' : '单技能'} · ${item.entryId}`" :description="item.summary" icon="playground" :tags="[item.category, item.sample ? '演示资料' : '目录资料']" :status="statusFor(item)" :actions="[{ label: '查看资料', to: `/skills/${encodeURIComponent(item.entryId)}` }]" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.skills-page { min-width: 0; }
.skill-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 22px; }
.skill-controls input { min-width: min(100%, 280px); min-height: 40px; padding: 0 13px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface, #111b15); color: var(--paper); }
.skill-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.skill-tabs button { min-height: 37px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; }
.skill-tabs button[aria-pressed="true"] { border-color: var(--green); color: var(--green); background: rgba(76, 227, 154, .08); }
.skills-feedback { min-height: 150px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); text-align: center; }
.skills-feedback p { margin: 0; }
.skill-back { margin-bottom: 18px; padding: 0; border: 0; background: transparent; color: var(--green); cursor: pointer; }
.skill-detail { max-width: 900px; padding: clamp(22px, 4vw, 42px); border: 1px solid var(--line); border-radius: 12px; background: var(--surface, #111b15); }
.skill-kicker { color: var(--green); font-size: 12px; }
.skill-detail h2 { margin: 12px 0; font-size: clamp(26px, 4vw, 38px); }
.skill-detail p { color: var(--muted-strong); white-space: pre-wrap; line-height: 1.8; }
.skill-preview { margin: 20px 0; }.skill-preview h3 { margin: 0; font-size: 14px; }.skill-preview p { margin: 5px 0 10px; font-size: 12px; }.skill-preview-ids { display: flex; flex-wrap: wrap; gap: 7px; }.skill-preview-ids span { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; font-size: 11px; overflow-wrap: anywhere; }
.skill-detail dl { display: flex; flex-wrap: wrap; gap: 12px; margin: 26px 0; }
.skill-detail dl > div { min-width: 150px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; }
.skill-detail dt { color: var(--muted); font-size: 11px; }
.skill-detail dd { margin: 5px 0 0; overflow-wrap: anywhere; }
.skill-release { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 22px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface, #111b15); }
.skill-release p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
.skill-release-links { display: flex; flex-wrap: wrap; gap: 8px; }
.skill-badge { margin-left: 8px; padding: 3px 7px; border: 1px solid var(--line); border-radius: 6px; color: var(--muted-strong); font-size: 11px; }
.skill-release-note { margin: 0 0 18px; color: var(--muted); font-size: 12px; }
.skill-downloads { margin-top: 8px; }.skill-downloads h3 { margin: 0; font-size: 15px; }.skill-downloads > p { font-size: 12px; }
.skill-downloads ul { margin: 0 0 16px; padding: 0; list-style: none; display: grid; gap: 8px; }
.skill-downloads li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; }
.skill-downloads li a { color: var(--green); overflow-wrap: anywhere; }.skill-downloads li small { color: var(--muted); font-size: 11px; }
.skill-notice { padding: 15px; border: 1px solid var(--line); border-radius: 8px; color: var(--muted); font-size: 12px; }
</style>
