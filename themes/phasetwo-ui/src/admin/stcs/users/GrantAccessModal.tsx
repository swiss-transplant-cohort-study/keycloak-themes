import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Checkbox,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant,
} from "@patternfly/react-core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminClient } from "../../admin-client";
import type { UserOverview } from "./useUserOverview";

const REALM_ROLES = "__realm__";

// User-profile attributes filled in on the registration page (see digicore
// setup_realms.sh and keycloak-themes ch.stcs.keycloak.registration).
const ACCESS_REASON = "accessReason";
const REQUESTED_APPS = "requestedApps";

type GrantAccessModalProps = {
  users: UserRepresentation[];
  overview: UserOverview;
  onClose: () => void;
  /** Called after the roles were granted, with the number of users updated. */
  onGranted: (count: number) => void;
  onError: (error: unknown) => void;
};

export const GrantAccessModal = ({
  users,
  overview,
  onClose,
  onGranted,
  onError,
}: GrantAccessModalProps) => {
  const { t } = useTranslation();
  const { adminClient } = useAdminClient();
  const [target, setTarget] = useState(overview.apps[0]?.id ?? REALM_ROLES);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<{ reason?: string; apps: string[] }>();

  // For a single user, show what they asked for and preselect it. The list rows
  // are brief representations without attributes, so fetch the full user.
  useEffect(() => {
    if (users.length !== 1) return;
    let cancelled = false;
    adminClient.users.findOne({ id: users[0].id! }).then((full) => {
      if (cancelled || !full) return;
      const apps = full.attributes?.[REQUESTED_APPS] ?? [];
      setRequest({ reason: full.attributes?.[ACCESS_REASON]?.[0], apps });
      const firstRequested = overview.apps.find((a) => apps.includes(a.clientId));
      if (firstRequested) setTarget(firstRequested.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const app = overview.apps.find((a) => a.id === target);
  const roles = app ? app.roles : overview.realmRoles;

  const toggleRole = (name: string, checked: boolean) =>
    setRoleNames((current) =>
      checked ? [...current, name] : current.filter((n) => n !== name),
    );

  const grant = async () => {
    setSaving(true);
    const chosen = roles
      .filter((r) => roleNames.includes(r.name!))
      .map((r) => ({ id: r.id!, name: r.name! }));
    try {
      // One request per user: each produces its own role-mapping admin event, which
      // is what makes the notifier send that user the "account active" email.
      for (const user of users) {
        if (app) {
          await adminClient.users.addClientRoleMappings({
            id: user.id!,
            clientUniqueId: app.id,
            roles: chosen,
          });
        } else {
          await adminClient.users.addRealmRoleMappings({ id: user.id!, roles: chosen });
        }
      }
      onGranted(users.length);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const title =
    users.length === 1
      ? t("stcsGrantAccessTitleOne", { name: users[0].username })
      : t("stcsGrantAccessTitleMany", { count: users.length });

  return (
    <Modal
      variant={ModalVariant.small}
      title={title}
      isOpen
      onClose={onClose}
      actions={[
        <Button
          key="grant"
          data-testid="stcs-grant-confirm"
          onClick={grant}
          isLoading={saving}
          isDisabled={saving || roleNames.length === 0}
        >
          {t("stcsGrantAccess")}
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose}>
          {t("cancel")}
        </Button>,
      ]}
    >
      {request && (request.reason || request.apps.length > 0) && (
        <DescriptionList isCompact className="pf-v5-u-mb-md">
          {request.reason && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t("stcsAccessReason")}</DescriptionListTerm>
              <DescriptionListDescription style={{ whiteSpace: "pre-wrap" }}>
                {request.reason}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {request.apps.length > 0 && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t("stcsRequestedApps")}</DescriptionListTerm>
              <DescriptionListDescription>{request.apps.join(", ")}</DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>
      )}
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (roleNames.length) grant();
        }}
      >
        <FormGroup label={t("stcsGrantApplication")} fieldId="stcs-grant-app">
          <FormSelect
            id="stcs-grant-app"
            value={target}
            onChange={(_, value) => {
              setTarget(value);
              setRoleNames([]);
            }}
          >
            {overview.apps.map((a) => (
              <FormSelectOption
                key={a.id}
                value={a.id}
                label={
                  (a.name === a.clientId ? a.clientId : `${a.name} (${a.clientId})`) +
                  (request?.apps.includes(a.clientId) ? ` — ${t("stcsGrantRequestedHint")}` : "")
                }
              />
            ))}
            {overview.realmRoles.length > 0 && (
              <FormSelectOption value={REALM_ROLES} label={t("stcsGrantRealmRoles")} />
            )}
          </FormSelect>
        </FormGroup>
        <FormGroup label={t("roles")} fieldId="stcs-grant-roles" role="group">
          {roles.length === 0 ? (
            <Alert variant="info" isInline isPlain title={t("stcsGrantNoRoles")} />
          ) : (
            roles.map((r) => (
              <Checkbox
                key={r.id}
                id={`stcs-grant-role-${r.id}`}
                label={r.name}
                description={r.description}
                isChecked={roleNames.includes(r.name!)}
                onChange={(_, checked) => toggleRole(r.name!, checked)}
              />
            ))
          )}
        </FormGroup>
        <Alert variant="info" isInline isPlain title={t("stcsGrantSendsEmail")} />
      </Form>
    </Modal>
  );
};
