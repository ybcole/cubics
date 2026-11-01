import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { usernameKey } from "@/lib/username";
import { validateUsername } from "@/lib/username-filter";

/** GET /api/users/username?name=foo -> { available, error? } */
export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = new URL(request.url).searchParams.get("name") ?? "";
  const invalid = validateUsername(name);
  if (invalid) return NextResponse.json({ available: false, error: invalid });

  const taken = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [
        { usernameKey: usernameKey(name) },
        { name: { equals: name.trim(), mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (taken) return NextResponse.json({ available: false, error: "That username is taken" });
  return NextResponse.json({ available: true });
}
