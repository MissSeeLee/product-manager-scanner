import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./authContext";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "./api/authApi";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch((error) => {
        if (active && error?.status === 401) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("assetops:unauthorized", onUnauthorized);
    return () => window.removeEventListener("assetops:unauthorized", onUnauthorized);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const nextUser = await getCurrentUser();
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error?.status === 401) {
        setUser(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const nextUser = await loginRequest(username, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, isAdmin: user?.role === "ADMIN" }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
