import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("stories")
    .select("id, headline, summary, body, sources, beat, byline, tags, created_at")
    .eq("id", id)
    .eq("status", "filed")
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
    story: data,
  });
}
