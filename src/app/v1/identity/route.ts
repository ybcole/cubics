import { auth } from "@clerk/nextjs/server";
import { v1Error, v1Json } from "@/lib/cloud/server-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  return v1Json({
    userId,
    protocolVersion: 1,
    capabilities: {
      workspaceRead: true,
      workspaceWrite: false,
      operations: false,
      liveSharing: false,
      hostedApiReady: false,
    },
  });
}
