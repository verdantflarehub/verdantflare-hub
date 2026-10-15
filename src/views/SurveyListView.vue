<script setup>
import { onMounted, ref, watch } from "vue";
import { controlApi } from "../api/control";
import { surveyDetailPath } from "../api/survey";
import { navigate } from "../router";
import "../survey.css";

const items = ref([]);
const loading = ref(true);
const error = ref("");
const creating = ref(false);
const saving = ref(false);
const createError = ref("");
const name = ref("");
const description = ref("");
const requestId = ref(crypto.randomUUID());
watch([name, description], () => { if (!saving.value) requestId.value = crypto.randomUUID(); });

async function load() {
  loading.value = true;
  error.value = "";
  try { items.value = await controlApi.listSurveys(); }
  catch (cause) { error.value = cause.message; }
  finally { loading.value = false; }
}
async function create() {
  if (saving.value) return;
  saving.value = true;
  createError.value = "";
  try {
    const result = await controlApi.createSurvey({ name: name.value.trim(), description: description.value.trim(), requestId: requestId.value });
    navigate(surveyDetailPath(result.id));
  } catch (cause) { createError.value = cause.message; }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="page survey-admin survey-ui survey-list">
    <header class="survey-admin-head">
      <div><span class="survey-eyebrow">内部运营 / 问卷</span><h1>交流问卷</h1><p class="survey-muted">查看每份问卷的收集状态与反馈；新问卷使用现有的 16 题需求反馈模板。</p></div>
      <button class="button primary" @click="creating = !creating">{{ creating ? '收起创建' : '创建问卷' }}</button>
    </header>
    <form v-if="creating" class="survey-card survey-create" @submit.prevent="create">
      <h2>创建问卷</h2><p class="survey-muted">创建后默认关闭收集，确认内容后再到详情页开放。</p>
      <label class="survey-field">问卷名称<input v-model="name" maxlength="80" minlength="2" required placeholder="例如：云南交流" /></label>
      <label class="survey-field">说明（选填）<textarea v-model="description" maxlength="200" rows="2" placeholder="例如：需求反馈" /></label>
      <p v-if="createError" class="survey-error" role="alert">{{ createError }}</p>
      <div class="survey-actions"><button class="button secondary" type="button" :disabled="saving" @click="creating = false">取消</button><button class="button primary" :disabled="saving" type="submit">{{ saving ? '正在创建…' : '创建并查看详情' }}</button></div>
    </form>
    <p v-if="loading" class="survey-card" role="status">正在读取问卷列表…</p>
    <div v-else-if="error" class="survey-card"><p class="survey-error" role="alert">{{ error }}</p><button class="button secondary" @click="load">重试</button></div>
    <p v-else-if="!items.length" class="survey-card">暂无问卷。点击「创建问卷」开始。</p>
    <div v-else class="survey-list-grid">
      <article v-for="item in items" :key="item.id" class="survey-card survey-list-item">
        <div><span class="survey-eyebrow">{{ item.open ? '收集中' : '已关闭' }}</span><h2>{{ item.name }}</h2><p class="survey-muted">{{ item.description || '需求反馈' }}</p><small class="survey-muted">有效提交 {{ item.total }} 份</small></div>
        <button class="button secondary" @click="navigate(surveyDetailPath(item.id))">查看详情</button>
      </article>
    </div>
  </section>
</template>
