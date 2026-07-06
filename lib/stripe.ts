import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-05-27.dahlia",
    });
  }
  return _stripe;
}

export const PRICE_PER_CALL = 0.00041;

export const CREDIT_PACKS = [
  { amount: 100, label: "$1", calls: Math.floor(100 / (PRICE_PER_CALL * 100)) },
  { amount: 500, label: "$5", calls: Math.floor(500 / (PRICE_PER_CALL * 100)) },
  { amount: 1000, label: "$10", calls: Math.floor(1000 / (PRICE_PER_CALL * 100)) },
] as const;
