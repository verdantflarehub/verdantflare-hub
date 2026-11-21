<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { controlApi } from "../api/control";
import { navigate } from "../router";

const props = defineProps({ path: { type: String, required: true } });
const emit = defineEmits(["toast"]);

const items = ref([]);
const detail = ref(null);
const activeItemIdx = ref(0);
const loading = ref(true);
const error = ref("");
const search = ref("");
const subjectFilter = ref("all");
const layoutFilter = ref("all");
const withdrawing = ref(false);

const subjectLabels = {
  beauty: "美女",
  handsome: "帅哥",
  animal: "动物",
};

const mediaType = computed(() => (props.path.startsWith("/prompts/videos") ? "video" : "image"));
const listBasePath = computed(() => (mediaType.value === "video" ? "/prompts/videos" : "/prompts/images"));
const mediaLabel = computed(() => (mediaType.value === "video" ? "视频" : "图片"));

const selectedId = computed(() => {
  for (const prefix of ["/prompts/images/", "/prompts/videos/", "/resources/"]) {
    if (props.path.startsWith(prefix)) {
      try {
        return decodeURIComponent(props.path.slice(prefix.length)).split("/")[0] || "";
      } catch {
        return "";
      }
    }
  }
  return "";
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const subj = item.subjectCategory || "beauty";
    const isMulti = Number(item.itemCount || 1) > 1;
    if (subjectFilter.value !== "all" && subj !== subjectFilter.value) return false;
    if (layoutFilter.value === "single" && isMulti) return false;
    if (layoutFilter.value === "multi" && !isMulti) return false;
    if (
      q &&
      ![item.title, item.prompt, item.sourceAuthor, item.modelName, item.resourceId, subjectLabels[subj]].some((v) =>
        String(v || "").toLowerCase().includes(q),
      )
    ) {
      return false;
    }
    return true;
  });
});

const detailItems = computed(() => {
  if (!detail.value) return [];
  if (Array.isArray(detail.value.items) && detail.value.items.length > 0) return detail.value.items;
  return [
    {
      itemId: "base",
      stepLabel: "",
      label: detail.value.modelName || "原图",
      engine: detail.value.engine || "",
      modelName: detail.value.modelName || "",
      aspectRatio: detail.value.aspectRatio || "",
      resolution: detail.value.resolution || "",
      editPrompt: "",
      note: "",
      imageUrl: detail.value.imageUrl || controlApi.creativeResourceImageUrl(detail.value.resourceId),
    },
  ];
});

const curItem = computed(() => detailItems.value[activeItemIdx.value] || detailItems.value[0] || null);
const hasMulti = computed(() => detailItems.value.length > 1);
const postKind = computed(() => detail.value?.postKind || "single");

const siblingNav = computed(() => {
  if (!selectedId.value || !items.value.length) return { prev: null, next: null };
  const idx = items.value.findIndex((x) => x.resourceId === selectedId.value);
  return {
    prev: idx > 0 ? items.value[idx - 1] : null,
    next: idx >= 0 && idx < items.value.length - 1 ? items.value[idx + 1] : null,
  };
});

const cardBadge = (item) => {
  const count = Number(item.itemCount || 1);
  if (item.mediaType === "video") {
    return count > 1 ? { text: `▶ ${count} 段`, cls: "badge-video" } : { text: "▶ 视频", cls: "badge-video" };
  }
  if (count > 1) return { text: `${count} 图`, cls: "badge-multi" };
  return null;
};

const load = async () => {
  loading.value = true;
  error.value = "";
  activeItemIdx.value = 0;
  try {
    const listRes = await controlApi.listCreativeResources({ mediaType: mediaType.value });
    items.value = Array.isArray(listRes?.items) ? listRes.items : [];
    if (selectedId.value) {
      detail.value = await controlApi.getCreativeResource(selectedId.value);
    } else {
      detail.value = null;
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "灵感资产加载失败";
  } finally {
    loading.value = false;
  }
};

const stepItem = (delta) => {
  const len = detailItems.value.length;
  if (len <= 1) return;
  activeItemIdx.value = (activeItemIdx.value + delta + len) % len;
};

const onKeydown = (e) => {
  if (!selectedId.value || !hasMulti.value) return;
  if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === "ArrowLeft") stepItem(-1);
  if (e.key === "ArrowRight") stepItem(1);
};

