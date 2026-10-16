package ch.stcs.keycloak.registration;

import java.util.Comparator;
import java.util.List;
import org.keycloak.models.ClientModel;
import org.keycloak.models.RealmModel;

/**
 * The applications a new user can request access to on the registration page.
 *
 * <p>A client is offered when it is enabled and has the client attribute {@link #ATTRIBUTE} set to
 * {@code "true"} (the "Show on registration page" switch in the admin console). What the page shows
 * is the client's own Name and Description, so admins edit the list entirely from the client
 * settings, with no redeploy.
 */
public final class RegistrationApps {

  public static final String ATTRIBUTE = "stcs.registration.visible";

  /** The user-profile attribute that stores the requested client ids. */
  public static final String REQUESTED_APPS_ATTRIBUTE = "requestedApps";

  public record App(String clientId, String name, String description) {}

  private RegistrationApps() {}

  public static List<ClientModel> clients(RealmModel realm) {
    return realm
        .getClientsStream()
        .filter(ClientModel::isEnabled)
        .filter(c -> "true".equals(c.getAttribute(ATTRIBUTE)))
        .sorted(Comparator.comparing(RegistrationApps::displayName, String.CASE_INSENSITIVE_ORDER))
        .toList();
  }

  public static List<App> list(RealmModel realm) {
    return clients(realm).stream()
        .map(c -> new App(c.getClientId(), displayName(c), c.getDescription()))
        .toList();
  }

  private static String displayName(ClientModel client) {
    String name = client.getName();
    return name == null || name.isBlank() ? client.getClientId() : name;
  }
}
