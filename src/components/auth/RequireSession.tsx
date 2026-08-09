import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { getAuthToken, getSessionType, type SessionType } from "../../lib/auth";

interface RequireSessionProps {
  sessionType: SessionType;
}

export default function RequireSession({ sessionType }: RequireSessionProps) {
  const location = useLocation();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setSessionExpired(true);
    window.addEventListener("ziya:session-expired", handleSessionExpired);
    return () => window.removeEventListener("ziya:session-expired", handleSessionExpired);
  }, []);

  if (!sessionExpired && getAuthToken() && getSessionType() === sessionType) {
    return <Outlet />;
  }

  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
