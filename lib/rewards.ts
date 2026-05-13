export type RewardSetting = {
  enabled: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type UserBadge = {
  id: string;
  badge_type: string;
  label: string;
  note?: string | null;
};

export type RewardOverride = {
  early_registration_override?: "auto" | "force_on" | "force_off" | null;
};

export function isEarlyRegistrationEligible(createdAt?: string | null, setting?: RewardSetting | null) {
  if (!createdAt || !setting?.enabled) return false;

  const createdTime = new Date(createdAt).getTime();
  const startTime = setting.starts_at ? new Date(setting.starts_at).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = setting.ends_at ? new Date(setting.ends_at).getTime() : Number.POSITIVE_INFINITY;

  return createdTime >= startTime && createdTime <= endTime;
}

export function resolveEarlyRegistrationEligible(
  createdAt?: string | null,
  setting?: RewardSetting | null,
  override?: RewardOverride | null
) {
  if (override?.early_registration_override === "force_on") return true;
  if (override?.early_registration_override === "force_off") return false;
  return isEarlyRegistrationEligible(createdAt, setting);
}

export function getListingFrameTone(listingCount: number) {
  if (listingCount >= 20) return "navy";
  if (listingCount >= 10) return "sky";
  if (listingCount >= 5) return "green";
  if (listingCount >= 1) return "yellow";
  return "white";
}
