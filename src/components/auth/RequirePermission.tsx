import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  hasAnyPermission,
} from "../../lib/auth";

interface RequirePermissionProps {
  permissions: readonly string[];
}

export default function RequirePermission({
  permissions,
}: RequirePermissionProps) {
  const location = useLocation();

  const allowed =
    permissions.length > 0 &&
    hasAnyPermission(...permissions);

  if (allowed) {
    return <Outlet />;
  }

  return (
    <Navigate
      to="/dashboard"
      replace
      state={{
        accessDenied: true,
        attemptedPath: location.pathname,
      }}
    />
  );
}