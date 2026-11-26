import { NextResponse } from "next/server";
import { ANDROID_APP_ID } from "@/lib/platform";

// Served at /.well-known/assetlinks.json (rewrite in next.config.ts). Verifies Android App Links,
// so bookly.uz/s/... links open straight in the app. Fingerprints: Play Console → Test and release →
// App integrity → App signing → "SHA-256 certificate fingerprint" (add the upload key's too for local builds).
export const dynamic = "force-static";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: ANDROID_APP_ID, sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
