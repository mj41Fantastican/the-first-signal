import { createClient } from "@supabase/supabase-js";
import { meterApiCall } from "@/lib/meter";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const beat = searchParams.get("beat");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);

  let query = supabase
    .from("stories")
    .select("id, headline, summary, body, sources, beat, byline, tags, created_at")
    .eq("status", "filed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beat) {
    query = query.eq("beat", beat);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Detect if caller is an agent (simple heuristic)
  const ua = request.headers.get("user-agent") || "";
  const isAgent =
    !ua.includes("Mozilla") || ua.includes("bot") || ua.includes("curl");

  // Log the read
  await supabase.from("page_views").insert({
    page: "/api/stories",
    visitor_type: isAgent ? "agent" : "human",
  });

  return Response.json({
    service: "The First Signal",
    description: "AI-native news wire by mj41, LLC",
    pricing: "free during beta — future pricing $0.01-$0.10/call",
    story_count: data.length,
    stories: data,
  });
}
