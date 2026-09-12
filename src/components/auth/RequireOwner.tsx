import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuthToken, getOrganizationRole, getSessionType } from "../../lib/auth";

export default function RequireOwner() {
  const location = useLocation();

  const token = getAuthToken();
  const sessionType = getSessionType();
  const organizationRole = getOrganizationRole();

  if (
    token &&
    sessionType === "TENANT" &&
    organizationRole === "OWNER"
  ) {
    return <Outlet />;
  }

  if (!token || sessionType !== "TENANT") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Navigate to="/dashboard" replace />;
}
