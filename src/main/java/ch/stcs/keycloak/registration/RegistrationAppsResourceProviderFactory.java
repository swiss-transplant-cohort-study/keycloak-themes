package ch.stcs.keycloak.registration;

import com.google.auto.service.AutoService;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.CacheControl;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.keycloak.Config.Scope;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.services.resource.RealmResourceProvider;
import org.keycloak.services.resource.RealmResourceProviderFactory;

/**
 * {@code GET /realms/{realm}/registration-apps}: the applications offered on the registration page,
 * as {@code [{clientId, name, description}]}.
 *
 * <p>Deliberately unauthenticated, because the registration page is shown before anyone signs in.
 * It exposes only what the page displays anyway, and only for clients an admin opted in.
 */
@AutoService(RealmResourceProviderFactory.class)
public class RegistrationAppsResourceProviderFactory implements RealmResourceProviderFactory {

  public static final String ID = "registration-apps";

  @Override
  public String getId() {
    return ID;
  }

  @Override
  public RealmResourceProvider create(KeycloakSession session) {
    return new Provider(session);
  }

  @Override
  public void init(Scope config) {}

  @Override
  public void postInit(KeycloakSessionFactory factory) {}

  @Override
  public void close() {}

  public static class Provider implements RealmResourceProvider {

    private final KeycloakSession session;

    Provider(KeycloakSession session) {
      this.session = session;
    }

    @Override
    public Object getResource() {
      return this;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list() {
      CacheControl cache = new CacheControl();
      cache.setNoStore(true);
      return Response.ok(RegistrationApps.list(session.getContext().getRealm()))
          .cacheControl(cache)
          .build();
    }

    @Override
    public void close() {}
  }
}
