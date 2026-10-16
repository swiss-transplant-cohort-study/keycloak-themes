package ch.stcs.keycloak.registration;

import com.google.auto.service.AutoService;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.keycloak.models.ClientModel;
import org.keycloak.models.RealmModel;
import org.keycloak.userprofile.UserProfileAttributeValidationContext;
import org.keycloak.userprofile.UserProfileContext;
import org.keycloak.validate.SimpleValidator;
import org.keycloak.validate.ValidationContext;
import org.keycloak.validate.ValidationError;
import org.keycloak.validate.ValidatorConfig;
import org.keycloak.validate.ValidatorFactory;

/**
 * User-profile validator {@code stcs-registration-apps}: at registration, every requested value must
 * be the client id of an application currently offered on the registration page.
 *
 * <p>Only checked at registration. A client may later be taken off the page, and the values users
 * already stored must not then block them, or an admin, from saving the profile.
 */
@AutoService(ValidatorFactory.class)
public class RegistrationAppsValidator implements SimpleValidator {

  public static final String ID = "stcs-registration-apps";
  public static final String MESSAGE = "stcsInvalidRegistrationApp";

  @Override
  public String getId() {
    return ID;
  }

  @Override
  public ValidationContext validate(
      Object input, String inputHint, ValidationContext context, ValidatorConfig config) {
    if (!isRegistration(context)) return context;

    RealmModel realm = context.getSession().getContext().getRealm();
    Set<String> offered =
        RegistrationApps.clients(realm).stream()
            .map(ClientModel::getClientId)
            .collect(Collectors.toSet());

    for (Object value : values(input)) {
      String clientId = value == null ? "" : value.toString();
      if (!clientId.isBlank() && !offered.contains(clientId)) {
        context.addError(new ValidationError(ID, inputHint, MESSAGE, clientId));
      }
    }
    return context;
  }

  static boolean isRegistration(ValidationContext context) {
    // Outside a user-profile validation (e.g. config checks) there is no attribute context.
    return context instanceof UserProfileAttributeValidationContext upContext
        && upContext.getAttributeContext().getContext() == UserProfileContext.REGISTRATION;
  }

  static Collection<?> values(Object input) {
    if (input == null) return List.of();
    return input instanceof Collection<?> c ? c : List.of(input);
  }
}
