import { getStripe } from "@/lib/stripe";
import { topUpByEmail } from "@/lib/api-keys";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.metadata?.email || session.customer_email;
    const creditCents = Number(session.metadata?.credit_cents || 0);

    if (email && creditCents > 0) {
      // Check for duplicate
      const { data: existing } = await supabase
        .from("stripe_payments")
        .select("id")
        .eq("stripe_session_id", session.id)
        .single();

      if (!existing) {
        await topUpByEmail(email, creditCents);

        await supabase.from("stripe_payments").insert({
          stripe_session_id: session.id,
          email,
          amount_cents: creditCents,
          status: "completed",
        });
      }
    }
  }

  return Response.json({ received: true });
}
