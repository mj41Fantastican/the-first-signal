import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@supabase/supabase-js";

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

  const researchBrief = allResults
    .map((r) => `[${r.title}] ${r.content} (Source: ${r.url})`)
    .join("\n\n");

  const sourceUrls = allResults.map((r) => r.url);
  const uniqueSources = Array.from(new Set(sourceUrls));

  // Build prompt
  const avoidSection = recentHeadlines
    ? `\n\nRECENT STORIES ALREADY FILED (DO NOT repeat these angles, find a fresh angle):\n${recentHeadlines}\n`
    : "";

  const customSection = extraInstructions
    ? `\n\nADDITIONAL EDITOR INSTRUCTIONS:\n${extraInstructions}\n`
    : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are ${byline} for The First Signal, an agentic news organization. Write a structured news story about ${beat} based on this research:

${researchBrief}
${avoidSection}${customSection}
Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "headline": "A compelling, specific news headline about ${beat}",
  "summary": "Exactly 2 sentences summarizing the key news.",
  "body": "A 4-5 paragraph news story. Each paragraph should be separated by two newlines.",
  "tags": ["tag1", "tag2", "tag3"]
}

Requirements:
- The headline must be specific and newsworthy, not generic
- Find a FRESH angle that differs from any recent stories listed above
- The summary must be exactly 2 sentences
- The body must be 4-5 paragraphs of ${tone}
- Focus areas: ${focus}
- Include specific data points from the research
- Include 3-5 relevant tags as an array of lowercase strings
- Write only valid JSON`,
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

  // Save to Supabase
  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat,
      status: "filed",
      byline,
      tags: story.tags,
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
    story: data,
  });
}
