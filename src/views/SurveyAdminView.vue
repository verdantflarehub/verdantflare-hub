<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import { surveyPath } from "../api/survey";
import { surveyPercent } from "../utils/survey";
import "../survey.css";

const stats = ref(null);
const responses = ref(null);
const detail = ref(null);
const loading = ref(true);
const error = ref("");
const detailError = ref("");
const detailLoading = ref(false);
const offset = ref(0);
const settings = ref(null);
const savingSettings = ref(false);
const settingsError = ref("");
const copyMessage = ref("");
const publicLink = new URL(surveyPath, window.location.origin).href;
const pageSize = 20;
const distributions = computed(() => {
  if (!stats.value) return [];
  return stats.value.questions.flatMap((q) => {
    if (!q.options) return [];
    const rows = q.rows || [null];
    return rows.map((row) => ({ key: row ? `${q.id}:${row}` : q.id, title: `${q.id.toUpperCase()} · ${row || q.title}`, data: stats.value.distribution[row ? `${q.id}:${row}` : q.id] }));
  });
});
const days = computed(() => Object.entries(stats.value?.daily || {}).sort(([a], [b]) => a.localeCompare(b)));
const formatDate = (value) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
async function load(nextOffset = 0) {
  if (savingSettings.value) return;
  loading.value = true;
  error.value = "";
  stats.value = null;
  responses.value = null;
  detail.value = null;
  settings.value = null;
  settingsError.value = "";
  try {
    const [summary, list] = await Promise.all([controlApi.getSurveyStats(), controlApi.listSurveyResponses(nextOffset, pageSize)]);
    stats.value = summary;
    settings.value = summary?.settings || null;
    responses.value = list;
    offset.value = nextOffset;
  } catch (cause) { error.value = cause.message; }
  finally { loading.value = false; }
}
async function toggleOpen() {
  if (!settings.value || savingSettings.value) return;
  savingSettings.value = true;
  settingsError.value = "";
  try {
    settings.value = await controlApi.setSurveySettings(!settings.value.open, settings.value.version);
  } catch (cause) {
    settingsError.value = cause.message;
    settings.value = null;
    // A timeout may have committed; read back rather than toggling blindly again.
    try { settings.value = (await controlApi.getSurveyStats())?.settings || null; } catch { /* Explicit unknown state, retry through refresh. */ }
  } finally { savingSettings.value = false; }
}
async function copyLink() {
  try { await navigator.clipboard.writeText(publicLink); copyMessage.value = "填写链接已复制"; }
  catch { copyMessage.value = "无法自动复制，请选中下方链接手动复制"; }
}
async function openDetail(id) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  detailError.value = "";
  detail.value = null;
  try { detail.value = await controlApi.getSurveyResponse(id); }
  catch (cause) { detailError.value = cause.message; }
  finally { detailLoading.value = false; }
}
onMounted(() => load());
</script>

