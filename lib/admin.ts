const ADMIN_EMAILS_ENV_KEYS = ["ADMIN_EMAILS", "NEXT_PUBLIC_ADMIN_EMAILS"] as const;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getAdminEmails = () => {
  const adminEmails = ADMIN_EMAILS_ENV_KEYS.flatMap((key) =>
    (process.env[key] || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
  );

  return Array.from(new Set(adminEmails.map(normalizeEmail)));
};

export const isAdminEmail = (email?: string | null) => {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(normalizeEmail(email));
};
