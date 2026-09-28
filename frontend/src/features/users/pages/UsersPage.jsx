import { useEffect, useState } from "react";

import { createUser, getUsers, resetUserPassword, updateUser } from "../api/usersApi";

const roleLabels = {
  ADMIN: "Admin",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

const emptyForm = {
  username: "",
  displayName: "",
  password: "",
  role: "OPERATOR",
};

function formatDate(value) {
  if (!value) return "ยังไม่เคยเข้าสู่ระบบ";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถโหลดผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    getUsers()
      .then((items) => {
        if (active) setUsers(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "ไม่สามารถโหลดผู้ใช้ได้");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createUser(form);
      setMessage(result.message || "สร้างผู้ใช้สำเร็จ");
      setForm(emptyForm);
      await load();
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถสร้างผู้ใช้ได้");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(user) {
    setEditingId(user.id);
    setEditDraft({
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
    });
    setError("");
    setMessage("");
  }

  async function saveEdit(user) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateUser(user.id, editDraft);
      setMessage(result.message || "บันทึกผู้ใช้สำเร็จ");
      setEditingId(null);
      setEditDraft(null);
      await load();
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถบันทึกผู้ใช้ได้");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!resetTarget) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await resetUserPassword(resetTarget.id, resetPassword);
      setMessage(result.message || "ตั้งรหัสผ่านใหม่สำเร็จ");
      setResetTarget(null);
      setResetPassword("");
      await load();
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถตั้งรหัสผ่านใหม่ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Access Control</span>
          <h1>ผู้ใช้และสิทธิ์</h1>
          <p>Admin จัดการบัญชี, Role, สถานะ และรหัสผ่านของ Manager ได้จากหน้านี้</p>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <section className="card user-create-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">สร้างผู้ใช้</h2>
            <p className="muted-text">Username ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง</p>
          </div>
        </div>

        <form className="form-grid user-create-form" onSubmit={handleCreate}>
          <label className="form-field">
            <span>Username</span>
            <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} required />
          </label>
          <label className="form-field">
            <span>ชื่อแสดงผล</span>
            <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required />
          </label>
          <label className="form-field">
            <span>รหัสผ่านเริ่มต้น</span>
            <input type="password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          </label>
          <label className="form-field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="OPERATOR">Operator — งานปฏิบัติการ</option>
              <option value="VIEWER">Viewer — อ่านอย่างเดียว</option>
              <option value="ADMIN">Admin — ทุกสิทธิ์</option>
            </select>
          </label>
          <div className="form-actions form-field-full">
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? "กำลังบันทึก..." : "สร้างผู้ใช้"}</button>
          </div>
        </form>
      </section>

      <section className="card user-list-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">บัญชีทั้งหมด</h2>
            <p className="muted-text">การเปลี่ยน Role, ปิดบัญชี หรือ Reset password จะยกเลิก session เดิมของผู้ใช้นั้น</p>
          </div>
        </div>

        {loading ? (
          <p className="muted-text">กำลังโหลด...</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>Role</th>
                  <th>สถานะ</th>
                  <th>เข้าใช้ล่าสุด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const editing = editingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {editing ? (
                          <input className="table-input" value={editDraft.displayName} onChange={(event) => setEditDraft((current) => ({ ...current, displayName: event.target.value }))} />
                        ) : (
                          <><strong>{user.display_name}</strong><span className="user-username">@{user.username}</span></>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select className="table-select" value={editDraft.role} onChange={(event) => setEditDraft((current) => ({ ...current, role: event.target.value }))}>
                            <option value="ADMIN">Admin</option>
                            <option value="OPERATOR">Operator</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        ) : (
                          <span className={`role-badge role-${user.role.toLowerCase()}`}>{roleLabels[user.role]}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <label className="switch-label"><input type="checkbox" checked={editDraft.isActive} onChange={(event) => setEditDraft((current) => ({ ...current, isActive: event.target.checked }))} /> เปิดใช้งาน</label>
                        ) : (
                          <span className={user.is_active ? "status-dot-label active" : "status-dot-label inactive"}>{user.is_active ? "ใช้งาน" : "ปิด"}</span>
                        )}
                      </td>
                      <td>{formatDate(user.last_login_at)}</td>
                      <td>
                        <div className="user-actions">
                          {editing ? (
                            <>
                              <button className="button button-primary button-small" type="button" disabled={saving} onClick={() => saveEdit(user)}>บันทึก</button>
                              <button className="button button-secondary button-small" type="button" onClick={() => { setEditingId(null); setEditDraft(null); }}>ยกเลิก</button>
                            </>
                          ) : (
                            <>
                              <button className="button button-secondary button-small" type="button" onClick={() => beginEdit(user)}>แก้ไข</button>
                              <button className="button button-secondary button-small" type="button" disabled={saving} onClick={() => { setResetTarget(user); setResetPassword(""); }}>Reset password</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resetTarget && (
        <div className="auth-modal-backdrop" role="presentation">
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
            <h2 id="reset-password-title">ตั้งรหัสผ่านใหม่</h2>
            <p className="muted-text">บัญชี @{resetTarget.username} จะถูกออกจากระบบทุก session หลังเปลี่ยนรหัสผ่าน</p>
            <form onSubmit={handleResetPassword}>
              <label className="form-field">
                <span>รหัสผ่านใหม่</span>
                <input type="password" minLength={10} autoComplete="new-password" autoFocus value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required />
              </label>
              <div className="auth-modal-actions">
                <button className="button button-primary" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
                <button className="button button-secondary" type="button" disabled={saving} onClick={() => { setResetTarget(null); setResetPassword(""); }}>ยกเลิก</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default UsersPage;
