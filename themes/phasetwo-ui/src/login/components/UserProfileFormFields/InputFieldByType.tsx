/**
 * This file has been claimed for ownership from @oussemasahbeni/keycloakify-login-shadcn version 250004.0.20.
 * To relinquish ownership and restore this file to its original content, run the following command:
 * 
 * $ npx keycloakify own --path "login/components/UserProfileFormFields/InputFieldByType.tsx" --revert
 */

import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import type { Attribute } from "@keycloakify/login-ui/KcContext";
import type {
    FormAction,
    FormFieldError
} from "@keycloakify/login-ui/useUserProfileForm";
import { InputTag } from "./InputTag";
import { InputTagSelects } from "./InputTagSelects";
import { SelectTag } from "./SelectTag";
import { TextareaTag } from "./TextareaTag";
import { PasswordVisibilityButton } from '../PasswordVisibilityButton';
// STCS
import {
    REGISTRATION_APPS_SOURCE,
    RegistrationAppsField
} from "../stcs/RegistrationAppsField";

export type InputFieldByTypeProps = {
    attribute: Attribute;
    valueOrValues: string | string[];
    displayableErrors: FormFieldError[];
    dispatchFormAction: React.Dispatch<FormAction>;
};

export function InputFieldByType(props: InputFieldByTypeProps) {
    const { attribute, valueOrValues } = props;

    // STCS: an attribute whose options come live from the server, not from the
    // user-profile config (see RegistrationAppsField).
    if (
        (attribute.annotations as Record<string, unknown>).stcsOptionsSource ===
        REGISTRATION_APPS_SOURCE
    ) {
        return <RegistrationAppsField {...props} />;
    }

    switch (attribute.annotations.inputType) {
        // NOTE: Unfortunately, keycloak won't let you define input type="hidden" in the Admin Console.
        // sometimes in the future it might.
        case "hidden":
            return (
                <input
                    type="hidden"
                    id={attribute.name}
                    name={attribute.name}
                    value={valueOrValues as string}
                />
            );
        case "textarea":
            return <TextareaTag {...props} />;
        case "select":
        case "multiselect":
            return <SelectTag {...props} />;
        case "select-radiobuttons":
        case "multiselect-checkboxes":
            return <InputTagSelects {...props} />;
        default: {
            if (valueOrValues instanceof Array) {
                return (
                    <>
                        {valueOrValues.map((...[, i]) => (
                            <InputTag key={i} {...props} fieldIndex={i} />
                        ))}
                    </>
                );
            }


            if (attribute.name === "password" || attribute.name === "password-confirm") {
                return (
                    <InputGroup>
                        <InputTag {...props} fieldIndex={undefined} isInGroup={true} />
                        <InputGroupAddon align="inline-end">
                            <PasswordVisibilityButton passwordInputId={attribute.name} />
                        </InputGroupAddon>
                    </InputGroup>
                );
            }

            return <InputTag {...props} fieldIndex={undefined} />;
        }
    }
}
