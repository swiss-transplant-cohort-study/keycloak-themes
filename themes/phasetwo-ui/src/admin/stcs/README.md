# STCS admin console additions

## Users page: onboarding overview

The realm's **Users** page gets an overview built around the STCS onboarding flow
(register → confirm email → an admin grants an application role):

- **Status cards**: All users, Email not confirmed, No role, Ready for review, Active,
  Disabled. Clicking a card filters the list, and clicking it again clears the filter.
- **Filters** under the toolbar: status, application (users holding a role on that
  client), and registration date. They combine with the normal search box.
- **Columns**: Status, Access (the roles each user holds), Registered.
- **Actions**, per row (kebab) and in bulk ("Actions" next to Add user): Grant
  access…, Resend verification email, Enable / Disable.

"Has a role" means a role on any client that Keycloak did not create itself, or any
realm role other than the defaults, held directly or through a group (including
parent groups). Granting a role this way emits the admin event that makes the
digicore notifier send the user the "account active" email.

To compute this, the page loads every user and every role's members into the
browser. Above `OVERVIEW_USER_LIMIT` users (5000) it stops doing so: the cards fall
back to the counts Keycloak returns directly, and the role-based filters are disabled.

### Files

| File | |
|---|---|
| `stcs/users/useUserOverview.ts` | Loads users, application clients, role holders and counts |
| `stcs/users/userStatus.ts` | What each status and filter means. Change definitions here |
| `stcs/users/UserStatusCards.tsx`, `UserCells.tsx`, `FilterSelect.tsx`, `GrantAccessModal.tsx` | UI pieces |
| `components/users/UserDataTable.tsx` | **Owned** upstream file that wires the pieces in. Every change is marked `STCS` |
| `i18n/messages_en_override.properties` | Strings, under `## stcs additions` |

### After upgrading `@keycloakify/keycloak-admin-ui`

`UserDataTable.tsx` is owned, so upstream changes to it do not arrive automatically.
Diff it against the new upstream version
(`node_modules/@keycloakify/keycloak-admin-ui/keycloak-theme/admin/components/users/UserDataTable.tsx`)
and carry the `STCS` blocks over.

### Enabling it

The admin console renders the `master` realm's admin theme. Set it under
master → Realm settings → Themes → Admin theme = `phasetwo-ui`, or run:

```bash
kcadm.sh update realms/master -s adminTheme=phasetwo-ui
```

## Registration: reason for access and requested applications

Two user-profile attributes on the registration form, provisioned per realm by digicore's
`setup_realms.sh`:

- `accessReason`: a textarea, required **at registration only**.
- `requestedApps`: the applications the person wants, picked from a live list.

| Piece | Where |
|---|---|
| `GET /realms/{realm}/registration-apps`: clients with `stcs.registration.visible=true`, as `[{clientId, name, description}]`. Public, because the page is shown before sign-in | `src/main/java/ch/stcs/keycloak/registration/` |
| Validator `stcs-registration-apps`: at registration, values must be offered clients | same |
| Validator `stcs-required-on-registration`: non-empty at registration, optional elsewhere. Not the profile's own "required", which would force every existing user through update-profile | same |
| "Show on registration page" switch, under Client → Settings | `admin/clients/ClientDescription.tsx` (owned, marked `STCS`) |
| The card picker, which fetches the endpoint and posts hidden inputs | `login/components/stcs/RegistrationAppsField.tsx`, wired in `login/components/UserProfileFormFields/InputFieldByType.tsx` (owned) by the `stcsOptionsSource=registration-apps` annotation |
| Asterisk and browser-side check for `stcsRequiredOnRegistration=true` | `login/pages/register/Form.tsx` (owned) |
| Grant dialog shows the reason and preselects a requested application | `admin/stcs/users/GrantAccessModal.tsx` |

New provider classes mean Keycloak needs a `kc.sh build` after the jar changes. The
digicore image runs one as part of its build.
