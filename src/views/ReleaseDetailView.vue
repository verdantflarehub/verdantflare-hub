<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate, replace } from "../router";
import {
  buildOciVersionPayload,
  defaultChartOciRef,
  formatChartCompatibility,
  hasVerifiedOciChartVersion,
} from "../utils/marketReleaseV2";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const appId = computed(() => props.path.split("/").filter(Boolean)[2]);
const record = ref(null);
const form = ref(null);
const screenshotsText = ref("");
const highlightsText = ref("");
const permissionsText = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const versions = ref([]);
const versionsLoading = ref(false);
const versionsError = ref("");
const versionSaving = ref(false);
const versionError = ref("");
const ociSaving = ref(false);
const ociError = ref("");
const releaseSelecting = ref(false);
const chartFile = ref(null);
const chartAudit = ref(null);
const chartAuditError = ref("");
const chartAuditing = ref(false);
const auditedFileName = ref("");
let chartRequest = 0;

const ociForm = ref({
  version: "",
  ociRef: "",
  chartVersion: "",
  manifestDigest: "",
  packageDigest: "",
  releaseNotes: "",
  sourceRevision: "",
});
const versionForm = ref({ version: "", upstreamVersion: "", publisher: "", sourceUrl: "", sourceRevision: "", licenseId: "", licenseUrl: "", manifest: "", dependencies: "[]", permissions: "[]" });
const grants = ref([]);
const grantsLoading = ref(false);
const grantsError = ref("");
const grantSaving = ref(false);
const nextWeekLocal = () => {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
};
const grantForm = ref({ version: "", stationId: "", certificateSha256: "", expiresAt: nextWeekLocal() });
const grantActive = (grant) => !grant.revoked && new Date(grant.expiresAt).getTime() > Date.now();

const ociVersions = computed(() => versions.value.filter((item) => Boolean(item?.chart)));
const legacyVersions = computed(() => versions.value.filter((item) => !item?.chart));
const hasVerifiedOciVersion = computed(() => hasVerifiedOciChartVersion(versions.value));

const loadGrants = async () => {
  grantsLoading.value = true;
  grantsError.value = "";
  try {
    grants.value = await controlApi.listStationTestGrants(appId.value);
  } catch (cause) {
    grants.value = [];
    grantsError.value = cause instanceof Error ? cause.message : "内部设备授权加载失败";
  } finally {
    grantsLoading.value = false;
  }
};
const loadVersions = async () => {
  versionsLoading.value = true;
  versionsError.value = "";
  try {
    const res = await controlApi.listAppVersionsV2(appId.value);
    versions.value = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
  } catch (cause) {
    versions.value = [];
    versionsError.value = cause instanceof Error ? cause.message : "版本记录加载失败";
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
  grants.value = [];
  chartFile.value = null;
  chartAudit.value = null;
  chartAuditError.value = "";
  auditedFileName.value = "";
  ociError.value = "";
  chartRequest += 1;
  chartAuditing.value = false;
  try {
    const legacyId = { "blender-mcp": "blender", "music-mcp-server": "music-mcp", "video-mcp-server": "video-mcp" }[appId.value];
    if (legacyId) {
      try {
        await controlApi.getManagedApp(legacyId);
        replace(`/ops/apps/${legacyId}/releases${window.location.search}${window.location.hash}`);
        return;
      } catch {
        // The old record remains usable until the catalog migration is applied.
      }
    }
    record.value = await controlApi.getManagedApp(appId.value);
    form.value = { ...record.value.app, showcase: { screenshots: [], highlights: [], permissions: [], ...record.value.app.showcase } };
    screenshotsText.value = (form.value.showcase?.screenshots || []).join("\n");
    highlightsText.value = (form.value.showcase?.highlights || []).join("\n");
    permissionsText.value = (form.value.showcase?.permissions || []).join("\n");
    ociForm.value = {
      version: "",
      ociRef: defaultChartOciRef(record.value.app.id),
      chartVersion: "",
      manifestDigest: "",
      packageDigest: "",
      releaseNotes: "",
      sourceRevision: "",
    };
    versionForm.value = { version: record.value.app.version || "", upstreamVersion: "", publisher: "", sourceUrl: "", sourceRevision: "", licenseId: "", licenseUrl: "", manifest: "", dependencies: "[]", permissions: "[]" };
    await loadVersions();
    await loadGrants();
  } catch (cause) {
    record.value = null;
    error.value = cause instanceof Error ? cause.message : "应用加载失败";
  } finally {
    loading.value = false;
  }
};
watch(appId, load, { immediate: true });
const lines = (value) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const listingMissing = computed(() => {
  if (!form.value) return [];
  return [
    ["应用名称", form.value.name], ["市场分类", form.value.category], ["一句话简介", form.value.summary],
    ["开发者", form.value.developer], ["应用介绍", form.value.description],
    ["展示截图（至少 1 张）", lines(screenshotsText.value).length],
    ["功能亮点（至少 1 条）", lines(highlightsText.value).length],
  ].filter(([, value]) => !value).map(([label]) => label);
});
const chartFlow = computed(() => Boolean(form.value?.groupId));
const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};
const listingInvalid = computed(() => {
  const screenshots = lines(screenshotsText.value);
  const highlights = lines(highlightsText.value);
  const permissions = lines(permissionsText.value);
  const links = [form.value?.showcase?.websiteUrl, form.value?.showcase?.docsUrl, form.value?.showcase?.sourceUrl, form.value?.publicIconUrl].filter(Boolean);
  return [
    form.value?.name && [...form.value.name.trim()].length < 2 && "应用名称至少 2 个字符",
    screenshots.length > 8 && "展示截图最多 8 张",
    highlights.length > 12 && "功能亮点最多 12 条",
    permissions.length > 12 && "权限最多 12 条",
    screenshots.some((item) => !isHttpsUrl(item)) && "截图须使用 HTTPS URL",
    links.some((item) => !isHttpsUrl(item)) && "官网、文档、源码和图标须使用 HTTPS URL",
  ].filter(Boolean);
});
const canList = computed(() => !listingMissing.value.length && !listingInvalid.value.length && !form.value?.version);

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

