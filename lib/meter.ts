import { createClient } from "@supabase/supabase-js";

const PRICE_PER_CALL = 0.041;
const FREE_CALLS = 1;
const REVENUE_CAP = 200.0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface MeterResult {
  allowed: boolean;
  ip: string;
  totalCallsByIp: number;
  billableCalls: number;
  chargeThisCall: number;
  totalMeteredRevenue: number;
  capped: boolean;
}

export async function meterApiCall(request: Request): Promise<MeterResult> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Check total metered revenue first (cap check)
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
    };
  }

  // Count this IP's previous calls
  const { count: ipCallCount } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip);

  const previousCalls = ipCallCount || 0;
  const isBillable = previousCalls >= FREE_CALLS;
  const chargeThisCall = isBillable ? PRICE_PER_CALL : 0;

  // Log the call
  await supabase.from("api_usage").insert({
    ip,
    billable: isBillable,
    amount: chargeThisCall,
  });

  return {
    allowed: true,
    ip,
    totalCallsByIp: previousCalls + 1,
    billableCalls: (totalBillableCount || 0) + (isBillable ? 1 : 0),
    chargeThisCall,
    totalMeteredRevenue: totalMeteredRevenue + chargeThisCall,
    capped: false,
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

  const revenue = (billableCalls || 0) * PRICE_PER_CALL;

  return {
    totalCalls: totalCalls || 0,
    billableCalls: billableCalls || 0,
    freeCalls: freeCalls || 0,
    uniqueCallers: uniqueIps || 0,
    revenue,
    revenueCap: REVENUE_CAP,
    capped: revenue >= REVENUE_CAP,
    pricePerCall: PRICE_PER_CALL,
    freeCallsPerIp: FREE_CALLS,
  };
}
