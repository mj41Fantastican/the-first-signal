import { dispatchReporter } from "@/lib/reporter";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const ALL_REPORTERS = [
  "algo", "anymal", "bambi", "becky", "blaise", "cora",
  "dalton", "finn", "mahesh", "richard", "riplo", "roofus", "sammy",
];

export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { agent: string; status: string; headline?: string }[] = [];

  // Dispatch reporters sequentially to avoid rate limits
  for (const agentId of ALL_REPORTERS) {
    try {
      const response = await dispatchReporter(agentId);
      const data = await response.json();

      if (data.story) {
        results.push({
          agent: agentId,
          status: data.status || "filed",
          headline: data.story.headline,
        });
      } else {
        results.push({
          agent: agentId,
          status: "error",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ agent: agentId, status: `error: ${message}` });
    }
  }

  const successCount = results.filter((r) => r.status !== "error" && !r.status.startsWith("error")).length;

  // Log the cron run
  await supabase.from("page_views").insert({
    page: "/api/cron/dispatch",
    visitor_type: "cron",
  });

  return Response.json({
    message: `Cron dispatch complete: ${successCount}/${ALL_REPORTERS.length} reporters filed`,
    timestamp: new Date().toISOString(),
    results,
  });
}
