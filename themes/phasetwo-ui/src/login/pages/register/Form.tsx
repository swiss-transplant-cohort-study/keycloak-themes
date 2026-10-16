/**
 * This file has been claimed for ownership from @oussemasahbeni/keycloakify-login-shadcn version 250004.0.20.
 * To relinquish ownership and restore this file to its original content, run the following command:
 * 
 * $ npx keycloakify own --path "login/pages/register/Form.tsx" --revert
 */

import { Button } from "@/components/ui/button";
import { clsx } from "@keycloakify/login-ui/tools/clsx";
import { useKcClsx } from "@keycloakify/login-ui/useKcClsx";
import { useLayoutEffect, useState } from "react";
import { assert } from "tsafe/assert";
import { useKcContext } from "../../KcContext";
import { UserProfileFormFields } from "../../components/UserProfileFormFields";
import { useI18n } from "../../i18n";
import { TermsAcceptance } from "./TermsAcceptance";

export function Form() {
    const { kcContext } = useKcContext();
    assert(kcContext.pageId === "register.ftl");
    const { kcClsx } = useKcClsx();
    const { msg, msgStr } = useI18n();

    // STCS: attributes the server requires only at registration (validator
    // stcs-required-on-registration, flagged to the theme by the
    // stcsRequiredOnRegistration annotation) are marked required here, before the
    // form state is built, so the asterisk and the browser-side check match.
    useState(() => {
        for (const attribute of Object.values(kcContext.profile.attributesByName)) {
            if (
                (attribute.annotations as Record<string, unknown>)
                    .stcsRequiredOnRegistration === "true"
            ) {
                attribute.required = true;
            }
        }
    });

    const [isFormSubmittable, setIsFormSubmittable] = useState(false);
    const [areTermsAccepted, setAreTermsAccepted] = useState(false);

    useLayoutEffect(() => {
        (window as any)["onSubmitRecaptcha"] = () => {
            // @ts-expect-error
            document.getElementById("kc-register-form").requestSubmit();
        };

        return () => {
            delete (window as any)["onSubmitRecaptcha"];
        };
    }, []);

    return (
        <form
            id="kc-register-form"
            action={kcContext.url.registrationAction}
            className="space-y-4"
            method="post"
        >
            <UserProfileFormFields
                onIsFormSubmittableValueChange={setIsFormSubmittable}
            />
            {kcContext.termsAcceptanceRequired && (
                <TermsAcceptance
                    messagesPerField={kcContext.messagesPerField}
                    areTermsAccepted={areTermsAccepted}
                    onAreTermsAcceptedValueChange={setAreTermsAccepted}
                />
            )}
            {kcContext.recaptchaRequired &&
                (kcContext.recaptchaVisible ||
                    kcContext.recaptchaAction === undefined) && (
                    <div className="form-group">
                        <div className={kcClsx("kcInputWrapperClass")}>
                            <div
                                className="g-recaptcha"
                                data-size="compact"
                                data-sitekey={kcContext.recaptchaSiteKey}
                                data-action={kcContext.recaptchaAction}
                            ></div>
                        </div>
                    </div>
                )}
            <div className={kcClsx("kcFormGroupClass")}>
                {kcContext.recaptchaRequired &&
                    !kcContext.recaptchaVisible &&
                    kcContext.recaptchaAction !== undefined ? (
                    <div id="kc-form-buttons" className={kcClsx("kcFormButtonsClass")}>
                        <button
                            className={clsx(
                                kcClsx(
                                    "kcButtonClass",
                                    "kcButtonPrimaryClass",
                                    "kcButtonBlockClass",
                                    "kcButtonLargeClass"
                                ),
                                "g-recaptcha"
                            )}
                            data-sitekey={kcContext.recaptchaSiteKey}
                            data-callback="onSubmitRecaptcha"
                            data-action={kcContext.recaptchaAction}
                            type="submit"
                        >
                            {msg("doRegister")}
                        </button>
                    </div>
                ) : (
                    <Button
                        disabled={
                            !isFormSubmittable ||
                            (kcContext.termsAcceptanceRequired && !areTermsAccepted)
                        }
                        className="w-full mt-2"
                        name="register"
                        type="submit"
                    >
                        {msgStr("doRegister")}
                    </Button>
                )}
            </div>

            <div className=" flex justify-end">
                <Button type="button" variant="ghost">
                    <a href={kcContext.url.loginUrl}>{msg("backToLogin")}</a>
                </Button>
            </div>
        </form>
    );
}