const selectChartFile = (event) => {
  chartRequest += 1;
  chartFile.value = event.target.files?.[0] || null;
  chartAudit.value = null;
  chartAuditError.value = "";
  auditedFileName.value = "";
};

const auditChart = async () => {
  if (!chartFile.value || chartAuditing.value) return;
  const file = chartFile.value;
  const id = appId.value;
  const request = ++chartRequest;
  chartAuditError.value = "";
  chartAudit.value = null;
  if (chartFile.value.size > 2 * 1024 * 1024) {
    chartAuditError.value = "Chart 文件不能超过 2 MiB";
    return;
  }
  chartAuditing.value = true;
  try {
    const result = await controlApi.auditAppChart(id, file);
    if (request !== chartRequest || chartFile.value !== file || appId.value !== id) return;
    chartAudit.value = result;
    auditedFileName.value = file.name;
    if (result.chartVersion && !ociForm.value.version) {
      ociForm.value.version = result.chartVersion;
      ociForm.value.chartVersion = result.chartVersion;
    }
    if (result.archiveSha256 && !ociForm.value.packageDigest) {
      ociForm.value.packageDigest = `sha256:${result.archiveSha256}`;
    }
  } catch (cause) {
    if (request === chartRequest) chartAuditError.value = cause instanceof Error ? cause.message : "Chart 检查失败";
  } finally {
    if (request === chartRequest) chartAuditing.value = false;
  }
};

const registerOciVersion = async () => {
  if (ociSaving.value) return;
  ociError.value = "";
  let payload;
  try {
    payload = buildOciVersionPayload(appId.value, ociForm.value);
  } catch (cause) {
    ociError.value = cause instanceof Error ? cause.message : "OCI 版本参数格式不正确";
    return;
  }
  ociSaving.value = true;
  try {
    const created = await controlApi.createOCIAppVersion(appId.value, payload);
    await loadVersions();
    ociForm.value.version = "";
    ociForm.value.chartVersion = "";
    ociForm.value.manifestDigest = "";
    ociForm.value.packageDigest = "";
    ociForm.value.releaseNotes = "";
    ociForm.value.sourceRevision = "";
    emit("toast", `Chart OCI 版本 ${created.version} 已完成验签与元数据提取`);
  } catch (cause) {
    ociError.value = cause instanceof Error ? cause.message : "Chart OCI 版本登记失败";
  } finally {
    ociSaving.value = false;
  }
};

