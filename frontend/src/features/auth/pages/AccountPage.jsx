import { useState } from "react";

import { useAuth } from "../authContext";
import { changePassword } from "../api/authApi";

const roleLabels = {
  ADMIN: "ผู้ดูแลระบบ",
  OPERATOR: "ผู้ปฏิบัติงาน",
  VIEWER: "อ่านอย่างเดียว",
};

function AccountPage() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      setMessage(result.message || "เปลี่ยนรหัสผ่านสำเร็จ");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="account-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Security</span>
          <h1>บัญชีของฉัน</h1>
          <p>ตรวจสอบสิทธิ์และเปลี่ยนรหัสผ่านของบัญชีที่กำลังใช้งาน</p>
        </div>
      </div>

      <div className="account-grid">
        <section className="card">
          <h2 className="card-title">ข้อมูลบัญชี</h2>
          <dl className="account-summary">
            <div><dt>ชื่อแสดงผล</dt><dd>{user?.displayName}</dd></div>
            <div><dt>ชื่อผู้ใช้</dt><dd>{user?.username}</dd></div>
            <div><dt>สิทธิ์</dt><dd><span className={`role-badge role-${user?.role?.toLowerCase()}`}>{roleLabels[user?.role] || user?.role}</span></dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">เปลี่ยนรหัสผ่าน</h2>
          <p className="muted-text">รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัวอักษร หลังเปลี่ยนระบบจะยกเลิก session อื่นของบัญชีนี้</p>

          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field form-field-full">
              <span>รหัสผ่านปัจจุบัน</span>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label className="form-field form-field-full">
              <span>รหัสผ่านใหม่</span>
              <input type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </label>
            <label className="form-field form-field-full">
              <span>ยืนยันรหัสผ่านใหม่</span>
              <input type="password" minLength={10} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
            <div className="form-actions form-field-full">
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AccountPage;
