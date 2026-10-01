import { useEffect, useState } from "react";

import { useCan } from "../../auth/capabilities";
import {
  createLocation,
  deleteLocation,
  setLocationActive,
  updateLocation,
} from "../../locations/api/locationsApi";
import { getManagedLocations } from "../api/managementApi";

export default function LocationsPageV2() {
  const canManage = useCan("location.manage");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setRows(await getManagedLocations());
  }

  useEffect(() => {
    let active = true;
    getManagedLocations()
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err.message || "โหลดสถานที่ไม่สำเร็จ"));
    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setEditing("new");
    setLocationName("");
    setLocationCode("");
  }

  function startEdit(row) {
    setEditing(row);
    setLocationName(row.location_name || "");
    setLocationCode(row.location_code || "");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing === "new") {
        await createLocation({ locationName, locationCode });
        setMessage("สร้างสถานที่เรียบร้อย");
      } else {
        await updateLocation(editing.id, {
          locationName: editing.can_rename ? locationName : editing.location_name,
          locationCode,
        });
        setMessage("แก้ไขสถานที่เรียบร้อย");
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || "บันทึกสถานที่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    setBusy(true);
    setError("");
    try {
      const result = await setLocationActive(row.id, !row.is_active);
      setMessage(result?.message || "เปลี่ยนสถานะสถานที่เรียบร้อย");
      await load();
    } catch (err) {
      setError(err.message || "เปลี่ยนสถานะสถานที่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!row.can_delete) return;


    setBusy(true);
    setError("");
    try {
      const result = await deleteLocation(row.id);
      setMessage(result?.message || "ลบสถานที่เรียบร้อย");
      await load();
    } catch (err) {
      setError(err.message || "ลบสถานที่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">สถานที่</h1>
          <p className="page-description">
            Location Master เป็น Single Source of Truth ของ Intake และ Operations
          </p>
        </div>
        {canManage && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            + เพิ่มสถานที่
          </button>
        )}
      </div>

      {error && <div className="message message-error">{error}</div>}
      {message && <div className="message message-success">{message}</div>}

      {editing && canManage && (
        <section className="card ux-editor-card">
          <h2 className="card-title">
            {editing === "new" ? "เพิ่มสถานที่" : "แก้ไขสถานที่"}
          </h2>
          {editing !== "new" && !editing.can_rename && (
            <div className="message message-warning">
              สถานที่นี้มีประวัติใช้งานแล้ว ชื่อจึงถูกล็อกเพื่อไม่ทำลาย Historical Context
            </div>
          )}
          <form className="form-grid" onSubmit={save}>
            <label className="form-field">
              <span>ชื่อสถานที่ *</span>
              <input value={locationName} onChange={(e) => setLocationName(e.target.value)} required disabled={editing !== "new" && !editing.can_rename} />
            </label>
            <label className="form-field">
              <span>Location Code</span>
              <input value={locationCode} onChange={(e) => setLocationCode(e.target.value)} />
            </label>
            <div className="form-actions form-field-full">
              <button className="button button-primary" disabled={busy}>บันทึก</button>
              <button type="button" className="button button-secondary" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </form>
        </section>
      )}

      <section className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>สถานที่</th><th>Code</th><th>Assets ปัจจุบัน</th>
              <th>Movement History</th><th>Projects</th><th>สถานะ</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.location_name}</strong></td>
                <td>{row.location_code || "-"}</td>
                <td>{row.current_asset_count}</td>
                <td>{row.movement_usage_count}</td>
                <td>{row.project_usage_count}</td>
                <td>{row.is_active ? "Active" : "Inactive"}</td>
                <td>
                  {canManage && (
                    <div className="ux-row-actions">
                      <button type="button" className="button button-secondary button-inline" onClick={() => startEdit(row)}>แก้ไข</button>
                      <button hidden type="button" className="button button-secondary button-inline" onClick={() => toggle(row)} disabled={busy}>
                        {row.is_active ? "ลบ" : "เลบ"}
                      </button>
                      <button hidden
                        type="button"
                        className="button button-danger button-inline"
                        onClick={() => remove(row)}
                        disabled={busy || !row.can_delete}
                        title={row.can_delete ? "ยังไม่เคยใช้งาน จึงลบได้" : "เคยใช้งานแล้ว ให้ลบแทน"}
                      >
                        ลบ
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
