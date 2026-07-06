import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export function generateApiKey(): string {
  return "tfs_" + crypto.randomBytes(24).toString("hex");
}

export async function createApiKey(email: string, balanceCents: number) {
  const key = generateApiKey();
  const { data, error } = await supabase.from("api_keys").insert({
    key,
    email,
    balance_cents: balanceCents,
  }).select().single();

  if (error) throw error;
  return data;
}

export async function topUpByEmail(email: string, balanceCents: number) {
  // Check if this email already has a key
  const { data: existing } = await supabase
    .from("api_keys")
    .select("*")
    .eq("email", email)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("api_keys")
      .update({ balance_cents: existing.balance_cents + balanceCents })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  return createApiKey(email, balanceCents);
}

export async function validateAndCharge(apiKey: string, chargeCents: number) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key", apiKey)
    .single();

  if (error || !data) {
    return { valid: false, reason: "invalid_key" } as const;
  }

  if (data.balance_cents < chargeCents) {
    return {
      valid: false,
      reason: "insufficient_balance",
      balance_cents: data.balance_cents,
    } as const;
  }

  // Deduct
  const { error: updateError } = await supabase
    .from("api_keys")
    .update({
      balance_cents: data.balance_cents - chargeCents,
      total_calls: (data.total_calls || 0) + 1,
    })
    .eq("id", data.id);

  if (updateError) {
    return { valid: false, reason: "charge_failed" } as const;
  }

  return {
    valid: true,
    balance_cents: data.balance_cents - chargeCents,
    total_calls: (data.total_calls || 0) + 1,
  } as const;
}
