import type KeycloakAdminClient from "@keycloak/keycloak-admin-client";
import { fetchWithError } from "@keycloak/keycloak-admin-client";
import type ClientRepresentation from "@keycloak/keycloak-admin-client/lib/defs/clientRepresentation";
import type GroupRepresentation from "@keycloak/keycloak-admin-client/lib/defs/groupRepresentation";
import type RoleRepresentation from "@keycloak/keycloak-admin-client/lib/defs/roleRepresentation";
import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import { useCallback, useEffect, useState } from "react";
import { useAdminClient } from "../../admin-client";
import { useRealm } from "../../context/realm-context/RealmContext";
import { getAuthorizationHeaders } from "../../utils/getAuthorizationHeaders";
import { joinPath } from "../../utils/joinPath";
import type { Grant } from "./userStatus";

// Above this many users the overview stops loading every user and every role
// membership into the browser. The cards then fall back to the counts Keycloak
// can answer directly, and the role-based filters are disabled.
export const OVERVIEW_USER_LIMIT = 5000;

const PAGE = 500;

// Clients Keycloak creates in every realm. Their roles are infrastructure (account
// self-service, admin API), not access to an STCS application, so holding one does
// not make a user "active".
const BUILT_IN_CLIENTS = new Set([
  "account",
  "account-console",
  "admin-cli",
  "broker",
  "realm-management",
  "security-admin-console",
]);

// Realm roles every user gets by default.
const isBuiltInRealmRole = (realm: string, role: RoleRepresentation) =>
  role.name === `default-roles-${realm}` ||
  role.name === "offline_access" ||
  role.name === "uma_authorization";

export type AppClient = {
  id: string;
  clientId: string;
  name: string;
  roles: RoleRepresentation[];
};

export type UserOverview = {
  /** Every user in the realm, or empty when the realm is over the limit. */
  users: UserRepresentation[];
  /** Application roles held per user id, directly or through a group. */
  grants: Map<string, Grant[]>;
  apps: AppClient[];
  realmRoles: RoleRepresentation[];
  total: number;
  /** False when the realm is too large to index in the browser. */
  complete: boolean;
  /** Server-side counts, filled even when `complete` is false. */
  unverified: number;
  disabled: number;
};

async function fetchJson<T>(
  adminClient: KeycloakAdminClient,
  realm: string,
  path: string,
  query: Record<string, string | number | boolean> = {},
): Promise<T> {
  const token = await adminClient.getAccessToken();
  const params = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)]),
  );
  const response = await fetchWithError(
    joinPath(adminClient.baseUrl, "admin/realms", encodeURIComponent(realm), path) +
      (params.size ? `?${params}` : ""),
    { method: "GET", headers: getAuthorizationHeaders(token) },
  );
  return response.json();
}

