import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../authContext";

function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "เข้าสู่ระบบ | AssetOps";
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(username, password);
      const destination = location.state?.from || "/";
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถเข้าสู่ระบบได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img src="/askme-logo.png" alt="AskMe Solutions & Consultants Co., Ltd." />
          <div>
            <span className="login-eyebrow">AskMe Solutions & Consultants Co., Ltd.</span>
            <h1>AssetOps</h1>
            <p>IT Asset Operations Manager</p>
          </div>
        </div>

        <div className="login-heading">
          <h2>เข้าสู่ระบบ</h2>
          <p>ใช้บัญชีที่ผู้ดูแลระบบสร้างให้เพื่อเข้าถึง Manager</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>ชื่อผู้ใช้</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="form-field">
            <span>รหัสผ่าน</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="button button-primary login-submit" type="submit" disabled={submitting}>
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="login-security-note">Session ถูกเก็บด้วย HttpOnly cookie และ Manager API ต้องผ่านการยืนยันตัวตนทุกครั้ง</p>
      </section>
    </main>
  );
}

export default LoginPage;
