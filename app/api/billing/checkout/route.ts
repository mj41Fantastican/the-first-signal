import { getStripe, CREDIT_PACKS, PRICE_PER_CALL } from "@/lib/stripe";

export async function POST(request: Request) {
  const { pack, email } = await request.json();

  const creditPack = CREDIT_PACKS[pack as number];
  if (!creditPack || !email) {
    return Response.json({ error: "Invalid pack or missing email" }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `The First Signal — ${creditPack.label} API Credits`,
            description: `${creditPack.calls.toLocaleString()} API calls at $${PRICE_PER_CALL}/call`,
          },
          unit_amount: creditPack.amount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_URL || "https://aiwire.mj41.me"}/pricing?success=true&email=${encodeURIComponent(email)}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL || "https://aiwire.mj41.me"}/pricing?canceled=true`,
    metadata: {
      credit_cents: String(creditPack.amount),
      email,
    },
  });

  return Response.json({ url: session.url });
}
