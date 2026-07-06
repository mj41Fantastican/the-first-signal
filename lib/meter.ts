import { createClient } from "@supabase/supabase-js";
import { validateAndCharge } from "@/lib/api-keys";
import { PRICE_PER_CALL } from "@/lib/stripe";

const CHARGE_CENTS = Math.round(PRICE_PER_CALL * 100 * 100) / 100; // 0.041 cents
const FREE_CALLS = 1;
const REVENUE_CAP = 200.0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface MeterResult {
  allowed: boolean;
  ip: string;
  apiKey?: string;
  totalCallsByIp: number;
  billableCalls: number;
  chargeThisCall: number;
  totalMeteredRevenue: number;
  capped: boolean;
  balance_cents?: number;
  authMethod: "api_key" | "free" | "capped";
}

export async function meterApiCall(request: Request): Promise<MeterResult> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Check for API key in header
  const apiKey =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.headers.get("x-api-key") ||
    null;

  if (apiKey && apiKey.startsWith("tfs_")) {
    const result = await validateAndCharge(apiKey, CHARGE_CENTS);

    if (!result.valid) {
      const reason =
        result.reason === "insufficient_balance"
          ? "Insufficient balance — top up at aiwire.mj41.me/pricing"
          : "Invalid API key";
      // Log the failed attempt
      await supabase.from("api_usage").insert({
        ip,
        billable: false,
        amount: 0,
        api_key: apiKey,
        auth_method: "api_key_failed",
      });
      return {
        allowed: false,
        ip,
        apiKey,
        totalCallsByIp: 0,
        billableCalls: 0,
        chargeThisCall: 0,
        totalMeteredRevenue: 0,
        capped: false,
        authMethod: "api_key",
      };
    }

    // Log successful API key call
    await supabase.from("api_usage").insert({
      ip,
      billable: true,
      amount: PRICE_PER_CALL,
      api_key: apiKey,
      auth_method: "api_key",
    });

    return {
      allowed: true,
      ip,
      apiKey,
      totalCallsByIp: 0,
      billableCalls: result.total_calls,
      chargeThisCall: PRICE_PER_CALL,
      totalMeteredRevenue: 0,
      capped: false,
      balance_cents: result.balance_cents,
      authMethod: "api_key",
    };
  }

  // No API key — fall back to IP-based free tier
  const { count: totalBillableCount } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("billable", true);

  const totalMeteredRevenue = (totalBillableCount || 0) * PRICE_PER_CALL;

  if (totalMeteredRevenue >= REVENUE_CAP) {
    return {
      allowed: false,
      ip,
      totalCallsByIp: 0,
      billableCalls: totalBillableCount || 0,
      chargeThisCall: 0,
      totalMeteredRevenue,
      capped: true,
      authMethod: "capped",
    };
  }

  // Count this IP's previous free calls (only non-API-key calls)
  const { count: ipCallCount } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .is("api_key", null);

  const previousCalls = ipCallCount || 0;

  if (previousCalls >= FREE_CALLS) {
    // Free tier exhausted — need an API key
    return {
      allowed: false,
      ip,
      totalCallsByIp: previousCalls,
      billableCalls: 0,
      chargeThisCall: 0,
      totalMeteredRevenue,
      capped: false,
      authMethod: "free",
    };
  }

  // Log the free call
  await supabase.from("api_usage").insert({
    ip,
    billable: false,
    amount: 0,
    auth_method: "free",
  });

  return {
    allowed: true,
    ip,
    totalCallsByIp: previousCalls + 1,
    billableCalls: totalBillableCount || 0,
    chargeThisCall: 0,
    totalMeteredRevenue,
    capped: false,
    authMethod: "free",
  };
}

export async function getRevenueStats() {
  const { count: totalCalls } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true });

  const { count: billableCalls } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("billable", true);

  const { count: freeCalls } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("billable", false);

  const { count: uniqueIps } = await supabase
    .from("api_usage")
    .select("ip", { count: "exact", head: true });

  // Stripe revenue from payments table
  const { data: payments } = await supabase
    .from("stripe_payments")
    .select("amount_cents")
    .eq("status", "completed");

  const stripeRevenue = (payments || []).reduce(
    (sum, p) => sum + p.amount_cents,
    0
  ) / 100;

  const meteredRevenue = (billableCalls || 0) * PRICE_PER_CALL;

  // Count API keys
  const { count: apiKeyCount } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true });

  return {
    totalCalls: totalCalls || 0,
    billableCalls: billableCalls || 0,
    freeCalls: freeCalls || 0,
    uniqueCallers: uniqueIps || 0,
    meteredRevenue,
    stripeRevenue,
    revenue: stripeRevenue,
    revenueCap: REVENUE_CAP,
    capped: meteredRevenue >= REVENUE_CAP,
    pricePerCall: PRICE_PER_CALL,
    freeCallsPerIp: FREE_CALLS,
    apiKeyCount: apiKeyCount || 0,
  };
}