const copyText = async (text, label = "提示词") => {
  try {
    await navigator.clipboard.writeText(text || "");
    emit("toast", `${label}已复制到剪贴板`);
  } catch {
    emit("toast", "复制失败，请手动选中复制");
  }
};

const deleteCurrentItem = async () => {
  if (!detail.value || !curItem.value) return;
  const label = curItem.value.stepLabel || curItem.value.label || `第 ${activeItemIdx.value + 1} 张`;
  if (!window.confirm(`确认删除当前这一张图（${label}）吗？系列中的其余图片会保留。`)) return;
  withdrawing.value = true;
  try {
    const res = await controlApi.deleteCreativeResourceItem(detail.value.resourceId, curItem.value.itemId);
    if (res?.withdrawn) {
      emit("toast", "最后一张图已删除，作品已撤回");
      navigate(listBasePath.value);
      return;
    }
    if (res?.resource) {
      detail.value = res.resource;
      const nextLen = (res.resource.items || []).length;
      if (activeItemIdx.value >= nextLen) {
        activeItemIdx.value = Math.max(0, nextLen - 1);
      }
      // Keep list cache itemCount in sync
      const idx = items.value.findIndex((x) => x.resourceId === detail.value.resourceId);
      if (idx >= 0) {
        items.value[idx] = { ...items.value[idx], itemCount: Math.max(1, nextLen) };
      }
    }
    emit("toast", "当前图片已删除");
  } catch (cause) {
    emit("toast", cause instanceof Error ? cause.message : "删除失败");
  } finally {
    withdrawing.value = false;
  }
};

const withdraw = async (id) => {
  const msg = hasMulti.value
    ? `确认撤回整组作品（共 ${detailItems.value.length} 张图）吗？如只想删当前这一张，请点「删除当前图」。`
    : "确认撤回该作品吗？撤回后将从灵感资产列表中隐藏。";
  if (!window.confirm(msg)) return;
  withdrawing.value = true;
  try {
    await controlApi.withdrawCreativeResource(id);
    emit("toast", "作品已撤回");
    navigate(listBasePath.value);
  } catch (cause) {
    emit("toast", cause instanceof Error ? cause.message : "撤回失败");
  } finally {
    withdrawing.value = false;
  }
};

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("zh-CN", { hour12: false });
};

