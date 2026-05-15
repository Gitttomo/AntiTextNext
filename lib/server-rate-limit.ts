import "server-only";

import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const getClientIpAddress = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
};

export async function checkServerRateLimit(options: {
  scope: string;
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await (supabase as any).rpc("check_api_rate_limit", {
    rate_scope: options.scope,
    rate_key: options.identifier,
    max_requests: options.maxRequests,
    window_seconds: options.windowSeconds,
  });

  if (error) {
    console.error("Failed to check API rate limit:", error);
    return false;
  }

  return Boolean(data);
}
