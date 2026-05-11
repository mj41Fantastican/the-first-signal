import { dispatchCorrection } from "@/lib/aisao";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await dispatchCorrection();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
