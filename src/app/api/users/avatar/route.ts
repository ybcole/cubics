import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { avatar } = await request.json();
    if (avatar !== null && typeof avatar !== "string") {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk.local`;
    const name = clerkUser.fullName || clerkUser.username || email.split("@")[0];

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { avatar: avatar ?? clerkUser.imageUrl ?? null, name, email },
      create: { id: userId, email, name, avatar: avatar ?? clerkUser.imageUrl ?? null },
    });

    return NextResponse.json({ id: user.id, avatar: user.avatar });
  } catch (error) {
    console.error("Failed to update user avatar:", error);
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
  }
}
