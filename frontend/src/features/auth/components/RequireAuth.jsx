import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../authContext";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <img src="/askme-logo.png" alt="AskMe Solutions & Consultants Co., Ltd." />
        <strong>กำลังตรวจสอบสิทธิ์...</strong>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;

  return children;
}