watch(() => props.path, load);
onMounted(() => {
  load();
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="gallery-page" :class="{ 'is-detail': Boolean(selectedId) }">
    <!-- Unified Breadcrumb Bar -->
    <header class="vf-breadcrumb-bar">
      <nav class="vf-breadcrumbs" aria-label="面包屑导航">
        <button type="button" @click="navigate('/')">工作空间</button>
        <span class="sep">/</span>
        <button v-if="selectedId" type="button" @click="navigate(listBasePath)">{{ mediaLabel }}</button>
        <span v-else class="crumb-current">{{ mediaLabel }}</span>
        <template v-if="selectedId && detail">
          <span class="sep">/</span>
          <span class="crumb-current">{{ detail.title }}</span>
        </template>
      </nav>
      <div class="vf-crumb-actions">
        <template v-if="selectedId">
          <button
            class="g-btn"
            type="button"
            :disabled="!siblingNav.prev"
            @click="siblingNav.prev && navigate(`${listBasePath}/${encodeURIComponent(siblingNav.prev.resourceId)}`)"
          >
            ← 上一组
          </button>
          <button
            class="g-btn"
            type="button"
            :disabled="!siblingNav.next"
            @click="siblingNav.next && navigate(`${listBasePath}/${encodeURIComponent(siblingNav.next.resourceId)}`)"
          >
            下一组 →
          </button>
          <button class="g-btn" type="button" @click="navigate(listBasePath)">返回列表</button>
        </template>
        <span v-else class="crumb-count">共 {{ filtered.length }} 组沉淀</span>
      </div>
    </header>

    <div class="gallery-body">
      <div v-if="loading" class="g-feedback" role="status">正在加载{{ mediaLabel }}灵感资产…</div>
      <div v-else-if="error" class="g-feedback" role="alert">
        <strong>暂时无法加载</strong>
        <p>{{ error }}</p>
        <div class="g-feedback-actions">
          <button class="g-btn" type="button" @click="load">重试</button>
          <button v-if="selectedId" class="g-btn" type="button" @click="navigate(listBasePath)">返回列表</button>
        </div>
      </div>

      <!-- Detail View (Always 1 Full High-Res Image in Main Canvas) -->
      <template v-else-if="selectedId && detail && curItem">
        <div class="detail-layout">
          <section class="stage-card">
            <div class="stage-toolbar">
              <div class="stage-title-wrap">
                <span class="tag-chip green">{{ subjectLabels[detail.subjectCategory] || "美女" }}</span>
                <span class="tag-chip" :class="hasMulti ? 'blue' : ''">{{ hasMulti ? `多图 · ${detailItems.length} 张` : "单图" }}</span>
                <h2>{{ detail.title }}</h2>
              </div>
              <span class="stage-submeta">
                <template v-if="hasMulti">
                  {{ curItem.stepLabel ? `${curItem.stepLabel} · ${curItem.label}` : curItem.label }}（{{ activeItemIdx + 1 }} / {{ detailItems.length }}）
                </template>
                <template v-else>
                  {{ curItem.modelName || curItem.label }}<template v-if="curItem.aspectRatio"> · {{ curItem.aspectRatio }}</template>
                </template>
              </span>
            </div>

            <div class="stage-canvas">
              <button v-if="hasMulti" class="stage-nav-btn prev" type="button" aria-label="上一张" @click="stepItem(-1)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <a :href="curItem.imageUrl" target="_blank" rel="noreferrer" title="点击新窗口查看原图" class="stage-img-link">
                <img class="stage-single-img" :src="curItem.imageUrl" :alt="detail.title" />
              </a>
              <button v-if="hasMulti" class="stage-nav-btn next" type="button" aria-label="下一张" @click="stepItem(1)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div v-if="hasMulti" class="stage-counter">
                {{ activeItemIdx + 1 }} / {{ detailItems.length }} · {{ curItem.stepLabel || curItem.label }}
              </div>
            </div>

            <!-- Filmstrip ONLY for multi-item compare/edit posts -->
            <div v-if="hasMulti" class="filmstrip">
              <button
                v-for="(it, idx) in detailItems"
                :key="it.itemId"
                type="button"
                class="thumb-item"
                :class="{ active: idx === activeItemIdx }"
                @click="activeItemIdx = idx"
              >
                <img :src="it.imageUrl" :alt="it.label" loading="lazy" />
                <div class="thumb-meta">
                  <strong>{{ it.stepLabel || it.label }}</strong>
                  <span>{{ postKind === "edit" ? it.label : (it.resolution || it.aspectRatio || it.modelName) }}</span>
                </div>
              </button>
            </div>
          </section>

          <!-- Right Generation Data Column -->
          <aside class="info-col">
            <div v-if="curItem.editPrompt" class="info-card edit-highlight">
              <div class="info-head">
                <h3>{{ curItem.stepLabel || curItem.label || "当前图" }} · 编辑指令</h3>
                <button class="g-btn primary small" type="button" @click="copyText(curItem.editPrompt, '编辑指令')">复制 Edit 词</button>
              </div>
              <pre class="prompt-box">{{ curItem.editPrompt }}</pre>
            </div>

            <div class="info-card">
              <div class="info-head">
                <h3>{{ curItem.editPrompt ? "基准提示词" : "提示词" }}</h3>
                <button class="g-btn primary small" type="button" @click="copyText((detail.prompt || '').trim(), '提示词')">一键复制</button>
              </div>
              <pre class="prompt-box" :class="{ compact: Boolean(curItem.editPrompt) }">{{ (detail.prompt || "").trim() }}</pre>
              <div v-if="curItem.note" class="item-note">点评：{{ curItem.note }}</div>
            </div>

            <div class="info-card">
              <div class="info-head">
                <h3>参数</h3>
                <span class="tag-chip">{{ detail.promptOrigin === "adapted" ? "二次改编" : "原帖提取" }}</span>
              </div>
              <div class="param-grid">
                <div class="param-cell"><small>模型</small><strong>{{ curItem.modelName || detail.modelName || "—" }}</strong></div>
                <div class="param-cell"><small>引擎 / 渠道</small><strong>{{ curItem.engine || detail.engine || "codex" }}</strong></div>
                <div class="param-cell"><small>画幅</small><strong>{{ curItem.aspectRatio || detail.aspectRatio || "—" }}</strong></div>
                <div class="param-cell"><small>分辨率 / 版本</small><strong>{{ curItem.resolution || `v${detail.revision}` }}</strong></div>
              </div>
            </div>

            <div class="info-card">
              <div class="info-head"><h3>溯源</h3></div>
              <div class="source-list">
                <div v-if="detail.sourceAuthor" class="source-row"><span>作者</span><strong>{{ detail.sourceAuthor }}</strong></div>
                <div v-if="detail.sourceUrl" class="source-row">
                  <span>原帖</span>
                  <a :href="detail.sourceUrl" target="_blank" rel="noreferrer">{{ detail.sourceUrl }}</a>
                </div>
                <div class="source-row"><span>时间</span><strong>{{ formatDate(detail.createdAt) }}</strong></div>
              </div>
              <div class="action-row">
                <a class="g-btn" :href="curItem.imageUrl" :download="`${detail.resourceId}.png`">下载原图</a>
                <button
                  v-if="hasMulti"
                  class="g-btn danger"
                  type="button"
                  :disabled="withdrawing"
                  @click="deleteCurrentItem"
                >
                  {{ withdrawing ? "处理中…" : "删除当前图" }}
                </button>
                <button class="g-btn danger" type="button" :disabled="withdrawing" @click="withdraw(detail.resourceId)">
                  {{ withdrawing ? "撤回中…" : (hasMulti ? "撤回整组" : "撤回作品") }}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </template>

      <!-- List View (Civitai Masonry Waterfall) -->
      <template v-else>
        <div class="filter-bar">
          <div class="filter-left">
            <input v-model="search" class="search-input" type="search" aria-label="搜索作品" placeholder="搜索标题、提示词或作者…" />
            <button type="button" class="pill" :class="{ active: subjectFilter === 'all' }" @click="subjectFilter = 'all'">全部</button>
            <button type="button" class="pill" :class="{ active: subjectFilter === 'beauty' }" @click="subjectFilter = 'beauty'">美女</button>
            <button type="button" class="pill" :class="{ active: subjectFilter === 'handsome' }" @click="subjectFilter = 'handsome'">帅哥</button>
            <button type="button" class="pill" :class="{ active: subjectFilter === 'animal' }" @click="subjectFilter = 'animal'">动物</button>
            <span class="filter-sep" />
            <button type="button" class="pill" :class="{ active: layoutFilter === 'all' }" @click="layoutFilter = 'all'">全部形态</button>
            <button type="button" class="pill" :class="{ active: layoutFilter === 'single' }" @click="layoutFilter = 'single'">单图</button>
            <button type="button" class="pill" :class="{ active: layoutFilter === 'multi' }" @click="layoutFilter = 'multi'">多图</button>
          </div>
        </div>

        <div v-if="!items.length" class="g-feedback">
          暂无已沉淀的{{ mediaLabel }}作品。通过个人助理生成并确认发布后，这里会以瀑布流自动展示。
        </div>
        <div v-else-if="!filtered.length" class="g-feedback">没有匹配的作品，请调整筛选条件。</div>
        <div v-else class="masonry">
          <article
            v-for="item in filtered"
            :key="item.resourceId"
            class="m-card"
            @click="navigate(`${listBasePath}/${encodeURIComponent(item.resourceId)}`)"
          >
            <div class="m-media">
              <img :src="item.imageUrl || controlApi.creativeResourceImageUrl(item.resourceId)" :alt="item.title" loading="lazy" />
              <div class="m-top-badges">
                <span class="kind-badge badge-subj">{{ subjectLabels[item.subjectCategory] || "美女" }}</span>
                <span v-if="cardBadge(item)" class="kind-badge" :class="cardBadge(item).cls">{{ cardBadge(item).text }}</span>
              </div>
              <div class="m-bottom-overlay">
                <h3 class="m-title">{{ item.title }}</h3>
                <div class="m-sub">
                  <span>{{ item.modelName || mediaLabel }}<template v-if="item.aspectRatio"> · {{ item.aspectRatio }}</template></span>
                  <span>{{ item.sourceAuthor || "" }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
.hub-main:has(.gallery-page) {
  padding: 0 !important;
}
.hub-main:has(.gallery-page.is-detail) {
  height: 100vh;
  overflow: hidden;
}
</style>

<style scoped>
.gallery-page { min-width: 0; display: flex; flex-direction: column; width: 100%; }
.gallery-page.is-detail { height: 100vh; overflow: hidden; }

/* Unified Breadcrumb Bar */
.vf-breadcrumb-bar {
  position: sticky; top: 0; z-index: 20; flex: 0 0 auto;
  min-height: 52px; padding: 8px 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
}
.vf-breadcrumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); min-width: 0; }
.vf-breadcrumbs button {
  border: 0; background: transparent; color: var(--muted); cursor: pointer;
  padding: 3px 6px; border-radius: 6px; font-size: 13px; font-weight: 500;
}
.vf-breadcrumbs button:hover { color: var(--green); background: rgba(8, 126, 96, .08); }
.vf-breadcrumbs .sep { color: var(--line-strong, var(--line)); font-weight: 700; }
.vf-breadcrumbs .crumb-current { color: var(--paper); font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 480px; }
.vf-crumb-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.crumb-count { font-size: 12px; color: var(--muted); }

.gallery-body { padding: 16px 24px 32px; width: 100%; max-width: none; }
.gallery-page.is-detail .gallery-body {
  flex: 1; min-height: 0; padding: 14px 20px; display: flex; overflow: hidden;
}

/* Buttons */
.g-btn {
  height: 34px; padding: 0 13px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  border: 1px solid var(--line-strong, var(--line)); background: var(--panel); color: var(--paper);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  text-decoration: none; transition: border-color .14s, color .14s, background .14s;
}
.g-btn:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
.g-btn:disabled { opacity: .42; cursor: not-allowed; }
.g-btn.primary { background: var(--green); border-color: var(--green); color: #fff; }
.g-btn.primary:hover { filter: brightness(1.06); color: #fff; }
.g-btn.small { height: 28px; padding: 0 10px; font-size: 12px; }
.g-btn.danger { color: var(--coral, #d1434f); border-color: rgba(209, 67, 79, .38); }
.g-btn.danger:hover { border-color: var(--coral, #d1434f); background: rgba(209, 67, 79, .08); color: var(--coral, #d1434f); }

/* Filter Bar */
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.filter-left { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.search-input {
  height: 36px; width: min(100%, 270px); padding: 0 12px;
  border: 1px solid var(--line-strong, var(--line)); border-radius: 8px;
  background: var(--panel); color: var(--paper); font-size: 13px;
}
.pill {
  height: 32px; padding: 0 13px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--panel); color: var(--muted);
  font-size: 12.5px; font-weight: 500; cursor: pointer;
}
.pill:hover { color: var(--paper); border-color: var(--line-strong, var(--line)); }
.pill.active { border-color: var(--green); color: var(--green); background: rgba(8, 126, 96, .1); font-weight: 650; }

/* Masonry Waterfall */
.masonry { column-count: 4; column-gap: 16px; }
@media (min-width: 1880px) { .masonry { column-count: 5; } }
@media (min-width: 2400px) { .masonry { column-count: 6; } }
@media (max-width: 1360px) { .masonry { column-count: 3; } }
@media (max-width: 900px) { .masonry { column-count: 2; } }
@media (max-width: 560px) { .masonry { column-count: 1; } }

.m-card {
  break-inside: avoid; margin-bottom: 16px;
  border-radius: 12px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgba(16, 24, 20, .06);
  cursor: pointer; position: relative;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.m-card:hover { transform: translateY(-3px); border-color: var(--green); box-shadow: 0 12px 28px rgba(16, 24, 20, .14); }
.m-media { position: relative; width: 100%; background: #141a17; min-height: 180px; }
.m-media img { width: 100%; height: auto; display: block; }
.m-top-badges { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; pointer-events: none; }
.filter-sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
.kind-badge { padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 650; color: #fff; backdrop-filter: blur(8px); }
.badge-subj { background: rgba(16, 24, 20, .72); }
.badge-multi { background: rgba(37, 99, 235, .88); }
.badge-video { background: rgba(16, 185, 129, .9); }
.m-bottom-overlay {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 36px 12px 11px;
  background: linear-gradient(to top, rgba(8, 12, 10, .86) 0%, rgba(8, 12, 10, .35) 60%, transparent 100%);
  color: #fff;
}
.m-title { margin: 0 0 4px; font-size: 13.5px; font-weight: 650; line-height: 1.35; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
.m-sub { font-size: 11.5px; color: rgba(255,255,255,.84); display: flex; justify-content: space-between; gap: 8px; }

/* Detail Layout */
.detail-layout { flex: 1; min-height: 0; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 18px; align-items: stretch; }
@media (max-width: 1080px) {
  .gallery-page.is-detail { height: auto; overflow: visible; }
  .gallery-page.is-detail .gallery-body { overflow: visible; }
  .detail-layout { grid-template-columns: 1fr; }
}

.stage-card {
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
  box-shadow: 0 6px 24px rgba(16, 24, 20, .06);
}
.stage-toolbar {
  flex: 0 0 auto;
  padding: 10px 16px; border-bottom: 1px solid var(--line);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
}
.stage-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stage-title-wrap h2 { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stage-submeta { font-size: 12px; color: var(--muted); font-weight: 600; }

.stage-canvas {
  flex: 1; min-height: 0; overflow: hidden;
  background: #101513; padding: 14px;
  display: flex; align-items: center; justify-content: center; position: relative;
}
.stage-img-link { height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; }
.stage-single-img { max-height: 100%; max-width: 100%; width: auto; height: auto; object-fit: contain; border-radius: 8px; box-shadow: 0 12px 36px rgba(0,0,0,.45); display: block; }
.stage-nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 40px; height: 40px; padding: 0; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22); background: rgba(12, 18, 15, .74); color: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px); line-height: 0;
}
.stage-nav-btn svg { display: block; flex: none; }
.stage-nav-btn:hover { background: var(--green); border-color: var(--green); }
.stage-nav-btn.prev { left: 16px; }
.stage-nav-btn.next { right: 16px; }
.stage-counter {
  position: absolute; bottom: 14px; right: 16px;
  padding: 4px 10px; border-radius: 999px; background: rgba(12, 18, 15, .78); color: #edf5f0;
  font-size: 12px; font-weight: 600;
}

.filmstrip {
  padding: 12px 16px; border-top: 1px solid var(--line); background: var(--panel-raised);
  display: flex; gap: 10px; overflow-x: auto;
}
.thumb-item {
  flex: 0 0 auto; width: 126px; padding: 0; text-align: left;
  border: 2px solid transparent; border-radius: 9px; background: var(--panel);
  overflow: hidden; cursor: pointer; display: flex; flex-direction: column;
}
.thumb-item.active { border-color: var(--green); }
.thumb-item img { width: 100%; height: 88px; object-fit: cover; display: block; }
.thumb-meta { padding: 6px 8px; font-size: 11px; line-height: 1.3; }
.thumb-meta strong { display: block; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.thumb-meta span { color: var(--muted); font-size: 10.5px; }

/* Right Info Column (strictly follows Hub Light/Dark CSS vars) */
.info-col { height: 100%; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.info-card {
  background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
  padding: 13px 14px; box-shadow: 0 4px 16px rgba(16, 24, 20, .05);
}
.info-card.edit-highlight { border-color: var(--violet, #7c3aed); }
.info-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.info-head h3 { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--paper); }

.tag-chip { font-size: 11px; font-weight: 650; padding: 2px 9px; border-radius: 999px; background: var(--panel-raised); color: var(--muted); }
.tag-chip.green { background: rgba(8, 126, 96, .12); color: var(--green); }
.tag-chip.blue { background: rgba(37, 99, 235, .12); color: var(--blue, #2563eb); }
.tag-chip.violet { background: rgba(124, 58, 237, .12); color: var(--violet, #7c3aed); }

.prompt-box {
  margin: 0; background: var(--panel-raised); border: 1px solid var(--line); border-radius: 8px;
  padding: 10px 12px; font-family: inherit; font-size: 12.5px; line-height: 1.62; color: var(--paper);
  white-space: pre-wrap; word-break: break-word;
}
.prompt-box.compact { font-size: 12.5px; color: var(--muted-strong, var(--muted)); }
.item-note { margin-top: 10px; font-size: 12px; color: var(--green); background: rgba(8, 126, 96, .08); padding: 8px 10px; border-radius: 8px; }

.param-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.param-cell { background: var(--panel-raised); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.param-cell small { display: block; font-size: 10.5px; color: var(--muted); margin-bottom: 2px; }
.param-cell strong { font-size: 12.5px; color: var(--paper); word-break: break-word; }

.source-list { display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; }
.source-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.source-row span { color: var(--muted); flex-shrink: 0; }
.source-row strong { color: var(--paper); }
.source-row a { color: var(--green); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-row code { font-size: 11.5px; color: var(--paper); background: var(--panel-raised); padding: 2px 6px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-row { display: flex; gap: 8px; margin-top: 12px; }
.action-row .g-btn { flex: 1; }

.g-feedback {
  min-height: 180px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--muted); text-align: center;
}
.g-feedback-actions { display: flex; gap: 10px; }
</style>
