import { cn } from "@/components/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { useKcContext } from "../../KcContext";
import { useI18n } from "../../i18n";
import type { InputFieldByTypeProps } from "../UserProfileFormFields/InputFieldByType";

/** Annotation value that makes a user-profile attribute render with this field. */
export const REGISTRATION_APPS_SOURCE = "registration-apps";

type App = { clientId: string; name: string; description?: string | null };

type LoadState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "loaded"; apps: App[] };

/**
 * The "which applications do you need" picker on the registration page.
 *
 * The list is not in the user-profile config. It comes live from
 * GET /realms/{realm}/registration-apps (keycloak-themes, ch.stcs.keycloak.registration):
 * every client an admin switched "Show on registration page" on, with the client's own
 * Name and Description. The server re-checks the submitted values against the same list.
 */
export function RegistrationAppsField(props: InputFieldByTypeProps) {
    const { attribute, valueOrValues, displayableErrors, dispatchFormAction } = props;
    const { kcContext } = useKcContext();
    const { msgStr, advancedMsgStr } = useI18n();
    const [state, setState] = useState<LoadState>({ status: "loading" });

    const selected = (
        valueOrValues instanceof Array ? valueOrValues : [valueOrValues]
    ).filter(v => v !== "");

    useEffect(() => {
        // loginUrl is .../realms/{realm}/protocol/..., which keeps any relative path
        // Keycloak is served under.
        const base = kcContext.url.loginUrl.split("/realms/")[0];
        const url = `${base}/realms/${encodeURIComponent(kcContext.realm.name)}/registration-apps`;
        let cancelled = false;
        fetch(url, { headers: { Accept: "application/json" } })
            .then(response => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json() as Promise<App[]>;
            })
            .then(
                apps => !cancelled && setState({ status: "loaded", apps }),
                () => !cancelled && setState({ status: "error" })
            );
        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = (clientId: string, checked: boolean) => {
        const next = checked
            ? [...selected, clientId]
            : selected.filter(v => v !== clientId);
        dispatchFormAction({
            action: "update",
            name: attribute.name,
            // An empty multivalued attribute is [""] in the form state, not [].
            valueOrValues: next.length ? next : [""]
        });
        dispatchFormAction({
            action: "focus lost",
            name: attribute.name,
            fieldIndex: undefined
        });
    };

    if (state.status === "loading") {
        return (
            <p className="text-sm text-muted-foreground">
                {msgStr("stcsRequestedAppsLoading")}
            </p>
        );
    }
    if (state.status === "error") {
        return (
            <p className="text-sm text-muted-foreground">
                {msgStr("stcsRequestedAppsError")}
            </p>
        );
    }
    if (state.apps.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {msgStr("stcsRequestedAppsEmpty")}
            </p>
        );
    }

    return (
        <div
            className="space-y-2"
            role="group"
            aria-labelledby={attribute.name}
            aria-invalid={displayableErrors.length !== 0}
        >
            {/* The checkboxes are buttons, not inputs, so these carry the values. */}
            {selected.map(clientId => (
                <input key={clientId} type="hidden" name={attribute.name} value={clientId} />
            ))}
            {state.apps.map(app => {
                const id = `${attribute.name}-${app.clientId}`;
                const isChecked = selected.includes(app.clientId);
                return (
                    <label
                        key={app.clientId}
                        htmlFor={id}
                        className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent/50",
                            isChecked && "border-primary bg-primary/5",
                            attribute.readOnly && "cursor-not-allowed opacity-50"
                        )}
                    >
                        <Checkbox
                            id={id}
                            className="mt-0.5"
                            checked={isChecked}
                            disabled={attribute.readOnly}
                            onCheckedChange={checked => toggle(app.clientId, checked === true)}
                        />
                        <span className="grid gap-1">
                            <span className="text-sm font-medium leading-none">
                                {advancedMsgStr(app.name)}
                            </span>
                            {app.description && (
                                <span className="text-sm text-muted-foreground">
                                    {advancedMsgStr(app.description)}
                                </span>
                            )}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
