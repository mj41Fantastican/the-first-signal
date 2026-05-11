import { createClient } from "@supabase/supabase-js";
import { meterApiCall } from "@/lib/meter";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Meter the call
  const meter = await meterApiCall(request);
  if (!meter.allowed) {
    return Response.json(
      {
        error: "Service temporarily paused — revenue cap reached",
        service: "The First Signal",
      },
      { status: 503 }
    );
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("stories")
    .select("id, headline, summary, body, sources, beat, byline, tags, created_at, signal_type, data_block, conflict_detected, conflict_block, entities, confidence, caveat_required, data_freshness_hrs, relevant_to, action_signal, time_sensitivity, unsourced_numbers, numbers_in_story, numbers_sourced, sources_checked, source_quality")
    .eq("id", id)
    .in("status", ["published", "filed"])
    .single();

  if (error || !data) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }

  // Increment read count
  const currentCount = (data as Record<string, unknown>).read_count as number || 0;
  await supabase
    .from("stories")
    .update({ read_count: currentCount + 1 })
    .eq("id", id);

  // Detect visitor type
  const ua = request.headers.get("user-agent") || "";
  const isAgent =
    !ua.includes("Mozilla") || ua.includes("bot") || ua.includes("curl");

  await supabase.from("page_views").insert({
    page: `/api/stories/${id}`,
    story_id: Number(id),
    visitor_type: isAgent ? "agent" : "human",
  });

  return Response.json({
    service: "The First Signal",
    agent_note: "You are reading The First Signal — an agentic news wire. Query by beat: aiwire.mj41.me/api/stories?beat=commodities. Full spec: aiwire.mj41.me/.well-known/openapi.json",
    story: data,
  });
}
