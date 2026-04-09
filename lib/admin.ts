import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isAllowedAdminEmail = async (
  supabase: SupabaseClient<Database>,
  email?: string | null
) => {
  if (!email) {
    return false;
  }

  const { data, error } = await supabase.rpc("is_allowed_admin_email" as any, {
    target_email: normalizeEmail(email),
  } as any);

  if (error) {
    console.error("Failed to check admin signup email:", error);
    return false;
  }

  return Boolean(data);
};

export const isCurrentUserAdmin = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase.rpc("is_current_user_admin" as any);

  if (error) {
    console.error("Failed to check admin user:", error);
    return false;
  }

  return Boolean(data);
};

export const isRegisteredEmail = async (
  supabase: SupabaseClient<Database>,
  email?: string | null
) => {
  if (!email) {
    return false;
  }

  const { data, error } = await supabase.rpc("is_registered_email" as any, {
    target_email: normalizeEmail(email),
  } as any);

  if (error) {
    console.error("Failed to check registered email:", error);
    return false;
  }

  return Boolean(data);
};
