import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOciVersionPayload,
  defaultChartOciRef,
  formatChartCompatibility,
  hasVerifiedOciChartVersion,
} from "../src/utils/marketReleaseV2.js";

const validDigestA = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
const validDigestB = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

test("defaultChartOciRef builds canonical OCI chart repository path", () => {
  assert.equal(defaultChartOciRef("comfyui"), "oci://registry.verdantflare.ai/charts/comfyui");
  assert.equal(defaultChartOciRef(""), "");
});

test("hasVerifiedOciChartVersion detects verified OCI chart versions", () => {
  assert.equal(hasVerifiedOciChartVersion([]), false);
  assert.equal(hasVerifiedOciChartVersion([{ version: "1.0.0" }]), false);
  assert.equal(
    hasVerifiedOciChartVersion([
      {
        version: "0.1.3",
        chart: { manifestDigest: validDigestA, packageDigest: validDigestB },
      },
    ]),
    true,
  );
});

test("buildOciVersionPayload validates SemVer, OCI ref, and sha256 digests", () => {
  const payload = buildOciVersionPayload("comfyui", {
    version: "0.1.3",
    manifestDigest: validDigestA.toUpperCase(),
    packageDigest: validDigestB,
    releaseNotes: "首次 OCI 发布",
  });
  assert.deepEqual(payload, {
    version: "0.1.3",
    chart: {
      ociRef: "oci://registry.verdantflare.ai/charts/comfyui",
      version: "0.1.3",
      manifestDigest: validDigestA,
      packageDigest: validDigestB,
    },
    releaseNotes: "首次 OCI 发布",
  });

  assert.throws(
    () => buildOciVersionPayload("comfyui", { version: "latest", manifestDigest: validDigestA }),
    /SemVer/,
  );
  assert.throws(
    () => buildOciVersionPayload("comfyui", { version: "0.1.3", manifestDigest: "sha256:bad" }),
    /Manifest Digest/,
  );
});

test("formatChartCompatibility formats Kubernetes, Station runtime, and architectures", () => {
  assert.equal(
    formatChartCompatibility({
      kubernetesVersionRange: ">=1.28.0-0",
      minimumRuntimeVersion: "0.4.0",
      architectures: ["amd64", "arm64"],
    }),
    "K8s >=1.28.0-0 · Station >= 0.4.0 · 架构 amd64, arm64",
  );
});
