import { dispatchReporter } from "@/lib/reporter";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await dispatchReporter("richard");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
