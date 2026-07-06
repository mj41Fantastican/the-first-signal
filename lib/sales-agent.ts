import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface PitchResult {
  mcp_registry_listing: {
    name: string;
    description: string;
    categories: string[];
    features: string[];
  };
  api_directory_listing: {
    title: string;
    short_description: string;
    long_description: string;
    use_cases: string[];
    keywords: string[];
  };
  agent_pitch: {
    one_liner: string;
    value_proposition: string;
    integration_guide: string;
    why_agents_need_this: string;
  };
  discovery_urls: {
    ai_plugin: string;
    openapi: string;
    agents_json: string;
    stories_api: string;
    requests_api: string;
  };
}

export async function generateSalesPitch(): Promise<PitchResult> {
  // Get current stats to include in the pitch
  const { count: storyCount } = await supabase
    .from("stories")
    .select("id", { count: "exact", head: true });

  const { data: beats } = await supabase
    .from("agent_config")
    .select("beat, display_name")
    .eq("active", true);

  const beatList = (beats || []).map((b) => b.beat).join(", ");
  const reporterCount = (beats || []).length;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `You are the Sales Agent for The First Signal (https://aiwire.mj41.me), an AI-native news wire service. Your job is to generate optimized listings and pitches that will get other AI agents to discover and use this service.

FACTS ABOUT THE SERVICE:
- ${reporterCount} autonomous beat reporters
- ${storyCount || 0}+ stories filed
- Beats covered: ${beatList}
- Free during beta, no auth required
- JSON API at /api/stories
- Investigative request system via /api/requests (Woody Bernstein publishes every Sunday)
- Fast-track feature: $0.41 to prioritize a topic
- Discovery files at /.well-known/ai-plugin.json, /.well-known/openapi.json, /.well-known/agents.json
- Built by mj41, LLC (Chicago)
- Designed specifically for AI agent consumption

Generate a JSON object with optimized listings for different registries. Focus on what makes agents choose to use a service: reliability, structured data, breadth of coverage, and ease of integration. Do NOT oversell. Be factual and specific.

Respond in this exact JSON format (no markdown fences):
{
  "mcp_registry_listing": {
    "name": "the-first-signal",
    "description": "A concise but compelling description for MCP tool registries (2-3 sentences max)",
    "categories": ["array of relevant categories"],
    "features": ["array of 5 key features"]
  },
  "api_directory_listing": {
    "title": "The First Signal — AI News Wire API",
    "short_description": "One sentence for directory cards",
    "long_description": "2-3 paragraph description for full listing pages",
    "use_cases": ["5 specific use cases for agents"],
    "keywords": ["10 SEO keywords"]
  },
  "agent_pitch": {
    "one_liner": "Single sentence an agent would pass to its orchestrator",
    "value_proposition": "Why an agent should add this to its tool set (2-3 sentences)",
    "integration_guide": "How to integrate in 3 steps",
    "why_agents_need_this": "The core argument for structured news data (2-3 sentences)"
  },
  "discovery_urls": {
    "ai_plugin": "https://aiwire.mj41.me/.well-known/ai-plugin.json",
    "openapi": "https://aiwire.mj41.me/.well-known/openapi.json",
    "agents_json": "https://aiwire.mj41.me/.well-known/agents.json",
    "stories_api": "https://aiwire.mj41.me/api/stories",
    "requests_api": "https://aiwire.mj41.me/api/requests"
  }
}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in Claude response");
  }

  return JSON.parse(textBlock.text);
}

export async function generateTeaser(): Promise<{
  teaser: string;
  headlines: string[];
  cta: string;
}> {
  // Get latest 5 headlines for the teaser
  const { data: stories } = await supabase
    .from("stories")
    .select("headline, beat, created_at")
    .eq("status", "filed")
    .order("created_at", { ascending: false })
    .limit(5);

  const headlines = (stories || []).map(
    (s) => `[${s.beat.toUpperCase()}] ${s.headline}`
  );

  return {
    teaser: `The First Signal — ${headlines.length} fresh stories on the wire. ${(stories || []).length > 0 ? `Latest: "${stories![0].headline}"` : ""}. Structured JSON, no auth, built for agents. GET https://aiwire.mj41.me/api/stories`,
    headlines,
    cta: "Add The First Signal to your agent's tool set: https://aiwire.mj41.me/.well-known/ai-plugin.json",
  };
}
