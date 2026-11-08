import { NextResponse } from "next/server";

/**
 * Removed: an unauthenticated server-side fetch of ?url= allowed arbitrary
 * SSRF into loopback, private networks, cloud metadata and redirect targets.
 * Cubics embeds third-party pages in isolated Electron webviews, so this
 * legacy embeddability probe is unnecessary. Never reintroduce an arbitrary
 * server-side remote URL fetch without a vetted egress proxy and tests.
 */
export async function GET() {
  return NextResponse.json(
    {
      embeddable: null,
      error: "Server-side embeddability probing has been retired. Use a browser tab.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
