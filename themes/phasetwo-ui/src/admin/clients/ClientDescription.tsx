/**
 * This file has been claimed for ownership from @keycloakify/keycloak-admin-ui version 260502.0.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 * 
 * $ npx keycloakify own --path "admin/clients/ClientDescription.tsx" --revert
 */

/* eslint-disable */

// @ts-nocheck

import { useTranslation } from "react-i18next";
import { TextControl, TextAreaControl } from "../../shared/keycloak-ui-shared";

import { FormAccess } from "../components/form/FormAccess";
import { DefaultSwitchControl } from "../components/SwitchControl";
import { convertAttributeNameToForm } from "../util";

type ClientDescriptionProps = {
  protocol?: string;
  hasConfigureAccess?: boolean;
};

export const ClientDescription = ({
  hasConfigureAccess: configure,
}: ClientDescriptionProps) => {
  const { t } = useTranslation();
  return (
    <FormAccess role="manage-clients" fineGrainedAccess={configure} unWrap>
      <TextControl
        name="clientId"
        label={t("clientId")}
        labelIcon={t("clientIdHelp")}
        rules={{ required: t("required") }}
      />
      <TextControl
        name="name"
        label={t("name")}
        labelIcon={t("clientNameHelp")}
      />
      <TextAreaControl
        name="description"
        label={t("description")}
        labelIcon={t("clientDescriptionHelp")}
        rules={{
          maxLength: {
            value: 255,
            message: t("maxLength", { length: 255 }),
          },
        }}
      />
      <DefaultSwitchControl
        name="alwaysDisplayInConsole"
        label={t("alwaysDisplayInUI")}
        labelIcon={t("alwaysDisplayInUIHelp")}
      />
      {/* STCS: offers this client on the registration page, using the Name and
          Description above (keycloak-themes ch.stcs.keycloak.registration). */}
      <DefaultSwitchControl
        name={convertAttributeNameToForm("attributes.stcs.registration.visible")}
        label={t("stcsShowOnRegistration")}
        labelIcon={t("stcsShowOnRegistrationHelp")}
        stringify
      />
    </FormAccess>
  );
};
