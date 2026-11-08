import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No credentials, database access, or identity metadata in a public probe.
 * Indicates only that the hosted Next process can serve requests.
 * Full readiness is verified with authenticated staging smoke checks. */
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "cubics-web", version: 1 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
