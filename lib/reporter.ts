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

export async function dispatchReporter(agentId: string) {
  // Load agent config
  const { data: config } = await supabase
    .from("agent_config")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!config) {
    return Response.json({ error: `Agent "${agentId}" not found` }, { status: 404 });
  }

  if (!config.active) {
    return Response.json(
      { error: `${config.display_name} is currently deactivated` },
      { status: 403 }
    );
  }

  const tone = config.tone || "professional financial journalism";
  const focus = config.focus || "";
  const beat = config.beat || agentId;
  const byline = config.display_name || agentId;
  const extraInstructions = config.instructions || "";

  // Pull last 3 headlines for this beat to avoid repeating angles
  const { data: recentStories } = await supabase
    .from("stories")
    .select("headline, summary")
    .eq("beat", beat)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentHeadlines = (recentStories || [])
    .map((s: { headline: string; summary: string }, i: number) => `${i + 1}. "${s.headline}" — ${s.summary}`)
    .join("\n");

  // Build search queries from focus areas
  const focusTerms = focus.split(",").map((t: string) => t.trim()).filter(Boolean);
  const searchQueries = [
    `${focusTerms[0] || beat} latest news today 2026`,
    `${focusTerms[1] || beat} market trends this week`,
    `${focusTerms.slice(2).join(" ") || beat} industry analysis developments`,
  ];

  const [result1, result2, result3] = await Promise.all(
    searchQueries.map((q) => tvly.search(q, { maxResults: 5 }))
  );

  const allResults = [
    ...result1.results,
    ...result2.results,
    ...result3.results,
  ];

  const numberedSources = buildNumberedSources(allResults);
  const sourceUrls = allResults.map((r) => r.url);
  const uniqueSources = Array.from(new Set(sourceUrls));

  // Build prompt sections
  const avoidSection = recentHeadlines
    ? `\n\nRECENT STORIES ALREADY FILED (DO NOT repeat these angles, find a fresh angle):\n${recentHeadlines}\n`
    : "";

  const customSection = extraInstructions
    ? `\n\nBEAT-SPECIFIC INSTRUCTIONS:\n${extraInstructions}\n`
    : "";

  const outputInstruction = buildOutputInstruction(beat, byline);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `${UNIVERSAL_DIRECTIVE}

---

You are ${byline} for The First Signal.
BEAT: ${beat}
TONE: ${tone}
FOCUS AREAS: ${focus}
${avoidSection}${customSection}

NUMBERED RESEARCH SOURCES (use [src:N] tags to cite these):
${numberedSources}

${outputInstruction}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json(
      { error: "No text in Claude response" },
      { status: 500 }
    );
  }

  const story = JSON.parse(textBlock.text);
  const verification = story.verification || {};
  const status = determineStatus({
    unsourced_numbers: verification.unsourced_numbers ?? 0,
    confidence: verification.confidence ?? 0.70,
  });

  // Save to Supabase
  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat,
      status,
      byline,
      tags: story.tags || [],
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
    return Response.json(
      { error: "Supabase insert failed", details: error.message },
      { status: 500 }
    );
  }

  return Response.json({
    message: "Story filed successfully",
    status,
    signal_type: story.signal_type,
    confidence: verification.confidence,
    caveat_required: verification.caveat_required,
    story: data,
  });
}
