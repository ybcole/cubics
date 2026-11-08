import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, usernameKey } from "@/lib/username";
import { validateUsername } from "@/lib/username-filter";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [clerkUser, row] = await Promise.all([
      (await clerkClient()).users.getUser(userId),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    return NextResponse.json({
      id: userId,
      username: row?.username ?? null,
      name: clerkUser.fullName || null,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
      avatar: clerkUser.imageUrl,
      createdAt: row?.createdAt ?? new Date(clerkUser.createdAt),
    });
  } catch (error) {
    console.error("Failed to load profile:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const invalid = validateUsername(body?.username);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const username = normalizeUsername(body.username);
    const key = usernameKey(username);

    const taken = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [{ usernameKey: key }, { name: { equals: username, mode: "insensitive" } }],
      },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "That username is taken" }, { status: 409 });

    const clerkUser = await (await clerkClient()).users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk.local`;
    const previous = await prisma.user.findUnique({ where: { id: userId } });

    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: { username, usernameKey: key, name: username },
        create: { id: userId, email, username, usernameKey: key, name: username, avatar: clerkUser.imageUrl ?? null },
      });
    } catch (err) {
      // Unique index on usernameKey: lost a race with another account.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json({ error: "That username is taken" }, { status: 409 });
      }
      throw err;
    }

    // Keep Clerk in sync so every place that reads fullName shows the new name.
    try {
      await (await clerkClient()).users.updateUser(userId, { firstName: username, lastName: "" });
    } catch (err) {
      console.error("Clerk update failed, reverting:", err);
      await prisma.user.update({
        where: { id: userId },
        data: {
          username: previous?.username ?? null,
          usernameKey: previous?.usernameKey ?? null,
          name: previous?.name ?? null,
        },
      });
      return NextResponse.json({ error: "Could not update your account. Try again." }, { status: 502 });
    }

    return NextResponse.json({ username });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
