/**
 * This file has been claimed for ownership from @keycloakify/keycloak-admin-ui version 260502.0.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "admin/components/users/UserDataTable.tsx" --revert
 */

/* eslint-disable */

// @ts-nocheck

// STCS: this file adds the onboarding overview to the stock user list — status
// cards, status/application/registration filters, Status/Access/Created columns,
// and grant-access / resend-verification / enable-disable actions per row and in
// bulk. The pieces live in ../../stcs/users; every change in this file is marked
// "STCS" so it can be re-applied when the upstream file changes.

import type { UserProfileConfig } from "@keycloak/keycloak-admin-client/lib/defs/userProfileMetadata";
import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import {
  KeycloakDataTable,
  KeycloakSpinner,
  ListEmptyState,
  useAlerts,
  useFetch,
} from "../../../shared/keycloak-ui-shared";
import {
  AlertVariant,
  Button,
  ButtonVariant,
  Chip,
  ChipGroup,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  FlexItem,
  Label,
  MenuToggle,
  Text,
  TextContent,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from "../../../shared/@patternfly/react-core";
import {
  ExclamationCircleIcon,
  InfoCircleIcon,
  WarningTriangleIcon,
} from "../../../shared/@patternfly/react-icons";
import type { IRowData } from "../../../shared/@patternfly/react-table";
import { JSX, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAdminClient } from "../../admin-client";
import { fetchRealmInfo } from "../../context/auth/admin-ui-endpoint";
import { UiRealmInfo } from "../../context/auth/uiRealmInfo";
import { useRealm } from "../../context/realm-context/RealmContext";
import { SearchType } from "../../user/details/SearchFilter";
import { toAddUser } from "../../user/routes/AddUser";
import { toUser } from "../../user/routes/User";
import { emptyFormatter } from "../../util";
import { useConfirmDialog } from "../confirm-dialog/ConfirmDialog";
import { BruteUser, findUsers } from "../role-mapping/resource";
import { UserDataTableToolbarItems } from "./UserDataTableToolbarItems";
import { NetworkError } from "@keycloak/keycloak-admin-client";
// STCS
import { FilterSelect } from "../../stcs/users/FilterSelect";
import { GrantAccessModal } from "../../stcs/users/GrantAccessModal";
import { AccessCell, CreatedCell, StatusLabel } from "../../stcs/users/UserCells";
import { UserStatusCards } from "../../stcs/users/UserStatusCards";
import { OVERVIEW_USER_LIMIT, useUserOverview } from "../../stcs/users/useUserOverview";
import {
  matchesRegistered,
  matchesSearch,
  matchesStatus,
  needsGrants,
  RegisteredFilter,
  STATUS_FILTERS,
  StatusFilter,
  statusOf,
} from "../../stcs/users/userStatus";

export type UserFilter = {
  exact: boolean;
  userAttribute: UserAttribute[];
};

export type UserAttribute = {
  name: string;
  displayName: string;
  value: string;
};

const UserDetailLink = (user: BruteUser) => {
  const { t } = useTranslation();
  const { realm } = useRealm();
  return (
    <>
      <Link to={toUser({ realm, id: user.id!, tab: "settings" })}>
        {user.username}
        <StatusRow user={user} />
      </Link>
      {user.attributes?.["is_temporary_admin"]?.[0] === "true" && (
        <Tooltip content={t("temporaryAdmin")}>
          <WarningTriangleIcon
            className="pf-v5-u-ml-sm"
            id="temporary-admin-label"
          />
        </Tooltip>
      )}
    </>
  );
};

type StatusRowProps = {
  user: BruteUser;
};

// STCS: the "Disabled" label moved to the Status column; only the brute-force lock,
// which the Status column does not show, stays next to the username.
const StatusRow = ({ user }: StatusRowProps) => {
  const { t } = useTranslation();
  return (
    <>
      {user.bruteForceStatus?.disabled && (
        <Label color="orange" icon={<WarningTriangleIcon />}>
          {t("temporaryLocked")}
        </Label>
      )}
    </>
  );
};

const ValidatedEmail = (user: UserRepresentation) => {
  const { t } = useTranslation();
  return (
    <>
      {!user.emailVerified && (
        <Tooltip content={t("notVerified")}>
          <ExclamationCircleIcon className="keycloak__user-section__email-verified" />
        </Tooltip>
      )}{" "}
      {emptyFormatter()(user.email) as JSX.Element}
    </>
  );
};

export function UserDataTable() {
  const { adminClient } = useAdminClient();

  const { t } = useTranslation();
  const { addAlert, addError } = useAlerts();
  const { realm: realmName, realmRepresentation: realm } = useRealm();
  const navigate = useNavigate();
  const [uiRealmInfo, setUiRealmInfo] = useState<UiRealmInfo>({});
  const [searchUser, setSearchUser] = useState("");
  const [selectedRows, setSelectedRows] = useState<UserRepresentation[]>([]);
  const [searchType, setSearchType] = useState<SearchType>("default");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<UserFilter>({
    exact: false,
    userAttribute: [],
  });
  const [profile, setProfile] = useState<UserProfileConfig>({});
  const [query, setQuery] = useState("");

  const [key, setKey] = useState(0);
  // STCS: functional update, because refresh is also called from effects and async
  // action handlers that hold a stale `key`.
  const refresh = () => setKey((k) => k + 1);

  // STCS: onboarding overview state
  const { overview, error: overviewError, reload: reloadOverview } = useUserOverview();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [appFilter, setAppFilter] = useState("any");
  const [registeredFilter, setRegisteredFilter] = useState<RegisteredFilter>("any");
  const [grantTargets, setGrantTargets] = useState<UserRepresentation[]>();
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (overviewError) addError("stcsOverviewError", overviewError);
  }, [overviewError]);

  // Rows and the Status/Access columns are derived from the overview, so redraw the
  // table whenever it (re)loads.
  useEffect(() => {
    refresh();
  }, [overview]);

  const grantsOf = (user: UserRepresentation) =>
    overview?.complete ? (overview.grants.get(user.id!) ?? []) : undefined;

  const hasStcsFilter =
    statusFilter !== "all" || appFilter !== "any" || registeredFilter !== "any";

  // With a filter set and the realm fully indexed, the list is filtered in the
  // browser from the overview. Otherwise it is the stock server-side search.
  const localMode = hasStcsFilter && !!overview?.complete;

  const localRows = (search: string) =>
    overview!.users
      .filter((u) => {
        const grants = overview!.grants.get(u.id!) ?? [];
        return (
          matchesStatus(statusFilter, u, grants) &&
          (appFilter === "any" || grants.some((g) => g.clientId === appFilter)) &&
          matchesRegistered(registeredFilter, u) &&
          matchesSearch(search, u)
        );
      })
      .sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0));

  const setStcsFilter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setSelectedRows([]);
    refresh();
  };

  const clearStcsFilters = () => {
    setStatusFilter("all");
    setAppFilter("any");
    setRegisteredFilter("any");
    setSelectedRows([]);
    refresh();
  };

  const afterAction = () => {
    setSelectedRows([]);
    reloadOverview();
    refresh();
  };

  const resendVerification = async (users: UserRepresentation[]) => {
    const targets = users.filter((u) => u.email && !u.emailVerified && u.enabled);
    if (targets.length === 0) {
      addAlert(t("stcsNothingToResend"), AlertVariant.info);
      return;
    }
    try {
      for (const user of targets) {
        await adminClient.users.sendVerifyEmail({ id: user.id! });
      }
      addAlert(
        t("stcsVerificationSent", { count: targets.length }),
        AlertVariant.success,
      );
    } catch (error) {
      addError("stcsVerificationError", error);
    }
  };

  const setEnabled = async (users: UserRepresentation[], enabled: boolean) => {
    const targets = users.filter((u) => !!u.enabled !== enabled);
    try {
      for (const user of targets) {
        // Send the full representation: a partial PUT can trip user-profile
        // validation on realms with required attributes.
        const full = await adminClient.users.findOne({ id: user.id! });
        await adminClient.users.update({ id: user.id! }, { ...full, enabled });
      }
      addAlert(
        t(enabled ? "stcsUsersEnabled" : "stcsUsersDisabled", { count: targets.length }),
        AlertVariant.success,
      );
      afterAction();
    } catch (error) {
      addError("stcsUpdateError", error);
    }
  };
  // STCS end

  useFetch(
    async () => {
      try {
        return await Promise.all([
          fetchRealmInfo(adminClient),
          adminClient.users.getProfile(),
        ]);
      } catch (error) {
        if (error instanceof NetworkError && error?.response?.status === 403) {
          // "User Profile" attributes not available for Users Attribute search, when admin user does not have view- or manage-realm realm-management role
          return [{}, {}] as [UiRealmInfo, UserProfileConfig];
        } else {
          throw error;
        }
      }
    },
    ([uiRealmInfo, profile]) => {
      setUiRealmInfo(uiRealmInfo);
      setProfile(profile);
    },
    [],
  );

  const loader = async (first?: number, max?: number, search?: string) => {
    // STCS: filtered view, paged in the browser
    if (localMode) {
      return localRows(search || searchUser || "").slice(first!, first! + max!);
    }

    const params: { [name: string]: string | number | boolean } = {
      first: first!,
      max: max!,
      q: query!,
    };

    const searchParam = search || searchUser || "";
    if (searchParam) {
      params.search = searchParam;
    }

    if (activeFilters.exact) params.exact = true;

    // STCS: realms too large to index still get the two filters Keycloak can apply
    // server-side.
    if (statusFilter === "unverified") {
      params.emailVerified = false;
      params.enabled = true;
    }
    if (statusFilter === "disabled") params.enabled = false;

    if (!listUsers && !(params.search || params.q)) {
      return [];
    }

    try {
      const users = await findUsers(adminClient, {
        briefRepresentation: true,
        ...params,
      });
      // STCS: with emailVerified/enabled set, Keycloak also returns the clients'
      // service-account users, which are not people. Dropping them here can make a
      // page a few rows short; only the large-realm path reaches this.
      return statusFilter === "all"
        ? users
        : users.filter((u) => !u.username?.startsWith("service-account-"));
    } catch (error) {
      if (uiRealmInfo.userProfileProvidersEnabled) {
        addError("noUsersFoundErrorStorage", error);
      } else {
        addError("noUsersFoundError", error);
      }
      return [];
    }
  };

  const [toggleUnlockUsersDialog, UnlockUsersConfirm] = useConfirmDialog({
    titleKey: "unlockAllUsers",
    messageKey: "unlockUsersConfirm",
    continueButtonLabel: "unlock",
    onConfirm: async () => {
      try {
        await adminClient.attackDetection.delAll();
        refresh();
        addAlert(t("unlockUsersSuccess"), AlertVariant.success);
      } catch (error) {
        addError("unlockUsersError", error);
      }
    },
  });

  const [toggleDeleteDialog, DeleteConfirm] = useConfirmDialog({
    titleKey: t("deleteConfirmUsers", {
      count: selectedRows.length,
      name: selectedRows[0]?.username,
    }),
    messageKey: t("deleteConfirmDialog", { count: selectedRows.length }),
    continueButtonLabel: "delete",
    continueButtonVariant: ButtonVariant.danger,
    onConfirm: async () => {
      try {
        for (const user of selectedRows) {
          await adminClient.users.del({ id: user.id! });
        }
        setSelectedRows([]);
        clearAllFilters();
        reloadOverview(); // STCS
        addAlert(t("userDeletedSuccess"), AlertVariant.success);
      } catch (error) {
        addError("userDeletedError", error);
      }
    },
  });

  const goToCreate = () => navigate(toAddUser({ realm: realmName }));

  if (uiRealmInfo.userProfileProvidersEnabled === undefined || !realm) {
    return <KeycloakSpinner />;
  }

  //should *only* list users when no user federation is configured
  const listUsers = !uiRealmInfo.userProfileProvidersEnabled;

  const clearAllFilters = () => {
    setActiveFilters({ exact: false, userAttribute: [] });
    setSearchUser("");
    setQuery("");
    refresh();
  };

  const createQueryString = (filters: UserFilter) => {
    return filters.userAttribute
      .map((filter) => `${filter.name}:${filter.value}`)
      .join(" ");
  };

  const searchUserWithAttributes = () => {
    const attributes = createQueryString(activeFilters);
    setQuery(attributes);
    refresh();
  };

  const createAttributeSearchChips = () => {
    return (
      <FlexItem>
        {activeFilters.userAttribute.length > 0 && (
          <>
            {Object.values(activeFilters.userAttribute).map((entry) => {
              return (
                <ChipGroup
                  className="pf-v5-u-mt-md pf-v5-u-mr-md"
                  data-testid="user-attribute-search-chips-group"
                  key={entry.name}
                  categoryName={
                    entry.displayName.length ? entry.displayName : entry.name
                  }
                  isClosable
                  onClick={(event) => {
                    event.stopPropagation();

                    const filtered = [...activeFilters.userAttribute].filter(
                      (chip) => chip.name !== entry.name,
                    );
                    const active = {
                      userAttribute: filtered,
                      exact: activeFilters.exact,
                    };

                    setActiveFilters(active);
                    setQuery(createQueryString(active));
                    refresh();
                  }}
                >
                  <Chip key={entry.name} isReadOnly>
                    {entry.value}
                  </Chip>
                </ChipGroup>
              );
            })}
          </>
        )}
      </FlexItem>
    );
  };

  // STCS: bulk actions for the selected rows
  const bulkActions = (
    <ToolbarItem>
      <Dropdown
        isOpen={bulkOpen}
        onOpenChange={setBulkOpen}
        toggle={(ref) => (
          <MenuToggle
            ref={ref}
            data-testid="stcs-bulk-actions"
            isExpanded={bulkOpen}
            isDisabled={selectedRows.length === 0}
            onClick={() => setBulkOpen(!bulkOpen)}
          >
            {selectedRows.length
              ? t("stcsBulkActionsCount", { count: selectedRows.length })
              : t("stcsBulkActions")}
          </MenuToggle>
        )}
        shouldFocusToggleOnSelect
      >
        <DropdownList>
          <DropdownItem
            key="grant"
            isDisabled={!overview}
            onClick={() => {
              setBulkOpen(false);
              setGrantTargets(selectedRows);
            }}
          >
            {t("stcsGrantAccessEllipsis")}
          </DropdownItem>
          <DropdownItem
            key="verify"
            onClick={() => {
              setBulkOpen(false);
              resendVerification(selectedRows);
            }}
          >
            {t("stcsResendVerification")}
          </DropdownItem>
          <DropdownItem
            key="enable"
            onClick={() => {
              setBulkOpen(false);
              setEnabled(selectedRows, true);
            }}
          >
            {t("stcsEnable")}
          </DropdownItem>
          <DropdownItem
            key="disable"
            onClick={() => {
              setBulkOpen(false);
              setEnabled(selectedRows, false);
            }}
          >
            {t("stcsDisable")}
          </DropdownItem>
        </DropdownList>
      </Dropdown>
    </ToolbarItem>
  );

  const toolbar = () => {
    return (
      <>
        <UserDataTableToolbarItems
          searchDropdownOpen={searchDropdownOpen}
          setSearchDropdownOpen={setSearchDropdownOpen}
          realm={realm}
          hasSelectedRows={selectedRows.length === 0}
          toggleDeleteDialog={toggleDeleteDialog}
          toggleUnlockUsersDialog={toggleUnlockUsersDialog}
          goToCreate={goToCreate}
          searchType={searchType}
          setSearchType={setSearchType}
          searchUser={searchUser}
          setSearchUser={setSearchUser}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          refresh={refresh}
          profile={profile}
          clearAllFilters={clearAllFilters}
          createAttributeSearchChips={createAttributeSearchChips}
          searchUserWithAttributes={searchUserWithAttributes}
        />
        {bulkActions}
      </>
    );
  };

  // STCS: status / application / registration filters, always shown under the
  // toolbar. Attribute-search chips, when present, follow them.
  const rolesUnavailable = !!overview && !overview.complete;
  const tooManyReason = t("stcsUsersTooManyForRoles", {
    limit: OVERVIEW_USER_LIMIT.toLocaleString(),
  });
  const stcsFilters = (
    <div className="stcs-user-filters" data-testid="stcs-user-filters">
      <FilterSelect
        id="stcs-filter-status"
        label={t("status")}
        value={statusFilter}
        onChange={setStcsFilter(setStatusFilter)}
        options={STATUS_FILTERS.map((f) => ({
          value: f,
          label: t(`stcsUserStatus_${f}`),
          isDisabled: rolesUnavailable && needsGrants(f),
        }))}
      />
      <FilterSelect
        id="stcs-filter-app"
        label={t("stcsFilterApplication")}
        value={appFilter}
        onChange={setStcsFilter(setAppFilter)}
        isDisabled={!overview || rolesUnavailable}
        disabledReason={rolesUnavailable ? tooManyReason : undefined}
        options={[
          { value: "any", label: t("stcsFilterAny") },
          ...(overview?.apps ?? []).map((a) => ({ value: a.clientId, label: a.clientId })),
        ]}
      />
      <FilterSelect
        id="stcs-filter-registered"
        label={t("stcsFilterRegistered")}
        value={registeredFilter}
        onChange={setStcsFilter(setRegisteredFilter)}
        isDisabled={rolesUnavailable}
        disabledReason={rolesUnavailable ? tooManyReason : undefined}
        options={[
          { value: "any", label: t("stcsFilterAnyTime") },
          { value: "7", label: t("stcsFilterLastDays", { count: 7 }) },
          { value: "30", label: t("stcsFilterLastDays", { count: 30 }) },
          { value: "90", label: t("stcsFilterLastDays", { count: 90 }) },
        ]}
      />
      {hasStcsFilter && (
        <Button variant="link" onClick={clearStcsFilters} data-testid="stcs-clear-filters">
          {t("clearAllFilters")}
        </Button>
      )}
      {localMode && (
        <span className="stcs-user-filters__count" data-testid="stcs-filter-count">
          {t("stcsShowingOf", {
            count: localRows(searchUser).length,
            total: overview!.total,
          })}
        </span>
      )}
    </div>
  );

  const subtoolbar = () => {
    return (
      <>
        {stcsFilters}
        {activeFilters.userAttribute.length > 0 && (
          <div className="user-attribute-search-form-subtoolbar">
            <ToolbarItem>{createAttributeSearchChips()}</ToolbarItem>
            <ToolbarItem>
              <Button
                variant="link"
                onClick={() => {
                  clearAllFilters();
                }}
              >
                {t("clearAllFilters")}
              </Button>
            </ToolbarItem>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <DeleteConfirm />
      <UnlockUsersConfirm />
      {/* STCS */}
      {grantTargets && overview && (
        <GrantAccessModal
          users={grantTargets}
          overview={overview}
          onClose={() => setGrantTargets(undefined)}
          onGranted={(count) => {
            setGrantTargets(undefined);
            addAlert(t("stcsAccessGranted", { count }), AlertVariant.success);
            afterAction();
          }}
          onError={(error) => addError("stcsGrantError", error)}
        />
      )}
      <UserStatusCards
        overview={overview}
        selected={statusFilter}
        onSelect={setStcsFilter(setStatusFilter)}
      />
      <KeycloakDataTable
        isSearching={
          searchUser !== "" ||
          activeFilters.userAttribute.length !== 0 ||
          hasStcsFilter // STCS
        }
        key={key}
        loader={loader}
        isPaginated
        ariaLabelKey="titleUsers"
        canSelectAll
        onSelect={(rows: UserRepresentation[]) => setSelectedRows([...rows])}
        emptyState={
          !listUsers ? (
            <>
              <Toolbar>
                <ToolbarContent>{toolbar()}</ToolbarContent>
              </Toolbar>
              <EmptyState data-testid="empty-state" variant="lg">
                <TextContent className="kc-search-users-text">
                  <Text>{t("searchForUserDescription")}</Text>
                </TextContent>
              </EmptyState>
            </>
          ) : (
            <ListEmptyState
              message={t("noUsersFound")}
              instructions={t("emptyInstructions")}
              primaryActionText={t("createNewUser")}
              onPrimaryAction={goToCreate}
            />
          )
        }
        toolbarItem={toolbar()}
        subToolbar={subtoolbar()}
        // STCS: onboarding actions ahead of the stock delete
        actionResolver={(rowData: IRowData) => {
          const user: UserRepresentation = rowData.data;
          return [
            {
              title: t("stcsGrantAccessEllipsis"),
              isDisabled: !overview,
              onClick: () => setGrantTargets([user]),
            },
            {
              title: t("stcsResendVerification"),
              isDisabled: !user.email || !!user.emailVerified || !user.enabled,
              onClick: () => resendVerification([user]),
            },
            {
              title: user.enabled ? t("stcsDisable") : t("stcsEnable"),
              onClick: () => setEnabled([user], !user.enabled),
            },
            { isSeparator: true },
            {
              title: t("delete"),
              onClick: () => {
                setSelectedRows([user]);
                toggleDeleteDialog();
              },
            },
          ];
        }}
        // STCS: rows indexed from /users carry no `access`; the server still
        // enforces permissions on every action.
        isRowDisabled={(user: UserRepresentation) =>
          user.access ? !user.access.manage : false
        }
        columns={[
          {
            name: "username",
            displayKey: "username",
            cellRenderer: UserDetailLink,
          },
          {
            name: "email",
            displayKey: "email",
            cellRenderer: ValidatedEmail,
          },
          {
            name: "lastName",
            displayKey: "lastName",
            cellFormatters: [emptyFormatter()],
          },
          {
            name: "firstName",
            displayKey: "firstName",
            cellFormatters: [emptyFormatter()],
          },
          // STCS
          {
            name: "stcsStatus",
            displayKey: "status",
            cellRenderer: (user: UserRepresentation) => {
              const grants = grantsOf(user);
              return <StatusLabel status={grants && statusOf(user, grants)} />;
            },
          },
          {
            name: "stcsAccess",
            displayKey: "stcsAccess",
            cellRenderer: (user: UserRepresentation) => (
              <AccessCell grants={grantsOf(user)} />
            ),
          },
          {
            name: "createdTimestamp",
            displayKey: "stcsRegistered",
            cellRenderer: (user: UserRepresentation) => (
              <CreatedCell timestamp={user.createdTimestamp} />
            ),
          },
        ]}
      />
    </>
  );
}
