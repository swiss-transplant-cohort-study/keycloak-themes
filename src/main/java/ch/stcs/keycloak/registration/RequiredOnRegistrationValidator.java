package ch.stcs.keycloak.registration;

import com.google.auto.service.AutoService;
import org.keycloak.userprofile.validator.AttributeRequiredByMetadataValidator;
import org.keycloak.validate.SimpleValidator;
import org.keycloak.validate.ValidationContext;
import org.keycloak.validate.ValidationError;
import org.keycloak.validate.ValidatorConfig;
import org.keycloak.validate.ValidatorFactory;

/**
 * User-profile validator {@code stcs-required-on-registration}: the attribute must be filled in when
 * registering, and is optional everywhere else.
 *
 * <p>The user profile's own "required" setting cannot express this. Marking an attribute required
 * for users makes Keycloak demand it from every existing user at their next login, through the
 * update-profile screen.
 *
 * <p>The login theme marks attributes carrying this validator as required on the registration form,
 * so the asterisk and the browser-side check match what the server enforces.
 */
@AutoService(ValidatorFactory.class)
public class RequiredOnRegistrationValidator implements SimpleValidator {

  public static final String ID = "stcs-required-on-registration";

  @Override
  public String getId() {
    return ID;
  }

  @Override
  public ValidationContext validate(
      Object input, String inputHint, ValidationContext context, ValidatorConfig config) {
    if (!RegistrationAppsValidator.isRegistration(context)) return context;

    boolean filled =
        RegistrationAppsValidator.values(input).stream()
            .anyMatch(v -> v != null && !v.toString().isBlank());
    if (!filled) {
      context.addError(
          new ValidationError(
              ID, inputHint, AttributeRequiredByMetadataValidator.ERROR_USER_ATTRIBUTE_REQUIRED));
    }
    return context;
  }
}
