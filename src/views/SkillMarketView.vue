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
const load = async () => {
  loading.value = true;
  error.value = "";
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
        <p>按创作目标发现能力组合，也可查看单项技能。目录收录不代表已可下载或连接。</p>
      </div>
    </header>
    <div v-if="loading" class="skills-feedback" role="status">正在读取技能目录…</div>
    <div v-else-if="error" class="skills-feedback" role="alert"><strong>目录暂时无法加载</strong><p>{{ error }}</p><button class="button secondary" type="button" @click="load">重新加载</button></div>
    <template v-else-if="selectedId">
      <button class="skill-back" type="button" @click="navigate('/skills')">← 返回技能目录</button>
      <article v-if="selected" class="skill-detail">
        <span class="skill-kicker">{{ selected.kind === "bundle" ? "能力组合" : "单技能" }} · {{ selected.category }}<template v-if="selected.sample"> · 演示资料</template></span>
        <h2>{{ selected.name }}</h2>
        <p>{{ selected.description || selected.summary }}</p>
        <div v-if="selected.kind === 'bundle' && selected.previewSkillIds?.length" class="skill-preview"><h3>能力组合预览</h3><p>仅供了解组成，不是可安装依赖清单。</p><div class="skill-preview-ids"><span v-for="id in selected.previewSkillIds" :key="id">{{ id }}</span></div></div>
        <dl><div><dt>目录 ID</dt><dd>{{ selected.entryId }}</dd></div><div><dt>目录状态</dt><dd>已列出 · 仅供浏览</dd></div><div><dt>分发状态</dt><dd>尚不可下载</dd></div></dl>
        <div class="skill-notice">{{ selected.sample ? "这是目录演示资料，尚未完成正式资料与制品验收；" : "尚无已验收的固定发行、包摘要及宿主支持证据；" }}这里不提供下载、安装或连接操作。</div>
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
        <CatalogCard v-for="item in filtered" :key="item.entryId" :title="item.name" :meta="`${item.kind === 'bundle' ? '能力组合' : '单技能'} · ${item.entryId}`" :description="item.summary" icon="playground" :tags="[item.category, item.sample ? '演示资料' : '仅供浏览']" status="尚不可下载" :actions="[{ label: '查看资料', to: `/skills/${encodeURIComponent(item.entryId)}` }]" />
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
.skill-notice { padding: 15px; border: 1px solid var(--line); border-radius: 8px; color: var(--muted); font-size: 12px; }
</style>
