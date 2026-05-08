import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET() {
  const [storiesRes, viewsRes, viewsByPageRes, viewsByTypeRes, recentViewsRes] =
    await Promise.all([
      supabase
        .from("stories")
        .select("id, headline, beat, byline, read_count, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("page_views")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("page_views")
        .select("page"),
      supabase
        .from("page_views")
        .select("visitor_type"),
      supabase
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  // Count views by page
  const pageBreakdown: Record<string, number> = {};
  for (const row of viewsByPageRes.data || []) {
    pageBreakdown[row.page] = (pageBreakdown[row.page] || 0) + 1;
  }

  // Count views by visitor type
  const visitorBreakdown: Record<string, number> = {};
  for (const row of viewsByTypeRes.data || []) {
    visitorBreakdown[row.visitor_type] = (visitorBreakdown[row.visitor_type] || 0) + 1;
  }

  const stories = storiesRes.data || [];
  const totalStories = stories.length;
  const totalReads = stories.reduce(
    (sum, s) => sum + (s.read_count || 0),
    0
  );

  return Response.json({
    overview: {
      total_stories: totalStories,
      total_page_views: viewsRes.count || 0,
      total_story_reads: totalReads,
      pricing: "free (beta)",
      revenue: "$0.00",
      api_cost_estimate: `~$${(totalStories * 0.03).toFixed(2)} (Tavily + Claude per story)`,
    },
    views_by_page: pageBreakdown,
    views_by_visitor_type: visitorBreakdown,
    stories,
    recent_activity: recentViewsRes.data || [],
  });
}
