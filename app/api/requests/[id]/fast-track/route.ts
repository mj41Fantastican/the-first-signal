import { createClient } from "@supabase/supabase-js";
import { FAST_TRACK_PRICE } from "@/lib/woody";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Find the request
  const { data: storyRequest, error: findError } = await supabase
    .from("story_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (findError || !storyRequest) {
    return Response.json({ error: "Story request not found" }, { status: 404 });
  }

  if (storyRequest.status !== "pending") {
    return Response.json({
      error: `Cannot fast-track — this request is already ${storyRequest.status}`,
    }, { status: 400 });
  }

  if (storyRequest.fast_tracked) {
    return Response.json({
      error: "This request has already been fast-tracked",
    }, { status: 400 });
  }

  // Mark as fast-tracked
  const { data, error } = await supabase
    .from("story_requests")
    .update({
      fast_tracked: true,
      fast_track_amount: FAST_TRACK_PRICE,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to fast-track", details: error.message }, { status: 500 });
  }

  // Log the payment in api_usage
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  await supabase.from("api_usage").insert({
    ip,
    billable: true,
    amount: FAST_TRACK_PRICE,
  });

  return Response.json({
    message: "Story request has been fast-tracked",
    cost: `$${FAST_TRACK_PRICE.toFixed(2)}`,
    what_this_means: "Your topic will be prioritized for Woody Bernstein's next Sunday exposé. Fast-tracking prioritizes a topic for investigation — it does NOT influence the reporting. All First Signal exposés follow independent journalistic standards.",
    seven_one_rule: "For every 7 consecutive fast-tracked stories, 1 community-picked story must run next.",
    request: data,
  });
}

// GET — info about fast-tracking
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: storyRequest } = await supabase
    .from("story_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!storyRequest) {
    return Response.json({ error: "Story request not found" }, { status: 404 });
  }

  return Response.json({
    request: storyRequest,
    fast_track_price: `$${FAST_TRACK_PRICE.toFixed(2)}`,
    how_to_fast_track: `POST /api/requests/${id}/fast-track`,
    disclosure: "Fast-tracking prioritizes a topic for investigation — it does NOT influence the reporting. All First Signal exposés follow independent journalistic standards.",
  });
}