const selectReleaseVersion = async (targetVersion) => {
  if (releaseSelecting.value || !record.value) return;
  releaseSelecting.value = true;
  ociError.value = "";
  try {
    await controlApi.selectAppRelease(appId.value, targetVersion, record.value.app.revision);
    record.value = await controlApi.getManagedApp(appId.value);
    form.value = { ...record.value.app, showcase: { screenshots: [], highlights: [], permissions: [], ...record.value.app.showcase } };
    emit("toast", targetVersion ? `已将 ${targetVersion} 设为当前发布版本并写入 apps.yaml` : "已取消可安装版本发布，应用降为仅目录展示");
  } catch (cause) {
    ociError.value = cause instanceof Error ? cause.message : "切换发布版本失败";
  } finally {
    releaseSelecting.value = false;
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
    form.value.version = result.version;
    grantForm.value.version = result.version;
    versionForm.value.version = "";
    versionForm.value.manifest = "";
    emit("toast", `候选版本 ${result.version} 已登记`);
  } catch (cause) {
    versionError.value = cause instanceof Error ? cause.message : "候选版本登记失败";
  } finally {
    versionSaving.value = false;
  }
};

const createGrant = async () => {
  grantsError.value = "";
  grantSaving.value = true;
  try {
    await controlApi.createStationTestGrant(appId.value, grantForm.value.version, {
      stationId: grantForm.value.stationId.trim().toLowerCase(),
      organizationId: "org_verdantflare",
      certificateSha256: grantForm.value.certificateSha256.trim().toLowerCase(),
      expiresAt: new Date(grantForm.value.expiresAt).toISOString(),
    });
    grantForm.value.stationId = "";
    grantForm.value.certificateSha256 = "";
    await loadGrants();
    emit("toast", "内部测试 Station 已获候选清单读取权限；此授权不允许安装");
  } catch (cause) {
    grantsError.value = cause instanceof Error ? cause.message : "设备授权失败";
  } finally {
    grantSaving.value = false;
  }
};
const revokeGrant = async (grant) => {
  grantsError.value = "";
  grantSaving.value = true;
  try {
    await controlApi.revokeStationTestGrant(appId.value, grant.version, grant.stationId);
    await loadGrants();
    emit("toast", "设备候选清单授权已撤销");
  } catch (cause) {
    grantsError.value = cause instanceof Error ? cause.message : "撤销授权失败";
  } finally {
    grantSaving.value = false;
  }
};

