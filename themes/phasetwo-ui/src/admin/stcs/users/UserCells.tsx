import { Label, Tooltip } from "@patternfly/react-core";
import {
  BanIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  HourglassHalfIcon,
} from "@patternfly/react-icons";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { grantLabel, type Grant, type UserStatus } from "./userStatus";

const STATUS_STYLE: Record<
  UserStatus,
  { color: "green" | "blue" | "orange" | "grey"; icon: ReactElement }
> = {
  active: { color: "green", icon: <CheckCircleIcon /> },
  pending: { color: "blue", icon: <HourglassHalfIcon /> },
  unverified: { color: "orange", icon: <EnvelopeIcon /> },
  disabled: { color: "grey", icon: <BanIcon /> },
};

export const StatusLabel = ({ status }: { status?: UserStatus }) => {
  const { t } = useTranslation();
  if (!status) return <>—</>;
  const { color, icon } = STATUS_STYLE[status];
  return (
    <Tooltip content={t(`stcsUserStatusHint_${status}`)}>
      <Label color={color} icon={icon} isCompact data-testid={`stcs-status-${status}`}>
        {t(`stcsUserLifecycle_${status}`)}
      </Label>
    </Tooltip>
  );
};

const VISIBLE_GRANTS = 2;

export const AccessCell = ({ grants }: { grants?: Grant[] }) => {
  const { t } = useTranslation();
  if (!grants) return <>—</>;
  if (grants.length === 0) {
    return <span className="pf-v5-u-color-200">{t("stcsNoAccess")}</span>;
  }
  const hidden = grants.slice(VISIBLE_GRANTS);
  return (
    <span className="stcs-user-access">
      {grants.slice(0, VISIBLE_GRANTS).map((g) => (
        <Label key={grantLabel(g)} isCompact variant="outline">
          {grantLabel(g)}
        </Label>
      ))}
      {hidden.length > 0 && (
        <Tooltip content={hidden.map(grantLabel).join(", ")}>
          <Label isCompact variant="outline">
            {t("stcsMoreRoles", { count: hidden.length })}
          </Label>
        </Tooltip>
      )}
    </span>
  );
};

export const CreatedCell = ({ timestamp }: { timestamp?: number }) => {
  if (!timestamp) return <>—</>;
  const date = new Date(timestamp);
  return (
    <Tooltip content={date.toLocaleString()}>
      <span>{date.toLocaleDateString()}</span>
    </Tooltip>
  );
};
