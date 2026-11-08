import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function v1Json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Cubics-Protocol-Version": "1",
      Vary: "Authorization, Cookie",
    },
  });
}
export function v1Error(code: string, message: string, status: number) {
  return v1Json({ error: { code, message } }, status);
}