const save = async (channel = form.value.channel) => {
  if (saving.value) return;
  if (channel === "Listed" && (listingMissing.value.length || listingInvalid.value.length || form.value.version)) {
    error.value = `Hub 目录上架还缺：${[...listingMissing.value, ...listingInvalid.value, form.value.version && "清空目录展示版本"].filter(Boolean).join("、")}`;
    return;
  }
  if (chartFlow.value && ["Preview", "Stable"].includes(channel) && !hasVerifiedOciVersion.value && !["Preview", "Stable"].includes(record.value.app.channel)) {
    error.value = "请先在「Chart OCI 版本登记与发布」中登记至少一个已验证的 Chart OCI 版本，再发布 Preview 或 Stable。";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    record.value = await controlApi.updateManagedApp(appId.value, {
      name: form.value.name,
      groupId: form.value.groupId || "",
      sortOrder: Number(form.value.sortOrder ?? 1000),
      brand: form.value.brand || "",
      iconRef: form.value.iconRef || "",
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
      showcase: {
        ...form.value.showcase,
        screenshots: lines(screenshotsText.value),
        highlights: lines(highlightsText.value),
        permissions: lines(permissionsText.value),
      },
    });
    form.value = { ...record.value.app, showcase: { screenshots: [], highlights: [], permissions: [], ...record.value.app.showcase } };
    emit("toast", channel === "Listed" ? "应用已上架 Hub 目录" : channel === "Stable" ? "应用发布状态已更新" : "应用目录资料已保存");
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
    <section v-if="error" class="ops-note" role="alert"><AppIcon name="warning" :size="19" /><div><strong>操作未完成</strong><p>{{ error }}</p><p v-if="record">已填写内容仍保留，请检查后重新保存。</p></div><button v-if="!record" class="button secondary" @click="load">重新加载</button></section>
    <template v-if="record && form">
      <section class="detail-command-bar internal-detail">
        <div class="app-large-icon" :class="record.app.tone"><AppIcon :name="record.app.icon || 'market'" :size="31" /></div>
        <div class="detail-title-copy"><span class="page-overline internal-overline">APP RELEASE</span><h1>{{ record.app.name }} · {{ record.app.publishedVersion || record.app.version || '版本待登记' }}</h1><p>应用 ID：<code>{{ record.app.id }}</code> · 修订 <code>rev {{ record.app.revision || 1 }}</code> · 已授权 {{ record.release.audience }}</p></div>
        <div class="detail-command-actions"><StatusBadge :label="record.app.channel === 'Preview' ? '目录预览' : record.release.status" /><a class="button secondary" :href="controlApi.opsAppsYamlUrl()" target="_blank" rel="noopener noreferrer">查看 apps.yaml</a><button v-if="record.app.channel === 'Listed' || record.app.publicVisible" class="button secondary" @click="navigate(`/market/apps/${encodeURIComponent(appId)}`)">查看已上架详情</button><button class="button secondary" :disabled="saving" @click="save()">保存资料</button><button v-if="record.app.channel === 'Candidate'" class="button primary" :disabled="saving || !canList" @click="save('Listed')">仅上架 Hub 资料</button></div>
      </section>

      <nav class="release-section-nav" aria-label="应用发布页内导航"><a href="#release-basics">应用资料</a><a href="#release-chart">Chart 预检</a><a href="#release-oci-versions">OCI 版本与发布</a><a href="#release-channel">发布通道</a></nav>

      <section class="content-panel release-readiness-panel">
        <div class="section-heading"><div><h2>发布检查</h2><p>目录展示、Chart 预检与 OCI 版本发布分别校验；选中发布版本后自动同步至 Station 可拉取的 apps.yaml。</p></div></div>
        <div class="readiness-grid"><div><strong>01 · 资料上架</strong><p>{{ listingMissing.length || listingInvalid.length ? `还需处理：${[...listingMissing, ...listingInvalid].join('、')}` : '展示必填项已齐；可上架资料。' }}</p></div><div><strong>02 · Chart 预检</strong><p>{{ chartAudit ? (chartAudit.staticChecksPassed ? '本次上传的静态规则通过；可将摘要填入下方 OCI 登记。' : '本次上传存在阻断项；请查看报告。') : '可选上传本地 .tgz 归档快速预检结构与摘要。' }}</p></div><div><strong>03 · OCI 版本发布</strong><p>{{ record.app.publishedVersion ? `当前已发布 Chart OCI 版本 ${record.app.publishedVersion}（可安装分发已启用）。` : (ociVersions.length ? `已登记 ${ociVersions.length} 个可信 OCI 版本，可随时选定发布。` : '尚未登记 OCI Chart 版本；当前仅可作为目录展示。') }}</p></div></div>
      </section>

      <section id="release-basics" class="content-panel manifest-panel release-section" tabindex="-1" aria-label="应用目录资料">
          <div class="section-heading"><div><h2>第一步 · 应用目录资料</h2><p>星号字段为资料上架必填；资源、镜像和部署条件以受控 Chart 为准。</p></div></div>
          <div class="two-column-form"><label class="form-field"><span>应用名称 *</span><input v-model.trim="form.name" /></label><label class="form-field"><span>应用主分组</span><input :value="form.groupId || '旧版目录未登记'" disabled /></label><label class="form-field"><span>当前发布版本（publishedVersion）</span><input v-if="chartFlow" :value="record.app.publishedVersion || record.app.version || '未选择可安装版本'" disabled /><input v-else v-model.trim="form.version" /></label><label class="form-field"><span>市场分类 *</span><input v-model.trim="form.category" /></label><label v-if="!chartFlow" class="form-field"><span>旧版推荐资源</span><input v-model.trim="form.gpu" /></label><label v-if="!chartFlow" class="form-field"><span>旧版体验时长说明</span><input v-model.trim="form.duration" /></label></div>
          <div class="two-column-form"><label class="form-field"><span>目录排序（0–1000000）</span><input v-model.number="form.sortOrder" type="number" min="0" max="1000000" /></label><label class="form-field"><span>品牌标识</span><input v-model.trim="form.brand" /></label><label class="form-field"><span>图标引用</span><input v-model.trim="form.iconRef" placeholder="例如 brand:blender" /></label></div>
          <label class="form-field"><span>一句话简介 *</span><textarea v-model.trim="form.summary" rows="3" /></label>
          <div class="section-heading"><div><h2>客户详情展示</h2><p>按截图组织展示内容；每行一条截图、功能或权限。图片与外部链接使用 HTTPS。</p></div></div>
          <label class="form-field"><span>开发者 *</span><input v-model.trim="form.developer" /></label>
          <label class="form-field"><span>应用介绍 *</span><textarea v-model.trim="form.description" rows="5" /></label>
          <label class="form-field"><span>功能亮点 *（每行一条）</span><textarea v-model="highlightsText" rows="4" /></label>
          <label class="form-field"><span>展示截图 URL *（每行一张，最多 8 张）</span><textarea v-model="screenshotsText" rows="4" placeholder="https://example.com/app-screen.png" /></label>
          <details class="release-optional-fields"><summary>补充更新、权限、链接和资源信息（可选）</summary>
          <label class="form-field"><span>新功能 / 更新说明</span><textarea v-model.trim="form.showcase.whatsNew" rows="3" /></label>
          <label class="form-field"><span>所需权限（每行一条）</span><textarea v-model="permissionsText" rows="3" /></label>
          <div class="two-column-form"><label class="form-field"><span>官网 URL</span><input v-model.trim="form.showcase.websiteUrl" type="url" /></label><label class="form-field"><span>文档 URL</span><input v-model.trim="form.showcase.docsUrl" type="url" /></label><label class="form-field"><span>源码 URL</span><input v-model.trim="form.showcase.sourceUrl" type="url" /></label><label class="form-field"><span>许可证</span><input v-model.trim="form.showcase.license" /></label><label class="form-field"><span>支持语言</span><input v-model.trim="form.showcase.languages" /></label><label class="form-field"><span>支持平台</span><input v-model.trim="form.showcase.platforms" /></label></div>
          <div class="section-heading"><div><h2>WWW 公开资料</h2><p>只展示手动公开的目录记录；版本与资源需求来自本页落库数据。</p></div></div>
          <div class="two-column-form"><label class="form-field"><span>参考内存</span><input v-model.trim="form.memory" /></label><label class="form-field"><span>参考磁盘</span><input v-model.trim="form.disk" /></label><label class="form-field"><span>参考 CPU</span><input v-model.trim="form.cpu" /></label></div>
          <label class="form-field"><span>公开图标 URL（HTTPS，可选）</span><input v-model.trim="form.publicIconUrl" type="url" /></label>
          </details>
        </section>

      <section id="release-chart" class="content-panel chart-audit-panel release-section" tabindex="-1" aria-label="Chart 预检">
        <div class="section-heading"><div><h2>第二步 · 上传 Helm Chart 本地预检</h2><p>支持 Helm 打包的 .tgz 文件，最多 2 MiB。Control 仅读取并检查本次上传，辅助核对归档 SHA-256。</p></div><span class="candidate-internal-tag">本地预检</span></div>
        <p class="candidate-help">归档必备：Chart.yaml（v2/application、名称与应用 ID 一致、固定版本和 appVersion）、values.yaml、Deployment、ClusterIP Service、工作卷、固定镜像标签及 SHA-256；GPU 应用还需声明 GPU 请求与上限。禁止 Secret、公网入口和子 Chart 依赖。</p>
        <div class="chart-audit-actions"><input type="file" accept=".tgz,application/gzip" aria-label="选择 Helm Chart 归档" :disabled="chartAuditing" @change="selectChartFile" /><button class="button secondary" :disabled="!chartFile || chartAuditing" @click="auditChart">{{ chartAuditing ? '正在检查…' : '上传并检查' }}</button></div>
        <p v-if="chartAuditing" role="status" class="candidate-help">正在检查 {{ chartFile.name }}，请等待本次报告。</p>
        <p v-if="chartAuditError" class="form-error" role="alert">{{ chartAuditError }}</p>
        <div v-if="chartAudit" class="chart-audit-report">
          <p>检查文件：<strong>{{ auditedFileName }}</strong></p>
          <p><strong>{{ chartAudit.staticChecksPassed ? '静态检查通过' : '存在部署阻断项' }}</strong> · {{ chartAudit.chartName || '名称未识别' }} · Chart {{ chartAudit.chartVersion || '版本未识别' }} · App {{ chartAudit.appVersion || '版本未识别' }}</p>
          <p>本次归档 SHA-256：<code>sha256:{{ chartAudit.archiveSha256 }}</code></p>
          <ul><li v-for="check in chartAudit.checks" :key="check.code"><strong :class="`chart-audit-${check.status}`">{{ check.status === 'passed' ? '通过' : check.status === 'blocked' ? '阻断' : '待验证' }}</strong> · {{ check.detail }}</li></ul>
        </div>
      </section>

      <section id="release-oci-versions" class="content-panel candidate-version-panel release-section" tabindex="-1" aria-label="Chart OCI 版本登记与发布">
        <div class="section-heading">
          <div>
            <h2>第三步 · Chart OCI 版本登记与发布</h2>
            <p>向 Control 登记已推送到受控 OCI Registry 的 Helm Chart 版本，自动验签并提取镜像、模型、能力、Logo 与兼容性，支持一键切换或撤回发布指针。</p>
          </div>
          <span class="candidate-internal-tag">{{ record.app.publishedVersion ? `已发布 ${record.app.publishedVersion}` : '未发布可安装版本' }}</span>
        </div>

        <div v-if="record.app.publishedVersion" class="detail-command-actions">
          <span>当前线上发布版本：<strong>{{ record.app.publishedVersion }}</strong>（已启用 Station <code>apps.yaml</code> 分发）</span>
          <button class="button secondary" :disabled="releaseSelecting" @click="selectReleaseVersion(null)">{{ releaseSelecting ? '正在处理…' : '取消发布（降为仅目录）' }}</button>
        </div>
        <div v-else-if="record.app.disabledReason" class="candidate-help">
          当前不可安装原因：<code>{{ record.app.disabledReason }}</code>
        </div>

        <p v-if="versionsLoading" class="candidate-help">正在加载 Chart OCI 版本记录…</p>
        <div v-if="versionsError" class="ops-note"><AppIcon name="warning" :size="18" /><div><strong>版本记录暂不可用</strong><p>{{ versionsError }}</p></div><button class="button secondary" @click="loadVersions">重试</button></div>
        <div v-if="!versionsLoading && !versionsError && !ociVersions.length" class="candidate-empty">尚未登记任何 Chart OCI 版本。请先推送 Chart 至 <code>{{ defaultChartOciRef(record.app.id) }}</code>，再在下方提交摘要登记。</div>

        <div v-for="item in ociVersions" :key="item.version" class="candidate-version-card">
          <div class="candidate-version-header">
            <div>
              <strong>{{ item.version }}</strong>
              <span>· Chart {{ item.chart?.name }}@{{ item.chart?.version }}</span>
              <span v-if="item.chart?.appVersion"> · App {{ item.chart.appVersion }}</span>
            </div>
            <div class="detail-command-actions">
              <StatusBadge v-if="record.app.publishedVersion === item.version" label="当前发布" />
              <button
                v-else
                class="button primary"
                :disabled="releaseSelecting"
                @click="selectReleaseVersion(item.version)"
              >
                {{ releaseSelecting ? '切换中…' : '设为当前发布版本' }}
              </button>
            </div>
          </div>
          <p>OCI 引用：<code>{{ item.chart?.ociRef }}</code> · 包大小 {{ item.chart?.packageSizeBytes || 0 }} bytes · 验签时间 {{ item.verifiedAt || '—' }}</p>
          <p>Manifest 摘要：<code>{{ item.chart?.manifestDigest }}</code></p>
          <p>Package 摘要：<code>{{ item.chart?.packageDigest }}</code></p>
          <p v-if="item.releaseNotes">版本说明：{{ item.releaseNotes }}</p>
          <details class="candidate-version-details">
            <summary>查看 Chart 提取元数据（镜像 {{ item.images?.length || 0 }} · 模型 {{ item.models?.length || 0 }} · 能力 {{ item.capabilities?.length || 0 }}）</summary>
            <dl>
              <div><dt>容器镜像</dt><dd><code v-for="img in item.images" :key="`${img.component}-${img.image}`">{{ img.component }}: {{ img.image }}<br /></code><span v-if="!item.images?.length">未声明</span></dd></div>
              <div><dt>AI 模型</dt><dd>{{ item.models?.join('、') || '无' }}</dd></div>
              <div><dt>应用能力</dt><dd>{{ item.capabilities?.join('、') || '无' }}</dd></div>
              <div><dt>应用依赖</dt><dd>{{ item.dependencies?.map((dep) => `${dep.appId || dep.id}@${dep.versionRange || dep.version}`).join('、') || '无' }}</dd></div>
              <div><dt>运行兼容性</dt><dd>{{ formatChartCompatibility(item.compatibility) }}</dd></div>
              <div><dt>包内 Logo</dt><dd><span v-if="item.logo"><code>{{ item.logo.mediaType }}</code> · <code>{{ item.logo.digest }}</code></span><span v-else>沿用应用图标引用</span></dd></div>
              <div v-if="item.sourceRevision"><dt>源码 Revision</dt><dd><code>{{ item.sourceRevision }}</code></dd></div>
            </dl>
          </details>
        </div>

        <form class="candidate-version-form" @submit.prevent="registerOciVersion">
          <div class="section-heading"><div><h3>登记新 Chart OCI 版本</h3><p>Control 将向 OCI Registry 拉取 Manifest 与 .tgz 层校验 SHA-256，并自动解析 Chart.yaml、values.yaml 与包内图标。</p></div></div>
          <div class="two-column-form">
            <label class="form-field"><span>发行版本号（SemVer）*</span><input v-model.trim="ociForm.version" required placeholder="例如 0.1.3" /></label>
            <label class="form-field"><span>Chart 版本号（默认同上）</span><input v-model.trim="ociForm.chartVersion" :placeholder="ociForm.version || '例如 0.1.3'" /></label>
            <label class="form-field"><span>Chart OCI 仓库地址 *</span><input v-model.trim="ociForm.ociRef" required :placeholder="defaultChartOciRef(record.app.id)" /></label>
            <label class="form-field"><span>源码 Git Revision（40 位可选）</span><input v-model.trim="ociForm.sourceRevision" placeholder="可选 40 位 commit SHA" /></label>
            <label class="form-field"><span>OCI Manifest Digest（sha256:...）*</span><input v-model.trim="ociForm.manifestDigest" required placeholder="sha256:..." /></label>
            <label class="form-field"><span>Chart Package Digest（sha256:...，可选）</span><input v-model.trim="ociForm.packageDigest" placeholder="sha256:..." /></label>
          </div>
          <label class="form-field"><span>版本变更说明（Release Notes）</span><textarea v-model.trim="ociForm.releaseNotes" rows="3" placeholder="记录本次 Chart 版本的特性、模型或修复说明" /></label>
          <p v-if="ociError" class="form-error" role="alert">{{ ociError }}</p>
          <button class="button primary" type="submit" :disabled="ociSaving || versionsLoading">{{ ociSaving ? '正在验签并登记…' : '验签并登记 OCI 版本' }}</button>
        </form>
      </section>

      <aside id="release-channel" class="content-panel release-controls release-section" tabindex="-1" aria-label="发布状态">
          <p v-if="error" class="form-error" role="alert">{{ error }} · 已填写内容仍保留。</p>
          <div class="section-heading"><div><h2>第四步 · 发布通道与可见性</h2><p>Listed 仅在 Hub 展示资料；绑定已验证的 Chart OCI 版本后可发布 Stable / Preview。</p></div></div>
          <label class="form-field"><span>通道</span><select v-model="form.channel"><option>Candidate</option><option :disabled="Boolean(form.version) && !hasVerifiedOciVersion">Listed</option><option v-if="!chartFlow || hasVerifiedOciVersion || ['Preview', 'Stable'].includes(record.app.channel)">Preview</option><option v-if="!chartFlow || hasVerifiedOciVersion || record.app.channel === 'Stable'">Stable</option><option>Paused</option></select></label>
          <label class="form-field"><span>WWW 公开</span><select v-model="form.publicVisible" :disabled="!['Preview', 'Stable'].includes(form.channel)"><option :value="false">不公开</option><option :value="true">公开目录资料</option></select></label>
        </aside>

      <section class="content-panel release-showcase-preview">
        <div class="section-heading"><div><h2>客户详情内容预览</h2><p>直接使用当前未保存的表单内容；发布后客户页面读取 Control 已保存的记录。</p></div></div>
        <h3>{{ form.name || '应用名称待填写' }}</h3><p>{{ form.summary || '一句话简介待填写' }}</p>
        <div v-if="lines(screenshotsText).length" class="market-gallery"><a v-for="(url, index) in lines(screenshotsText)" :key="`${index}-${url}`" :href="url" target="_blank" rel="noopener noreferrer"><img :src="url" :alt="`展示截图 ${index + 1}`" loading="lazy" /></a></div>
        <p class="market-detail-prose">{{ form.description || '应用介绍待填写' }}</p>
        <ul v-if="lines(highlightsText).length"><li v-for="item in lines(highlightsText)" :key="item">{{ item }}</li></ul>
      </section>

      <details v-if="!chartFlow || legacyVersions.length" class="legacy-release-tools">
        <summary>旧版 Manifest 候选与内部设备授权{{ legacyVersions.length ? ` · ${legacyVersions.length} 个历史版本` : '' }}</summary>
      <section class="content-panel candidate-version-panel">
        <div class="section-heading"><div><h2>旧版 Manifest 候选记录</h2><p>历史 v1 候选版本接口记录，仅供兼容查阅。</p></div><span class="candidate-internal-tag">仅内部可见</span></div>
        <div v-for="item in legacyVersions" :key="item.version" class="candidate-version-card">
          <div class="candidate-version-header"><div><strong>{{ item.version }}</strong><span>· {{ item.publisher }}</span></div><span class="candidate-internal-tag">Center 已登记</span></div>
          <p>Manifest SHA-256 <code>{{ item.manifestSha256 }}</code></p>
          <p>来源 <a :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">{{ item.sourceUrl }}</a> · 许可证 {{ item.licenseId }}</p>
        </div>
        <form v-if="!chartFlow" class="candidate-version-form" @submit.prevent="createVersion">
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
          <p v-if="versionError" class="form-error" role="alert">{{ versionError }}</p>
          <button class="button primary" type="submit" :disabled="versionSaving || versionsLoading || Boolean(versionsError)">{{ versionSaving ? '正在登记…' : '登记并冻结版本' }}</button>
        </form>
      </section>

      <section class="content-panel station-grants-panel">
        <div class="section-heading"><div><h2>内部测试 Station 分发</h2><p>仅授权设备证书读取该应用的候选版本索引与不可变 Manifest。</p></div><span class="candidate-internal-tag">mTLS · 内部</span></div>
        <form v-if="!chartFlow && legacyVersions.length" class="station-grant-form" @submit.prevent="createGrant">
          <div class="two-column-form">
            <label class="form-field"><span>候选版本 *</span><select v-model="grantForm.version" required><option value="">选择已冻结版本</option><option v-for="item in legacyVersions" :key="item.version" :value="item.version">{{ item.version }}</option></select></label>
            <label class="form-field"><span>组织</span><input value="org_verdantflare · 内部测试" disabled /></label>
            <label class="form-field"><span>Station ID（UUIDv7）*</span><input v-model.trim="grantForm.stationId" required autocomplete="off" placeholder="xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx" /></label>
            <label class="form-field"><span>设备证书 SHA-256 指纹 *</span><input v-model.trim="grantForm.certificateSha256" required minlength="64" maxlength="64" pattern="[a-fA-F0-9]{64}" autocomplete="off" placeholder="64 位十六进制" /></label>
            <label class="form-field"><span>授权到期 *</span><input v-model="grantForm.expiresAt" type="datetime-local" required /></label>
          </div>
          <button class="button secondary" type="submit" :disabled="grantSaving || grantsLoading">{{ grantSaving ? '正在登记…' : '授权读取候选清单' }}</button>
        </form>
        <div v-if="grantsError" class="ops-note" role="alert"><AppIcon name="warning" :size="18" /><div><strong>设备授权操作未完成</strong><p>{{ grantsError }}</p></div><button class="button secondary" @click="loadGrants">刷新</button></div>
        <p v-if="grantsLoading" class="candidate-help">正在加载授权记录…</p>
        <div v-else-if="!grants.length" class="candidate-empty">尚无内部 Station 授权。</div>
        <div v-for="grant in grants" :key="`${grant.stationId}-${grant.version}-${grant.certificateSha256}`" class="station-grant-row">
          <div><strong>{{ grant.stationId }}</strong><p>{{ grant.version }} · 指纹 <code>{{ grant.certificateSha256 }}</code></p><small>到期 {{ new Date(grant.expiresAt).toLocaleString() }} · 修订 {{ grant.revision }}</small></div>
          <div class="station-grant-actions"><span :class="grantActive(grant) ? 'station-grant-active' : 'station-grant-inactive'">{{ grant.revoked ? '已撤销' : grantActive(grant) ? '有效' : '已过期' }}</span><button v-if="grantActive(grant)" class="button secondary" :disabled="grantSaving" @click="revokeGrant(grant)">撤销</button></div>
        </div>
      </section>
      </details>
    </template>
  </div>
</template>
