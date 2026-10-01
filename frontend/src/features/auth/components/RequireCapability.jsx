import { Navigate, useLocation } from "react-router-dom";

import { useCan } from "../capabilities";

export default function RequireCapability({ capability, children }) {
  const allowed = useCan(capability);
  const location = useLocation();

  if (!allowed) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location.pathname,
          notice: "บัญชีนี้ไม่มีสิทธิ์ทำรายการดังกล่าว",
        }}
      />
    );
  }

  return children;
}
