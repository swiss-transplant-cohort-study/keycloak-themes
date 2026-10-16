import { Card, Grid, GridItem, Tooltip } from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import { OVERVIEW_USER_LIMIT, type UserOverview } from "./useUserOverview";
import { matchesStatus, needsGrants, STATUS_FILTERS, type StatusFilter } from "./userStatus";
import "./stcs-users.css";

type UserStatusCardsProps = {
  overview?: UserOverview;
  selected: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
};

const countFor = (overview: UserOverview, filter: StatusFilter): number | null => {
  if (filter === "all") return overview.total;
  if (!overview.complete) {
    // Large realm: only the counts Keycloak answers directly.
    if (filter === "unverified") return overview.unverified;
    if (filter === "disabled") return overview.disabled;
    return null;
  }
  return overview.users.filter((u) =>
    matchesStatus(filter, u, overview.grants.get(u.id!) ?? []),
  ).length;
};

export const UserStatusCards = ({ overview, selected, onSelect }: UserStatusCardsProps) => {
  const { t } = useTranslation();

  return (
    <Grid hasGutter className="stcs-user-cards">
      {STATUS_FILTERS.map((filter) => {
        const value = overview ? countFor(overview, filter) : undefined;
        const unavailable = overview && !overview.complete && needsGrants(filter);
        const isSelected = selected === filter;

        const card = (
          <Card
            isFullHeight
            isCompact
            className={`stcs-user-card stcs-user-card--${filter}${isSelected ? " stcs-user-card--selected" : ""}`}
          >
            <button
              type="button"
              className="stcs-user-card__button"
              aria-pressed={isSelected}
              disabled={!!unavailable}
              data-testid={`stcs-user-card-${filter}`}
              // Clicking the selected card again clears the filter.
              onClick={() => onSelect(isSelected ? "all" : filter)}
            >
              <span className="stcs-user-card__number">
                {value === undefined ? "…" : value === null ? "—" : value.toLocaleString()}
              </span>
              <span className="stcs-user-card__label">{t(`stcsUserStatus_${filter}`)}</span>
              <span className="stcs-user-card__hint">{t(`stcsUserStatusHint_${filter}`)}</span>
            </button>
          </Card>
        );

        return (
          <GridItem key={filter} xl={2} lg={4} md={4} sm={6}>
            {unavailable ? (
              <Tooltip content={t("stcsUsersTooManyForRoles", { limit: OVERVIEW_USER_LIMIT.toLocaleString() })}>
                {card}
              </Tooltip>
            ) : (
              card
            )}
          </GridItem>
        );
      })}
    </Grid>
  );
};
