import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isCurrent } from "@/services/authService";
import { useAuthSession } from "@/store/authStore";

/**
 * Layout route that keeps account-scoped screens behind a session.
 *
 * A session found to be expired is treated as absent: the guard sends the visitor to
 * the sign-in form with the intended path attached, and `readStoredSession()` clears
 * the stale record on the next load.
 */
export function RequireSession() {
  const session = useAuthSession();
  const location = useLocation();

  if (!session || !isCurrent(session)) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />;
  }

  return <Outlet />;
}
