import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminToken } from "@/lib/admin-auth";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (!password || password !== ADMIN_PASSWORD) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_token", getAdminToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  return Response.json({ ok: true });
}
