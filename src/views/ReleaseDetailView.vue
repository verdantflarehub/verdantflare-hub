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
const versions = ref([]);
const versionsLoading = ref(false);
const versionsError = ref("");
const versionSaving = ref(false);
const versionError = ref("");
const versionForm = ref({ version: "", upstreamVersion: "", publisher: "", sourceUrl: "", sourceRevision: "", licenseId: "", licenseUrl: "", manifest: "", dependencies: "[]", permissions: "[]" });
const loadVersions = async () => {
  versionsLoading.value = true;
  versionsError.value = "";
  try {
    versions.value = await controlApi.listAppVersions(appId.value);
  } catch (cause) {
    versions.value = [];
    versionsError.value = cause instanceof Error ? cause.message : "候选版本加载失败";
  } finally {
    versionsLoading.value = false;
  }
};
const load = async () => {
  loading.value = true;
  error.value = "";
  record.value = null;
  form.value = null;
  versions.value = [];
  try {
    record.value = await controlApi.getManagedApp(appId.value);
    form.value = { ...record.value.app };
    versionForm.value = { version: record.value.app.version || "", upstreamVersion: "", publisher: "", sourceUrl: "", sourceRevision: "", licenseId: "", licenseUrl: "", manifest: "", dependencies: "[]", permissions: "[]" };
    await loadVersions();
  } catch (cause) {
    record.value = null;
    error.value = cause instanceof Error ? cause.message : "应用加载失败";
  } finally {
    loading.value = false;
  }
};
watch(appId, load, { immediate: true });

const readManifestFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 256 * 1024) {
    versionError.value = "Manifest 不能超过 256 KiB";
    return;
  }
  try {
    versionForm.value.manifest = await file.text();
    versionError.value = "";
  } catch {
    versionError.value = "读取 Manifest 文件失败，请重试或粘贴 JSON";
  }
};