async function pageAll<T>(fetchPage: (first: number, max: number) => Promise<T[]>) {
  const all: T[] = [];
  for (let first = 0; ; first += PAGE) {
    const page = await fetchPage(first, PAGE);
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

/** A group and all of its descendants: subgroup members inherit the parent's roles. */
async function withDescendants(
  adminClient: KeycloakAdminClient,
  realm: string,
  group: GroupRepresentation,
): Promise<string[]> {
  const children = await pageAll((first, max) =>
    fetchJson<GroupRepresentation[]>(adminClient, realm, `groups/${group.id}/children`, {
      first,
      max,
      briefRepresentation: true,
    }),
  );
  const nested = await Promise.all(
    children.map((child) => withDescendants(adminClient, realm, child)),
  );
  return [group.id!, ...nested.flat()];
}

/** Ids of every user holding a role, directly or through group membership. */
async function holdersOf(
  adminClient: KeycloakAdminClient,
  realm: string,
  rolePath: string,
  groupMembers: Map<string, Promise<string[]>>,
): Promise<string[]> {
  const [direct, groups] = await Promise.all([
    pageAll((first, max) =>
      fetchJson<UserRepresentation[]>(adminClient, realm, `${rolePath}/users`, {
        first,
        max,
        briefRepresentation: true,
      }),
    ),
    pageAll((first, max) =>
      fetchJson<GroupRepresentation[]>(adminClient, realm, `${rolePath}/groups`, {
        first,
        max,
        briefRepresentation: true,
      }),
    ),
  ]);

  const groupIds = (
    await Promise.all(groups.map((g) => withDescendants(adminClient, realm, g)))
  ).flat();

  // Several roles usually point at the same groups, so each group's member list is
  // fetched once and shared.
  const members = await Promise.all(
    groupIds.map((id) => {
      if (!groupMembers.has(id)) {
        groupMembers.set(
          id,
          pageAll((first, max) =>
            fetchJson<UserRepresentation[]>(adminClient, realm, `groups/${id}/members`, {
              first,
              max,
              briefRepresentation: true,
            }),
          ).then((users) => users.map((u) => u.id!)),
        );
      }
      return groupMembers.get(id)!;
    }),
  );

  return [...direct.map((u) => u.id!), ...members.flat()];
}

async function loadOverview(
  adminClient: KeycloakAdminClient,
  realm: string,
): Promise<UserOverview> {
  const [total, unverifiedRaw, disabled, clients, realmRoles] = await Promise.all([
    fetchJson<number>(adminClient, realm, "users/count"),
    fetchJson<number>(adminClient, realm, "users/count", {
      emailVerified: false,
      enabled: true,
    }),
    fetchJson<number>(adminClient, realm, "users/count", { enabled: false }),
    fetchJson<ClientRepresentation[]>(adminClient, realm, "clients", { first: 0, max: 1000 }),
    fetchJson<RoleRepresentation[]>(adminClient, realm, "roles", { first: 0, max: 1000 }),
  ]);

  // A plain users/count leaves out service-account users, but as soon as a filter
  // like emailVerified is set Keycloak counts them too. Each client with service
  // accounts enabled owns one, enabled and never verified, so take them back out.
  const serviceAccounts = clients.filter((c) => c.serviceAccountsEnabled).length;
  const unverified = Math.max(0, unverifiedRaw - serviceAccounts);

  const apps: AppClient[] = (
    await Promise.all(
      clients
        .filter((c) => !BUILT_IN_CLIENTS.has(c.clientId!) && !c.clientId!.endsWith("-realm"))
        .map(async (c) => ({
          id: c.id!,
          clientId: c.clientId!,
          name: c.name || c.clientId!,
          roles: await fetchJson<RoleRepresentation[]>(
            adminClient,
            realm,
            `clients/${c.id}/roles`,
            { first: 0, max: 1000 },
          ),
        })),
    )
  ).sort((a, b) => a.clientId.localeCompare(b.clientId));

  const assignableRealmRoles = realmRoles
    .filter((r) => !isBuiltInRealmRole(realm, r))
    .sort((a, b) => a.name!.localeCompare(b.name!));

  const base = {
    apps,
    realmRoles: assignableRealmRoles,
    total,
    unverified,
    disabled,
  };

  if (total > OVERVIEW_USER_LIMIT) {
    return { ...base, users: [], grants: new Map(), complete: false };
  }

  const groupMembers = new Map<string, Promise<string[]>>();
  const roleTargets: { grant: Grant; path: string }[] = [
    ...assignableRealmRoles.map((r) => ({
      grant: { role: r.name! },
      path: `roles/${encodeURIComponent(r.name!)}`,
    })),
    ...apps.flatMap((app) =>
      app.roles.map((r) => ({
        grant: { clientId: app.clientId, role: r.name! },
        path: `clients/${app.id}/roles/${encodeURIComponent(r.name!)}`,
      })),
    ),
  ];

  const [users, holders] = await Promise.all([
    pageAll((first, max) =>
      fetchJson<UserRepresentation[]>(adminClient, realm, "users", {
        first,
        max,
        briefRepresentation: true,
      }),
    ),
    Promise.all(
      roleTargets.map((t) => holdersOf(adminClient, realm, t.path, groupMembers)),
    ),
  ]);

  const grants = new Map<string, Grant[]>();
  holders.forEach((userIds, i) => {
    for (const id of new Set(userIds)) {
      grants.set(id, [...(grants.get(id) ?? []), roleTargets[i].grant]);
    }
  });

  return { ...base, users, grants, complete: true };
}

export function useUserOverview() {
  const { adminClient } = useAdminClient();
  const { realm } = useRealm();
  // Tagged with its realm so a realm switch never shows the previous realm's numbers
  // while the new ones load; a plain reload keeps the old numbers on screen instead.
  const [loaded, setLoaded] = useState<{ realm: string; data: UserOverview }>();
  const [error, setError] = useState<unknown>();
  const [key, setKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    loadOverview(adminClient, realm).then(
      (data) => !cancelled && setLoaded({ realm, data }),
      (err) => !cancelled && setError(err),
    );
    return () => {
      cancelled = true;
    };
  }, [adminClient, realm, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);

  const overview = loaded?.realm === realm ? loaded.data : undefined;
  return { overview, error, reload };
}
