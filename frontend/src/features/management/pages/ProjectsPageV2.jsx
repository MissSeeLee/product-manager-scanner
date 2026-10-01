import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import LocationSelect from "../../../shared/components/LocationSelect";
import { useCan } from "../../auth/capabilities";
import { getLocations } from "../../locations/api/locationsApi";
import {
  createProject,
  updateProject,
} from "../../projects/api/projectsApi";
import {
  deleteManagedProject,
  getManagedProjects,
  setManagedProjectStatus,
} from "../api/managementApi";

const EMPTY = {
  projectCode: "",
  projectName: "",
  responsiblePerson: "",
  defaultLocation: "",
  startDate: "",
  expectedEndDate: "",
};

const STATUS_LABEL = {
  ACTIVE: "กำลังดำเนินการ",
  CLOSED: "ปิดงาน",
  CANCELLED: "ยกเลิก",
};

export default function ProjectsPageV2() {
  const canManage = useCan("project.manage");
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [projectRows, locationRows] = await Promise.all([
      getManagedProjects(),
      getLocations(),
    ]);
    setRows(projectRows);
    setLocations(locationRows);
  }

  useEffect(() => {
    let active = true;
    Promise.all([getManagedProjects(), getLocations()])
      .then(([projectRows, locationRows]) => {
        if (!active) return;
        setRows(projectRows);
        setLocations(locationRows);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดโครงการไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setEditing("new");
    setForm(EMPTY);
  }

  function startEdit(row) {
    setEditing(row.id);
    setForm({
      projectCode: row.project_code || "",
      projectName: row.project_name || "",
      responsiblePerson: row.responsible_person || "",
      defaultLocation: row.default_location || "",
      startDate: row.start_date ? String(row.start_date).slice(0, 10) : "",
      expectedEndDate: row.expected_end_date
        ? String(row.expected_end_date).slice(0, 10)
        : "",
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        projectCode: form.projectCode.trim() || null,
        responsiblePerson: form.responsiblePerson.trim() || null,
        defaultLocation: form.defaultLocation || null,
        startDate: form.startDate || null,
        expectedEndDate: form.expectedEndDate || null,
      };

      if (editing === "new") {
        await createProject(payload);
        setMessage("สร้างโครงการเรียบร้อย");
      } else {
        await updateProject(editing, payload);
        setMessage("แก้ไขโครงการเรียบร้อย");
      }

      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err.message || "บันทึกโครงการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(row, status) {
    const reason = window.prompt(
      status === "ACTIVE"
        ? "เหตุผลที่เปิดโครงการอีกครั้ง"
        : status === "CLOSED"
          ? "เหตุผลที่ปิดโครงการ"
          : "เหตุผลที่ยกเลิกโครงการ",
    );
    if (!reason?.trim()) return;

    setBusy(true);
    setError("");
    try {
      const result = await setManagedProjectStatus(
        row.id,
        status,
        reason.trim(),
      );
      setMessage(result?.message || "เปลี่ยนสถานะโครงการเรียบร้อย");
      await load();
    } catch (err) {
      setError(err.message || "เปลี่ยนสถานะโครงการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function removeUnused(row) {
    if (Number(row.operation_count || 0) > 0) return;
    if (!window.confirm(`ลบโครงการ “${row.project_name}” ที่ยังไม่เคยใช้งาน?`)) return;

    setBusy(true);
    setError("");
    try {
      const result = await deleteManagedProject(row.id);
      setMessage(result?.message || "ลบโครงการที่ยังไม่เคยใช้งานเรียบร้อย");
      await load();
    } catch (err) {
      setError(err.message || "ลบโครงการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ / งาน</h1>
          <p className="page-description">
            Create / Edit / Close / Cancel / Reopen ในหน้าเดียว · งานที่เคยใช้จะเก็บ History
          </p>
        </div>
        {canManage && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            + สร้างโครงการ
          </button>
        )}
      </div>

      {error && <div className="message message-error">{error}</div>}
      {message && <div className="message message-success">{message}</div>}

      {editing && canManage && (
        <section className="card ux-editor-card">
          <h2 className="card-title">
            {editing === "new" ? "สร้างโครงการ" : "แก้ไขโครงการ"}
          </h2>
          <form className="form-grid" onSubmit={save}>
            <label className="form-field">
              <span>รหัสโครงการ</span>
              <input value={form.projectCode} onChange={(e) => setForm((v) => ({ ...v, projectCode: e.target.value }))} />
            </label>
            <label className="form-field">
              <span>ชื่อโครงการ *</span>
              <input value={form.projectName} onChange={(e) => setForm((v) => ({ ...v, projectName: e.target.value }))} required />
            </label>
            <label className="form-field">
              <span>ผู้รับผิดชอบ</span>
              <input value={form.responsiblePerson} onChange={(e) => setForm((v) => ({ ...v, responsiblePerson: e.target.value }))} />
            </label>
            <label className="form-field">
              <span>สถานที่เริ่มต้น</span>
              <LocationSelect
                value={form.defaultLocation}
                onChange={(e) => setForm((v) => ({ ...v, defaultLocation: e.target.value }))}
                locations={locations}
                placeholder="ไม่ระบุ"
              />
            </label>
            <label className="form-field">
              <span>วันเริ่ม</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm((v) => ({ ...v, startDate: e.target.value }))} />
            </label>
            <label className="form-field">
              <span>กำหนดเสร็จ</span>
              <input type="date" value={form.expectedEndDate} onChange={(e) => setForm((v) => ({ ...v, expectedEndDate: e.target.value }))} />
            </label>
            <div className="form-actions form-field-full">
              <button className="button button-primary" disabled={busy}>บันทึก</button>
              <button type="button" className="button button-secondary" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </form>
        </section>
      )}

      <div className="ux-card-grid">
        {rows.map((row) => (
          <article key={row.id} className="card ux-project-card">
            <div className="ux-project-card-head">
              <div>
                <span className="section-kicker">{row.project_code || "PROJECT"}</span>
                <h2 className="card-title">{row.project_name}</h2>
              </div>
              <span className={`ux-status-pill ux-status-${String(row.status).toLowerCase()}`}>
                {STATUS_LABEL[row.status] || row.status}
              </span>
            </div>

            <dl className="ux-project-stats">
              <div><dt>กำลังใช้งาน</dt><dd>{row.active_asset_count}</dd></div>
              <div><dt>เกินกำหนด</dt><dd>{row.overdue_asset_count}</dd></div>
              <div><dt>Operations</dt><dd>{row.operation_count}</dd></div>
            </dl>

            <div className="ux-project-meta">
              <span>ผู้รับผิดชอบ: {row.responsible_person || "-"}</span>
              <span>สถานที่: {row.default_location || "-"}</span>
            </div>

            <div className="ux-row-actions">
              <Link to={`/projects/${row.id}`} className="button button-secondary button-inline">
                รายละเอียด
              </Link>

              {canManage && (
                <>
                  <button type="button" className="button button-secondary button-inline" onClick={() => startEdit(row)}>
                    แก้ไข
                  </button>

                  {row.status === "ACTIVE" ? (
                    <>
                      <button type="button" className="button button-secondary button-inline" onClick={() => changeStatus(row, "CLOSED")} disabled={busy}>
                        ปิดงาน
                      </button>
                      <button type="button" className="button button-danger button-inline" onClick={() => changeStatus(row, "CANCELLED")} disabled={busy}>
                        ยกเลิกงาน
                      </button>
                    </>
                  ) : (
                    <button type="button" className="button button-secondary button-inline" onClick={() => changeStatus(row, "ACTIVE")} disabled={busy}>
                      เปิดอีกครั้ง
                    </button>
                  )}

                  <button
                    type="button"
                    className="button button-danger button-inline"
                    onClick={() => removeUnused(row)}
                    disabled={busy || Number(row.operation_count || 0) > 0}
                    title={
                      Number(row.operation_count || 0) > 0
                        ? "โครงการเคยถูกใช้งานแล้ว ให้ Close/Cancel แทน"
                        : "ลบได้เฉพาะโครงการที่ยังไม่เคยใช้งาน"
                    }
                  >
                    ลบ
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
