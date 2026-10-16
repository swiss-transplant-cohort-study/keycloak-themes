import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";

/** One application role a user holds. `clientId` is absent for a realm role. */
export type Grant = { clientId?: string; role: string };

/**
 * Where a user is in the STCS onboarding flow: register -> confirm email -> an admin
 * grants a role. Exactly one applies to each user, checked in this order.
 */
export type UserStatus = "disabled" | "active" | "unverified" | "pending";

export const statusOf = (user: UserRepresentation, grants: Grant[]): UserStatus => {
  if (!user.enabled) return "disabled";
  if (grants.length > 0) return "active";
  if (!user.emailVerified) return "unverified";
  return "pending";
};

/**
 * The card / dropdown filters. Unlike UserStatus these may overlap: "noRole" covers
 * both users still confirming their email and users waiting for review.
 */
export type StatusFilter =
  | "all"
  | "unverified"
  | "noRole"
  | "pending"
  | "active"
  | "disabled";

export const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "unverified",
  "noRole",
  "pending",
  "active",
  "disabled",
];

export const matchesStatus = (
  filter: StatusFilter,
  user: UserRepresentation,
  grants: Grant[],
): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "unverified":
      return !!user.enabled && !user.emailVerified;
    case "noRole":
      return !!user.enabled && grants.length === 0;
    case "pending":
      return !!user.enabled && !!user.emailVerified && grants.length === 0;
    case "active":
      return !!user.enabled && grants.length > 0;
    case "disabled":
      return !user.enabled;
  }
};

/** Filters that need role membership, which is unavailable for very large realms. */
export const needsGrants = (filter: StatusFilter) =>
  filter === "noRole" || filter === "pending" || filter === "active";

export const grantLabel = (grant: Grant) =>
  grant.clientId ? `${grant.clientId} · ${grant.role}` : grant.role;

export type RegisteredFilter = "any" | "7" | "30" | "90";

export const matchesRegistered = (filter: RegisteredFilter, user: UserRepresentation) => {
  if (filter === "any") return true;
  if (!user.createdTimestamp) return false;
  return user.createdTimestamp >= Date.now() - Number(filter) * 24 * 60 * 60 * 1000;
};

export const matchesSearch = (search: string, user: UserRepresentation) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [user.username, user.email, user.firstName, user.lastName]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(needle));
};
