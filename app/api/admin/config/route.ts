import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("agent_config")
    .select("*")
    .order("id");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const agentId = body.id;

  if (!agentId) {
    return Response.json({ error: "Missing agent id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agent_config")
    .update({
      tone: body.tone,
      focus: body.focus,
      instructions: body.instructions,
      active: body.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
