import { createClient } from "@supabase/supabase-js";
import { PRICE_PER_CALL } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("api_keys")
    .select("key, balance_cents, total_calls, created_at")
    .eq("email", email)
    .single();

  if (!data) {
    return Response.json({ error: "No API key found for this email" }, { status: 404 });
  }

  return Response.json({
    api_key: data.key,
    balance: `$${(data.balance_cents / 100).toFixed(2)}`,
    balance_cents: data.balance_cents,
    calls_remaining: Math.floor(data.balance_cents / (PRICE_PER_CALL * 100)),
    total_calls: data.total_calls,
    price_per_call: PRICE_PER_CALL,
    created: data.created_at,
  });
}
