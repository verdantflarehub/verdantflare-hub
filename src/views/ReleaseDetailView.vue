<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const appId = computed(() => props.path.split("/").filter(Boolean)[2]);
const record = ref(null);
const form = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    record.value = await controlApi.getManagedApp(appId.value);
    form.value = { ...record.value.app };
  } catch (cause) {
    record.value = null;
    error.value = cause instanceof Error ? cause.message : "应用加载失败";
  } finally {
    loading.value = false;
  }
};
watch(appId, load, { immediate: true });

const save = async (channel = form.value.channel) => {
  saving.value = true;
  error.value = "";
  try {
    record.value = await controlApi.updateManagedApp(appId.value, {
      name: form.value.name,
      version: form.value.version,
      category: form.value.category,
      summary: form.value.summary,
      gpu: form.value.gpu,
      duration: form.value.duration,
      icon: form.value.icon,
      tone: form.value.tone,
      channel,
    });
    form.value = { ...record.value.app };
    emit("toast", channel === "Preview" ? "应用已发布到 Preview" : "应用发布资料已保存");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存失败";
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/ops/apps')"><AppIcon name="arrow" :size="16" />返回应用发布</button>
    <p v-if="loading">正在加载应用发布资料…</p>
    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
    <template v-if="record && form">
      <section class="detail-command-bar internal-detail">
        <div class="app-large-icon" :class="record.app.tone"><AppIcon :name="record.app.icon || 'market'" :size="31" /></div>
        <div class="detail-title-copy"><span class="page-overline internal-overline">APP RELEASE</span><h1>{{ record.app.name }} · {{ record.app.version }}</h1><p>应用 ID：<code>{{ record.app.id }}</code> · 已授权 {{ record.release.audience }}</p></div>
        <div class="detail-command-actions"><StatusBadge :label="record.release.status" /><button class="button secondary" :disabled="saving" @click="save()">保存更改</button><button class="button primary" :disabled="saving || record.app.channel === 'Preview'" @click="save('Preview')">发布 Preview</button></div>
      </section>

      <div class="detail-two-column release-detail-grid">
        <section class="content-panel manifest-panel">
          <div class="section-heading"><div><h2>应用资料</h2><p>这里保存的目录资料由客户 Market 读取。</p></div></div>
          <div class="two-column-form"><label class="form-field"><span>应用名称</span><input v-model.trim="form.name" /></label><label class="form-field"><span>版本</span><input v-model.trim="form.version" /></label><label class="form-field"><span>分类</span><input v-model.trim="form.category" /></label><label class="form-field"><span>推荐资源</span><input v-model.trim="form.gpu" /></label><label class="form-field"><span>体验时长说明</span><input v-model.trim="form.duration" /></label></div>
          <label class="form-field"><span>简介</span><textarea v-model.trim="form.summary" rows="3" /></label>
        </section>
        <aside class="content-panel release-controls">
          <div class="section-heading"><div><h2>发布通道</h2><p>Candidate 与 Paused 不向客户展示。</p></div></div>
          <label class="form-field"><span>通道</span><select v-model="form.channel"><option>Candidate</option><option>Preview</option><option :disabled="record.release.validation !== '6 / 6'">Stable</option><option>Paused</option></select></label>
          <div class="release-warning"><AppIcon name="warning" :size="18" /><span>新应用没有 Station 标准验证记录，Stable 需先完成六项验证。客户还需获得组织权益才能看见 Preview 应用。</span></div>
        </aside>
      </div>

      <section class="content-panel validation-panel"><div class="section-heading"><div><h2>标准验证</h2><p>当前记录仅展示已有验证结果；本页面不会伪造验证通过。</p></div><strong>{{ record.release.validation }}</strong></div></section>
    </template>
  </div>
</template>
