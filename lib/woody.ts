import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@supabase/supabase-js";
import {
  UNIVERSAL_DIRECTIVE,
  buildOutputInstruction,
  buildNumberedSources,
  determineStatus,
} from "./universal-directive";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const FAST_TRACK_PRICE = 0.41;
const MAX_CONSECUTIVE_PAID = 7;

interface StoryRequest {
  id: number;
  topic: string;
  description: string;
  submitted_by: string;
  status: "pending" | "in_production" | "published";
  fast_tracked: boolean;
  fast_track_amount: number;
  created_at: string;
}

export async function dispatchWoody() {
  // Load Woody's config
  const { data: config } = await supabase
    .from("agent_config")
    .select("*")
    .eq("id", "woody")
    .single();

  if (!config) {
    return Response.json({ error: "Woody Bernstein not found in agent_config" }, { status: 404 });
  }

  if (!config.active) {
    return Response.json({ error: "Woody Bernstein is currently deactivated" }, { status: 403 });
  }

  // Check the 7:1 rule — count consecutive paid stories
  const { data: recentWoodyStories } = await supabase
    .from("stories")
    .select("tags")
    .eq("byline", "WOODY BERNSTEIN, Investigative Correspondent")
    .order("created_at", { ascending: false })
    .limit(MAX_CONSECUTIVE_PAID);

  const consecutivePaid = countConsecutivePaid(recentWoodyStories || []);
  const mustPickFree = consecutivePaid >= MAX_CONSECUTIVE_PAID;

  // Pick the next story request
  const request = await pickNextRequest(mustPickFree);

  if (!request) {
    return Response.json({
      error: "No story requests in the queue. Woody has nothing to investigate.",
    }, { status: 404 });
  }

  // Mark as in_production
  await supabase
    .from("story_requests")
    .update({ status: "in_production" })
    .eq("id", request.id);

  // Research the topic — deeper than regular reporters (7 results per query)
  const searchQueries = [
    `${request.topic} investigation deep dive 2026`,
    `${request.topic} controversy facts analysis`,
    `${request.topic} latest developments details`,
  ];

  const [result1, result2, result3] = await Promise.all(
    searchQueries.map((q) => tvly.search(q, { maxResults: 7 }))
  );

  const allResults = [...result1.results, ...result2.results, ...result3.results];
  const numberedSources = buildNumberedSources(allResults);
  const uniqueSources = Array.from(new Set(allResults.map((r) => r.url)));

  // Build the fast-track disclosure
  const fastTrackDisclosure = request.fast_tracked
    ? `\n\nFAST-TRACK DISCLOSURE (include at the top of your body as the first paragraph):\n"EDITOR'S NOTE: This topic was fast-tracked for investigation by ${request.submitted_by}. Fast-tracking prioritizes a topic for investigation — it does not influence the reporting. All First Signal exposés follow independent journalistic standards."\n`
    : "";

  const tone = config.tone || "investigative long-form journalism";
  const extraInstructions = config.instructions || "";
  const outputInstruction = buildOutputInstruction("investigative", "WOODY BERNSTEIN, Investigative Correspondent");

  // Write the expose
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 5000,
    messages: [
      {
        role: "user",
        content: `${UNIVERSAL_DIRECTIVE}

---

You are WOODY BERNSTEIN, Investigative Correspondent for The First Signal.
BEAT: investigative
TONE: ${tone}

You are writing a deep-dive exposé on a topic submitted by a reader/agent.

TOPIC: ${request.topic}
DESCRIPTION: ${request.description}
SUBMITTED BY: ${request.submitted_by}
${fastTrackDisclosure}
${extraInstructions ? `EDITOR INSTRUCTIONS: ${extraInstructions}\n` : ""}

SPECIAL WOODY RULES (in addition to universal directive):
- This is a DEEP DIVE. Write 6-8 substantial paragraphs in the body, not 4-5.
- Follow investigative journalism standards — thorough, fair, evidence-based, unflinching.
- If the topic turns out to be unsubstantiated, report THAT finding honestly.
- You never produce puff pieces regardless of payment.
- Name sources where possible. Cite data aggressively.

NUMBERED RESEARCH SOURCES (use [src:N] tags to cite these):
${numberedSources}

${outputInstruction}

OVERRIDE for body field: Write 6-8 paragraphs (not 4-5). This is an investigative exposé.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "No text in Claude response" }, { status: 500 });
  }

  const story = JSON.parse(textBlock.text);
  const verification = story.verification || {};
  const status = determineStatus({
    unsourced_numbers: verification.unsourced_numbers ?? 0,
    confidence: verification.confidence ?? 0.70,
  });

  // Build tags
  const tags = [
    ...(story.tags || []),
    "woody-bernstein",
    "investigative",
    ...(request.fast_tracked ? ["fast-tracked"] : []),
  ];

  // Save to stories
  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat: "investigative",
      status,
      byline: "WOODY BERNSTEIN, Investigative Correspondent",
      tags,
      signal_type: story.signal_type || null,
      data_block: story.data_block || null,
      conflict_detected: story.conflict_detected || false,
      conflict_block: story.conflict_block || null,
      entities: story.entities || [],
      confidence: verification.confidence ?? null,
      caveat_required: verification.caveat_required || false,
      data_freshness_hrs: story.data_freshness_hrs ?? null,
      unsourced_numbers: verification.unsourced_numbers ?? 0,
      numbers_in_story: verification.numbers_in_story ?? 0,
      numbers_sourced: verification.numbers_sourced ?? 0,
      sources_checked: verification.sources_checked ?? 0,
      source_quality: verification.source_quality || null,
      relevant_to: story.relevant_to || [],
      action_signal: story.action_signal || null,
      time_sensitivity: story.time_sensitivity || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to save story", details: error.message }, { status: 500 });
  }

  // Mark the request as published
  await supabase
    .from("story_requests")
    .update({ status: "published", published_story_id: data.id })
    .eq("id", request.id);

  return Response.json({
    message: "Woody Bernstein has filed an investigative exposé",
    request_topic: request.topic,
    fast_tracked: request.fast_tracked,
    seven_one_rule: mustPickFree ? "FREE STORY (7:1 rule triggered)" : `${consecutivePaid}/${MAX_CONSECUTIVE_PAID} consecutive paid`,
    status,
    signal_type: story.signal_type,
    confidence: verification.confidence,
    story: data,
  });
}

async function pickNextRequest(mustPickFree: boolean): Promise<StoryRequest | null> {
  if (mustPickFree) {
    const { data } = await supabase
      .from("story_requests")
      .select("*")
      .eq("status", "pending")
      .eq("fast_tracked", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    return data;
  }

  const { data: paidRequest } = await supabase
    .from("story_requests")
    .select("*")
    .eq("status", "pending")
    .eq("fast_tracked", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (paidRequest) return paidRequest;

  const { data: freeRequest } = await supabase
    .from("story_requests")
    .select("*")
    .eq("status", "pending")
    .eq("fast_tracked", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return freeRequest;
}

function countConsecutivePaid(stories: { tags: string[] }[]): number {
  let count = 0;
  for (const story of stories) {
    if (story.tags && story.tags.includes("fast-tracked")) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export { FAST_TRACK_PRICE };
