import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOciVersionPayload,
  defaultChartOciRef,
  formatChartCompatibility,
  hasVerifiedOciChartVersion,
} from "../src/utils/marketReleaseV2.js";
import fs from "node:fs";
import { nextBrandLogoUid, normalizeBrandIconRef, resolveBrandLogoDescriptor } from "../src/utils/appBrandLogo.js";

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

test("resolveBrandLogoDescriptor synchronizes all 10 Studio AppCenter brand Logos", () => {
  assert.equal(normalizeBrandIconRef("", "vf"), "brand:vf");
  assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: "brand:vf" }), {
    kind: "image",
    src: "/brand/verdantflare-logo.png",
    brandRef: "brand:vf",
  });
  assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: "brand:blender" }), {
    kind: "image",
    src: "/brand/blender.svg",
    brandRef: "brand:blender",
  });
  assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: "brand:comfyui" }), {
    kind: "image",
    src: "/brand/comfyui.svg",
    brandRef: "brand:comfyui",
  });
  assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: "brand:higgsfield" }), {
    kind: "image",
    src: "/brand/higgsfield.svg",
    brandRef: "brand:higgsfield",
  });
  assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: "brand:fal" }), {
    kind: "image",
    src: "/brand/fal.png",
    brandRef: "brand:fal",
  });
  for (const channelRef of ["brand:google", "brand:chatgpt", "brand:grok"]) {
    assert.deepEqual(resolveBrandLogoDescriptor({ iconRef: channelRef }), {
      kind: "channel-svg",
      brandRef: channelRef,
    });
  }
  for (const pathRef of ["brand:minimax", "brand:github"]) {
    const desc = resolveBrandLogoDescriptor({ iconRef: pathRef });
    assert.equal(desc.kind, "path-svg");
    assert.equal(desc.brandRef, pathRef);
    assert.ok(desc.d.length > 20);
  }
  const uidA = nextBrandLogoUid();
  const uidB = nextBrandLogoUid();
  assert.equal(uidB, uidA + 1);

  const sfc = fs.readFileSync(new URL("../src/components/BrandAppIcon.vue", import.meta.url), "utf8");
  assert.match(sfc, /stop-color="#E2167E"/);
  assert.match(sfc, /stop-color="#FE603C"/);
  assert.match(sfc, /v-else-if="descriptor\.kind === 'path-svg'"\s+class="brand-app-icon-svg brand-app-icon-mono"/);
});

