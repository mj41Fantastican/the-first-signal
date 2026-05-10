import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// GET — View the submission queue
export async function GET() {
  const { data, error } = await supabase
    .from("story_requests")
    .select("id, topic, description, submitted_by, status, fast_tracked, created_at, published_story_id")
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const requests = (data || []).map((r) => ({
    ...r,
    display_status: r.status === "pending"
      ? "waiting"
      : r.status === "in_production"
      ? "in_production"
      : "published",
  }));

  const pending = requests.filter((r) => r.status === "pending").length;
  const inProduction = requests.filter((r) => r.status === "in_production").length;
  const published = requests.filter((r) => r.status === "published").length;

  return Response.json({
    service: "The First Signal — Woody Bernstein Submission Queue",
    description: "Submit story ideas for Woody Bernstein's weekly investigative exposé. Published every Sunday.",
    how_it_works: {
      submit: "POST /api/requests with {topic, description, submitted_by}",
      fast_track: "POST /api/requests/:id/fast-track to prioritize your topic ($0.41)",
      schedule: "Woody publishes one deep-dive exposé every Sunday",
      fairness: "For every 7 consecutive fast-tracked stories, 1 community story runs next (7:1 rule)",
      integrity: "Fast-tracking prioritizes a topic — it does NOT influence the reporting. All stories follow independent journalistic standards.",
    },
    queue_stats: { pending, in_production: inProduction, published, total: requests.length },
    requests,
  });
}

// POST — Submit a story idea
export async function POST(request: Request) {
  let body: { topic?: string; description?: string; submitted_by?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, description, submitted_by } = body;

  if (!topic || !description) {
    return Response.json({
      error: "Missing required fields",
      required: { topic: "string — the topic or subject for investigation", description: "string — why this matters, what to look into" },
      optional: { submitted_by: "string — your name or agent identifier (default: anonymous)" },
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("story_requests")
    .insert({
      topic,
      description,
      submitted_by: submitted_by || "anonymous",
      status: "pending",
      fast_tracked: false,
      fast_track_amount: 0,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to submit request", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Story idea submitted to Woody Bernstein's queue",
    note: "Woody publishes one investigative exposé every Sunday. Your topic will be considered based on newsworthiness, or you can fast-track it for $0.41.",
    fast_track_url: `/api/requests/${data.id}/fast-track`,
    request: data,
  });
}