const createVersion = async () => {
  versionError.value = "";
  let manifest;
  let dependencies;
  let permissions;
  try {
    manifest = JSON.parse(versionForm.value.manifest);
    dependencies = JSON.parse(versionForm.value.dependencies);
    permissions = JSON.parse(versionForm.value.permissions);
    if (!manifest || Array.isArray(manifest) || typeof manifest !== "object" || !Array.isArray(dependencies) || !Array.isArray(permissions)) throw new Error("格式不正确");
  } catch {
    versionError.value = "请提供有效的 Manifest 对象，以及依赖和权限 JSON 数组";
    return;
  }
  versionSaving.value = true;
  try {
    const result = await controlApi.createAppVersion(appId.value, {
      version: versionForm.value.version.trim(),
      upstreamVersion: versionForm.value.upstreamVersion.trim(),
      publisher: versionForm.value.publisher.trim(),
      sourceUrl: versionForm.value.sourceUrl.trim(),
      sourceRevision: versionForm.value.sourceRevision.trim(),
      licenseId: versionForm.value.licenseId.trim(),
      licenseUrl: versionForm.value.licenseUrl.trim(),
      manifest, dependencies, permissions,
    });
    await loadVersions();
    versionForm.value.version = "";
    versionForm.value.manifest = "";
    emit("toast", `候选版本 ${result.version} 已登记；尚未通过制品审计或 Station 验证`);
  } catch (cause) {
    versionError.value = cause instanceof Error ? cause.message : "候选版本登记失败";
  } finally {
    versionSaving.value = false;
  }
};

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
      developer: form.value.developer || "",
      description: form.value.description || "",
      memory: form.value.memory || "",
      disk: form.value.disk || "",
      cpu: form.value.cpu || "",
      publicIconUrl: form.value.publicIconUrl || "",
      publicVisible: Boolean(form.value.publicVisible) && ["Preview", "Stable"].includes(channel),
    });
    form.value = { ...record.value.app };
    emit("toast", channel === "Preview" ? "应用已加入 Preview 目录；运行状态待 Station 核验" : "应用目录资料已保存");
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
        <div class="detail-command-actions"><StatusBadge :label="record.app.channel === 'Preview' ? '目录预览' : record.release.status" /><button class="button secondary" :disabled="saving" @click="save()">保存更改</button><button class="button primary" :disabled="saving || record.app.channel === 'Preview'" @click="save('Preview')">加入 Preview 目录</button></div>
      </section>

      <div class="detail-two-column release-detail-grid">
        <section class="content-panel manifest-panel">
          <div class="section-heading"><div><h2>应用目录资料</h2><p>这里保存的是 Market 展示内容，不是安装清单或 Station 运行记录。</p></div></div>
          <div class="two-column-form"><label class="form-field"><span>应用名称</span><input v-model.trim="form.name" /></label><label class="form-field"><span>目录展示版本</span><input v-model.trim="form.version" /></label><label class="form-field"><span>分类</span><input v-model.trim="form.category" /></label><label class="form-field"><span>推荐资源</span><input v-model.trim="form.gpu" /></label><label class="form-field"><span>体验时长说明</span><input v-model.trim="form.duration" /></label></div>
          <label class="form-field"><span>简介</span><textarea v-model.trim="form.summary" rows="3" /></label>
          <div class="section-heading"><div><h2>WWW 公开资料</h2><p>只展示手动公开的目录记录；版本与资源需求来自本页落库数据。</p></div></div>
          <div class="two-column-form"><label class="form-field"><span>开发者</span><input v-model.trim="form.developer" /></label><label class="form-field"><span>参考内存</span><input v-model.trim="form.memory" /></label><label class="form-field"><span>参考磁盘</span><input v-model.trim="form.disk" /></label><label class="form-field"><span>参考 CPU</span><input v-model.trim="form.cpu" /></label></div>
          <label class="form-field"><span>公开图标 URL（HTTPS，可选）</span><input v-model.trim="form.publicIconUrl" type="url" /></label>
          <label class="form-field"><span>公开介绍</span><textarea v-model.trim="form.description" rows="3" /></label>
        </section>
        <aside class="content-panel release-controls">
          <div class="section-heading"><div><h2>发布通道</h2><p>Candidate 与 Paused 不向客户展示。</p></div></div>
          <label class="form-field"><span>通道</span><select v-model="form.channel"><option>Candidate</option><option>Preview</option><option :disabled="record.release.validation !== '6 / 6'">Stable</option><option>Paused</option></select></label>
          <label class="form-field"><span>WWW 公开</span><select v-model="form.publicVisible" :disabled="!['Preview', 'Stable'].includes(form.channel)"><option :value="false">不公开</option><option :value="true">公开目录资料</option></select></label>
          <div class="release-warning"><AppIcon name="warning" :size="18" /><span>当前未接入 Station 验证。Preview 只改变 Control 目录与组织可见范围，不部署应用，也不证明应用可运行；Stable 暂不可发布。</span></div>
        </aside>
      </div>

      <section class="content-panel candidate-version-panel">
        <div class="section-heading"><div><h2>内部候选版本</h2><p>每个版本首次提交后不可覆盖；清单摘要用于审阅与追踪，不代表制品已入可信仓库。</p></div><span class="candidate-internal-tag">仅内部可见</span></div>
        <div class="release-warning"><AppIcon name="warning" :size="18" /><span>当前只记录发布者声明及 Manifest。制品下载、签名、Station 同步、预检与安装回报均未接入；这里的版本不能作为客户可安装应用。</span></div>
        <p v-if="versionsLoading" class="candidate-help">正在加载候选版本…</p>
        <div v-if="versionsError" class="ops-note"><AppIcon name="warning" :size="18" /><div><strong>版本记录暂不可用</strong><p>{{ versionsError }}</p></div><button class="button secondary" @click="loadVersions">重试</button></div>
        <div v-if="!versionsLoading && !versionsError && !versions.length" class="candidate-empty">暂无候选版本。应用目录记录本身不包含可安装制品。</div>
        <div v-for="item in versions" :key="item.version" class="candidate-version-card">
          <div class="candidate-version-header"><div><strong>{{ item.version }}</strong><span>· {{ item.publisher }}</span></div><span class="candidate-internal-tag">Center 已登记</span></div>
          <p>Manifest SHA-256 <code>{{ item.manifestSha256 }}</code></p>
          <p>来源 <a :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">{{ item.sourceUrl }}</a> · 许可证 {{ item.licenseId }}</p>
          <p>镜像 {{ item.artifacts?.length || 0 }} · 依赖 {{ item.dependencies?.length || 0 }} · 权限声明 {{ item.permissions?.length || 0 }}</p>
          <div class="candidate-checks"><span v-for="check in item.validation" :key="check.code" :class="`candidate-check-${check.status}`" :title="check.detail">{{ check.code }}：{{ check.status === 'passed' ? '声明校验通过' : check.status === 'declared' ? '待审计' : '待接入' }}</span></div>
          <details class="candidate-version-details"><summary>查看清单解析与证据</summary>
            <dl>
              <div><dt>模板 / 工作负载</dt><dd>{{ item.manifest?.deployment?.template_ref || '未声明' }} / {{ item.manifest?.deployment?.workload_name || '未声明' }}</dd></div>
              <div><dt>资源声明</dt><dd>GPU {{ item.manifest?.required_resources?.gpu ?? '未声明' }} · 磁盘 {{ item.manifest?.required_resources?.disk_bytes ?? '未声明' }} bytes</dd></div>
              <div><dt>能力</dt><dd>{{ item.manifest?.capabilities?.map((entry) => `${entry.capability_id}@${entry.version}`).join('、') || '未声明' }}</dd></div>
              <div><dt>必需模型</dt><dd>{{ item.manifest?.required_models?.map((entry) => `${entry.model_id}@${entry.version}`).join('、') || '无' }}</dd></div>
              <div><dt>入口</dt><dd>{{ item.manifest?.entrypoints?.map((entry) => `${entry.name} · ${entry.protocol} :${entry.port}${entry.path}`).join('、') || '未声明' }}</dd></div>
              <div><dt>镜像摘要</dt><dd><code v-for="artifact in item.artifacts" :key="artifact.component">{{ artifact.component }} · {{ artifact.ref }}<br /></code></dd></div>
              <div><dt>来源 revision</dt><dd><code>{{ item.sourceRevision }}</code></dd></div>
              <div><dt>权限</dt><dd>{{ item.permissions?.map((entry) => `${entry.scope}：${entry.reason}`).join('；') || '未声明' }}</dd></div>
            </dl>
          </details>
        </div>
        <form class="candidate-version-form" @submit.prevent="createVersion">
          <div class="section-heading"><div><h3>登记候选版本</h3><p>请提交固定来源 revision、许可证、版本化镜像摘要和 v1 Manifest。</p></div></div>
          <div class="two-column-form">
            <label class="form-field"><span>版本号 *</span><input v-model.trim="versionForm.version" required placeholder="1.0.0" pattern="[0-9]+\.[0-9]+\.[0-9]+" /></label>
            <label class="form-field"><span>上游版本</span><input v-model.trim="versionForm.upstreamVersion" placeholder="可选" /></label>
            <label class="form-field"><span>发布者 *</span><input v-model.trim="versionForm.publisher" required /></label>
            <label class="form-field"><span>来源 URL（HTTPS）*</span><input v-model.trim="versionForm.sourceUrl" type="url" required placeholder="https://…" /></label>
            <label class="form-field"><span>来源 Git revision（40 位）*</span><input v-model.trim="versionForm.sourceRevision" required minlength="40" maxlength="40" pattern="[a-f0-9]{40}" /></label>
            <label class="form-field"><span>许可证 ID *</span><input v-model.trim="versionForm.licenseId" required placeholder="例如 Apache-2.0" /></label>
            <label class="form-field"><span>许可证 URL（HTTPS）*</span><input v-model.trim="versionForm.licenseUrl" type="url" required placeholder="https://…" /></label>
          </div>
          <label class="form-field"><span>v1 Manifest JSON *</span><textarea v-model="versionForm.manifest" rows="9" required spellcheck="false" placeholder="粘贴应用 Manifest，或选择本地 JSON 文件" /></label>
          <label class="form-field candidate-file-field"><span>从文件读取 Manifest（仅本地读取，不单独上传）</span><input type="file" accept="application/json,.json" @change="readManifestFile" /></label>
          <div class="two-column-form candidate-json-fields"><label class="form-field"><span>依赖证据 JSON 数组</span><textarea v-model="versionForm.dependencies" rows="4" spellcheck="false" /></label><label class="form-field"><span>权限声明 JSON 数组</span><textarea v-model="versionForm.permissions" rows="4" spellcheck="false" /></label></div>
          <p class="candidate-help">必需模型须在依赖数组中声明相同版本的来源、许可证与 SHA-256。镜像须使用固定版本标签及 @sha256 摘要。</p>
          <p v-if="versionError" class="form-error" role="alert">{{ versionError }}</p>
          <button class="button primary" type="submit" :disabled="versionSaving || versionsLoading || Boolean(versionsError)">{{ versionSaving ? '正在登记…' : '登记并冻结版本' }}</button>
        </form>
      </section>

      <section class="content-panel validation-panel"><div class="section-heading"><div><h2>Station 验证</h2><p>尚未接入真实验证结果；Control 中的历史计数不作为部署或运行证明。</p></div><strong>未接入</strong></div></section>
    </template>
  </div>
</template>
