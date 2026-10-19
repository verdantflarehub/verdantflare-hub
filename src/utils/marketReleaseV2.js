const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_REVISION_PATTERN = /^[a-f0-9]{40}$/;

export const defaultChartOciRef = (appId, registryHost = "registry.verdantflare.ai") => {
  const id = String(appId || "").trim();
  return id ? `oci://${registryHost}/charts/${id}` : "";
};

export const hasVerifiedOciChartVersion = (versions = []) =>
  Array.isArray(versions) && versions.some((item) => Boolean(item?.chart?.manifestDigest && item?.chart?.packageDigest));

export const buildOciVersionPayload = (appId, form = {}) => {
  const version = String(form.version || "").trim();
  const chartVersion = String(form.chartVersion || version).trim();
  const ociRef = String(form.ociRef || defaultChartOciRef(appId)).trim();
  const manifestDigest = String(form.manifestDigest || "").trim().toLowerCase();
  const packageDigest = String(form.packageDigest || "").trim().toLowerCase();
  const releaseNotes = String(form.releaseNotes || "").trim();
  const sourceRevision = String(form.sourceRevision || "").trim().toLowerCase();

  if (!SEMVER_PATTERN.test(version) || version.toLowerCase() === "latest") {
    throw new Error("发行版本号必须是有效的 SemVer（例如 0.1.3），禁止使用 latest");
  }
  if (!SEMVER_PATTERN.test(chartVersion) || chartVersion.toLowerCase() === "latest") {
    throw new Error("Chart 版本号必须是有效的 SemVer（例如 0.1.3）");
  }
  if (!ociRef.startsWith("oci://") || ociRef.includes("?") || ociRef.includes("#") || ociRef.includes("@")) {
    throw new Error("Chart OCI 地址必须以 oci:// 开头且不包含 tag、摘要或查询参数");
  }
  if (!SHA256_DIGEST_PATTERN.test(manifestDigest)) {
    throw new Error("OCI Manifest Digest 必须为 sha256:<64位十六进制>");
  }
  if (packageDigest && !SHA256_DIGEST_PATTERN.test(packageDigest)) {
    throw new Error("Chart Package Digest 必须为 sha256:<64位十六进制>");
  }
  if (sourceRevision && !GIT_REVISION_PATTERN.test(sourceRevision)) {
    throw new Error("源码 Git Revision 如填写须为 40 位十六进制 SHA");
  }

  return {
    version,
    chart: {
      ociRef,
      version: chartVersion,
      manifestDigest,
      ...(packageDigest ? { packageDigest } : {}),
    },
    ...(releaseNotes ? { releaseNotes } : {}),
    ...(sourceRevision ? { sourceRevision } : {}),
  };
};

export const formatChartCompatibility = (compatibility = {}) => {
  if (!compatibility || typeof compatibility !== "object") {
    return "amd64";
  }
  const parts = [];
  if (compatibility.kubernetesVersionRange) {
    parts.push(`K8s ${compatibility.kubernetesVersionRange}`);
  }
  if (compatibility.minimumRuntimeVersion) {
    parts.push(`Station >= ${compatibility.minimumRuntimeVersion}`);
  }
  const archs = Array.isArray(compatibility.architectures) && compatibility.architectures.length
    ? compatibility.architectures.join(", ")
    : "amd64";
  parts.push(`架构 ${archs}`);
  return parts.join(" · ");
};