<template>
  <section class="survey-admin survey-ui">
    <header class="survey-admin-head">
      <div><span class="survey-eyebrow">内部运营 / 问卷</span><h1>云南交流 · 需求反馈</h1><p class="survey-muted">仅 VF 内部客户成功管理员可见。小样本不代表行业比例；提交数不等于独立人数。</p></div>
      <div class="survey-actions"><a class="button secondary" :href="surveyPath" target="_blank" rel="noopener">打开填写页</a><button class="button primary" :disabled="loading || savingSettings" @click="load(0)">刷新</button></div>
    </header>
    <p v-if="loading" class="survey-card" role="status">正在读取问卷数据…</p>
    <div v-else-if="error" class="survey-card"><p class="survey-error" role="alert">{{ error }}</p><button class="button secondary" @click="load(0)">重试</button></div>
    <template v-else-if="stats && responses">
      <section class="survey-card" aria-label="问卷开放设置">
        <div class="survey-admin-head">
          <div><h2>开放收集：{{ settings ? (settings.open ? '已开放' : '已关闭') : '状态未知' }}</h2><p class="survey-muted">默认关闭。关闭后立即停止新填写和提交，已收集答卷与统计保留。</p></div>
          <button class="button" :class="settings?.open ? 'secondary' : 'primary'" role="switch" :aria-checked="settings?.open === true" aria-label="开放收集" :disabled="!settings || savingSettings" @click="toggleOpen">{{ savingSettings ? '正在保存…' : (settings?.open ? '关闭收集' : '开放收集') }}</button>
        </div>
        <p v-if="settings?.updatedAt" class="survey-muted">最后调整：{{ formatDate(settings.updatedAt) }} · 设置版本 {{ settings.version }}</p>
        <p v-if="settingsError" class="survey-error" role="alert">{{ settingsError }}</p>
        <label class="survey-field">游客填写链接<input :value="publicLink" readonly @focus="$event.target.select()" /></label>
        <button class="button secondary" @click="copyLink">复制填写链接</button><span v-if="copyMessage" role="status"> {{ copyMessage }}</span>
        <p v-if="settings && !settings.open" class="survey-muted">当前已关闭；访客打开链接不会进入填写表单。</p>
        <p v-else-if="!settings" class="survey-error">无法确认当前开放状态，请刷新后再操作。</p>
      </section>
      <div class="survey-metrics">
        <div class="survey-card"><span>有效提交</span><strong>{{ stats.total }}</strong><small>同一填写会话重复提交只计一份</small></div>
        <div class="survey-card"><span>同意会后联系</span><strong>{{ stats.contactAllowed }}</strong><small>不代表已经填写联系方式</small></div>
        <div class="survey-card"><span>同意匿名引用</span><strong>{{ stats.quoteAllowed }}</strong><small>不含公开姓名或作品授权</small></div>
      </div>
      <p v-if="stats.total === 0" class="survey-card">还没有收到答卷。可将填写页链接发给参与者。</p>
      <template v-else>
        <section class="survey-card"><h2>每日提交</h2><p class="survey-muted">北京时间</p><div class="survey-daily"><span v-for="[date, count] in days" :key="date">{{ date }} · <strong>{{ count }}</strong> 份</span></div></section>
        <section class="survey-card">
          <h2>逐份答卷</h2><p class="survey-muted">共 {{ responses.total }} 份 · 当前 {{ offset + 1 }}—{{ offset + responses.items.length }} 份</p>
          <div class="survey-response-list"><button v-for="item in responses.items" :key="item.id" class="button secondary" :disabled="detailLoading" @click="openDetail(item.id)"><span>{{ item.nickname }} · 查看回答</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time></button></div>
          <div class="survey-actions"><button class="button secondary" :disabled="offset === 0" @click="load(Math.max(0, offset - pageSize))">上一页</button><button class="button secondary" :disabled="offset + pageSize >= responses.total" @click="load(offset + pageSize)">下一页</button></div>
          <p v-if="detailLoading" role="status">正在读取答卷…</p><p v-if="detailError" role="alert" class="survey-error">{{ detailError }}</p>
        </section>
        <section v-if="detail" class="survey-card" aria-label="答卷详情">
          <div class="survey-admin-head"><div><h2>{{ detail.nickname }} 的回答</h2><p class="survey-muted">{{ formatDate(detail.createdAt) }} · 问卷版本 {{ detail.version }}</p></div><button class="button secondary" @click="detail = null">收起</button></div>
          <div v-for="q in stats.questions.filter((q) => q.id !== 'q16')" :key="q.id">
            <h3>{{ q.id.toUpperCase() }} · {{ q.title }}</h3>
            <p v-if="detail.answers[q.id]?.choices?.length">{{ detail.answers[q.id].choices.join('；') }}</p>
            <p v-for="(value, row) in detail.answers[q.id]?.rows || {}" :key="row">{{ row }}：{{ value }}</p>
            <p v-if="detail.answers[q.id]?.text" class="survey-detail-answer">{{ detail.answers[q.id].text }}</p>
            <p v-if="!detail.answers[q.id]?.choices?.length && !Object.keys(detail.answers[q.id]?.rows || {}).length && !detail.answers[q.id]?.text" class="survey-muted">未回答</p>
          </div>
          <h3>Q16 · 使用许可</h3><p>内部分析：同意 · 匿名引用：{{ detail.quote === 'yes' ? '同意' : '不同意' }} · 会后联系：{{ detail.contactPermission === 'yes' ? '同意' : '不同意' }}</p>
          <p v-if="detail.contactPermission === 'yes'" class="survey-detail-answer">联系方式：{{ detail.contact || '未填写' }}</p>
        </section>
        <h2>回答分布</h2><p class="survey-muted">百分比以该题（矩阵题为该行）实际选择人数为分母；多选合计可能超过 100%。文本回答请查看逐份答卷。</p>
        <div class="survey-distributions">
          <section v-for="item in distributions" :key="item.key" class="survey-card"><h3>{{ item.title }}</h3><small class="survey-muted">有效回答 {{ item.data.answered }} 份</small>
            <div v-for="(count, option) in item.data.counts" :key="option" class="survey-distribution-row"><div><span>{{ option }}</span><span>{{ count }} · {{ surveyPercent(count, item.data.answered) }}%</span></div><progress :value="count" :max="Math.max(1, item.data.answered)" :aria-label="`${option}：${count} 份`" /></div>
          </section>
        </div>
      </template>
    </template>
  </section>
</template>
