import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";

import { createProject, getProjects } from "../api/projectsApi";
import { getLocations } from "../../locations/api/locationsApi";
import LocationSelect from "../../../shared/components/LocationSelect";
import { FeedbackMessage, LoadingState } from "../../../shared/components/PageState";
import { formatDate } from "../../../shared/lib/formatters";

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");

  async function load() {
    const [projectData, locationData] = await Promise.all([
      getProjects(),
      getLocations(),
    ]);
    setProjects(projectData);
    setLocations(locationData);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([getProjects(), getLocations()])
      .then(([projectData, locationData]) => {
        if (!cancelled) {
          setProjects(projectData);
          setLocations(locationData);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดรายการโครงการได้");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await createProject({
        projectCode: projectCode.trim(),
        projectName: projectName.trim(),
        responsiblePerson: responsiblePerson.trim(),
        defaultLocation,
        startDate: startDate || null,
        expectedEndDate: expectedEndDate || null,
      });

      await load();
      setSuccess(response?.message || "สร้างโครงการเรียบร้อย");
      setShowForm(false);
      setProjectCode("");
      setProjectName("");
      setResponsiblePerson("");
      setDefaultLocation("");
      setStartDate("");
      setExpectedEndDate("");
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถสร้างโครงการได้");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="กำลังโหลดรายการโครงการ..." />;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ / งาน</h1>
          <p className="page-description">
            รวมอุปกรณ์ที่เบิกไปใช้งานภายใต้งานเดียวกัน เพื่อเห็นของที่ยังค้างและกำหนดคืน
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? "ปิดแบบฟอร์ม" : "+ สร้างโครงการ"}
        </button>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>
      <FeedbackMessage type="success">{success}</FeedbackMessage>

      {showForm && (
        <section className="card project-create-card">
          <h2 className="card-title">สร้างโครงการหรืองาน</h2>
          <p className="project-form-intro">
            ค่าเหล่านี้จะถูกเติมอัตโนมัติเมื่อต้องเบิกอุปกรณ์เข้าโครงการ ลดการกรอกข้อมูลซ้ำ
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="projectCode">รหัสโครงการ</label>
              <input
                id="projectCode"
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value)}
                placeholder="เช่น PRJ-2026-014"
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectName">ชื่อโครงการ / งาน *</label>
              <input
                id="projectName"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectResponsible">ผู้รับผิดชอบ</label>
              <input
                id="projectResponsible"
                value={responsiblePerson}
                onChange={(event) => setResponsiblePerson(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectLocation">สถานที่หลัก</label>
              <LocationSelect
                id="projectLocation"
                value={defaultLocation}
                onChange={(event) => setDefaultLocation(event.target.value)}
                locations={locations}
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectStartDate">วันที่เริ่ม</label>
              <input
                id="projectStartDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectEndDate">กำหนดสิ้นสุด / คืนอุปกรณ์</label>
              <input
                id="projectEndDate"
                type="date"
                value={expectedEndDate}
                onChange={(event) => setExpectedEndDate(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "กำลังสร้าง..." : "สร้างโครงการ"}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setShowForm(false)} disabled={saving}>
                ยกเลิก
              </button>
            </div>
          </form>
        </section>
      )}

      {projects.length === 0 ? (
        <section className="card compact-empty">ยังไม่มีโครงการ สร้างเมื่อมีงานที่ต้องใช้อุปกรณ์หลายรายการร่วมกัน</section>
      ) : (
        <div className="project-list-grid">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="project-card">
              <div className="project-card-top">
                <div>
                  <span className="project-code">{project.project_code || "PROJECT"}</span>
                  <strong>{project.project_name}</strong>
                </div>
                <span className={`project-status project-status-${project.status.toLowerCase()}`}>
                  {project.status === "ACTIVE" ? "กำลังดำเนินการ" : project.status === "CLOSED" ? "ปิดงาน" : "ยกเลิก"}
                </span>
              </div>

              <div className="project-card-meta">
                <span>ผู้รับผิดชอบ: {project.responsible_person || "ไม่ระบุ"}</span>
                <span>สถานที่: {project.default_location || "ไม่ระบุ"}</span>
                <span>กำหนดจบ: {project.expected_end_date ? formatDate(project.expected_end_date) : "ไม่กำหนด"}</span>
              </div>

              <div className="project-card-counts">
                <span><strong>{project.active_asset_count}</strong> กำลังใช้งาน</span>
                <span className={project.overdue_asset_count > 0 ? "project-overdue" : ""}>
                  <strong>{project.overdue_asset_count}</strong> เกินกำหนด
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

// ASSETOPS-PROJECT-MANAGEMENT-PANEL-v1

async function projectMgmtRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
  }

  const type = response.headers.get("content-type") || "";
  const result = type.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const error = new Error(
      result?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    );

    error.data = result?.data || null;
    throw error;
  }

  return result;
}

function projectMgmtRows(result) {
  return Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result)
      ? result
      : [];
}

function projectMgmtError(error) {
  const usage = error?.data?.usage;

  if (!usage) return error.message;

  const details = [];

  if (usage.activeAssets) {
    details.push(`อุปกรณ์ยังใช้งาน ${usage.activeAssets}`);
  }

  if (usage.operations) {
    details.push(`Operation ${usage.operations}`);
  }

  if (usage.movements) {
    details.push(`Movement ${usage.movements}`);
  }

  return `${error.message}${details.length ? ` (${details.join(", ")})` : ""}`;
}

function ProjectManagementPanel() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [responsible, setResponsible] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const selected = useMemo(
    () =>
      projects.find(
        (project) => String(project.id) === String(selectedId),
      ) || null,
    [projects, selectedId],
  );

  async function fetchAllProjects() {
    const statuses = ["ACTIVE", "CLOSED", "CANCELLED"];

    const batches = await Promise.all(
      statuses.map(async (status) => {
        try {
          return projectMgmtRows(
            await projectMgmtRequest(
              `/api/projects?status=${encodeURIComponent(status)}`,
            ),
          );
        } catch {
          return [];
        }
      }),
    );

    const byId = new Map();

    batches.flat().forEach((project) => {
      if (project?.id != null) {
        byId.set(String(project.id), project);
      }
    });

    if (byId.size === 0) {
      projectMgmtRows(await projectMgmtRequest("/api/projects")).forEach(
        (project) => byId.set(String(project.id), project),
      );
    }

    return Array.from(byId.values());
  }

  async function refresh() {
    const rows = await fetchAllProjects();

    setProjects(rows);

    setSelectedId((current) =>
      rows.some((p) => String(p.id) === String(current))
        ? current
        : rows[0]?.id != null
          ? String(rows[0].id)
          : "",
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchAllProjects();

        if (!cancelled) {
          setProjects(rows);
          setSelectedId(
            rows[0]?.id != null ? String(rows[0].id) : "",
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function edit() {
    if (!selected) return;

    setName(selected.project_name || "");
    setCode(selected.project_code || "");
    setResponsible(selected.responsible_person || "");
    setLocation(selected.default_location || "");
    setStartDate(selected.start_date?.slice?.(0, 10) || "");
    setEndDate(selected.expected_end_date?.slice?.(0, 10) || "");
    setError("");
    setSuccess("");
    setEditing(true);
  }

  async function save(event) {
    event.preventDefault();

    if (!selected || !name.trim()) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await projectMgmtRequest(`/api/projects/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          projectName: name.trim(),
          projectCode: code.trim(),
          responsiblePerson: responsible.trim(),
          defaultLocation: location.trim(),
          startDate: startDate || null,
          expectedEndDate: endDate || null,
        }),
      });

      setEditing(false);
      setSuccess("แก้ไขโครงการ / งานเรียบร้อย");
      await refresh();
    } catch (requestError) {
      setError(projectMgmtError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!selected) return;

    const next = selected.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    const label = next === "CLOSED" ? "ปิดงาน" : "เปิดงานอีกครั้ง";

    if (!window.confirm(`${label} “${selected.project_name}” หรือไม่?`)) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await projectMgmtRequest(
        `/api/projects/${selected.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        },
      );

      setSuccess(result?.message || `${label}เรียบร้อย`);
      await refresh();
    } catch (requestError) {
      setError(projectMgmtError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;

    if (
      !window.confirm(
        `ลบ “${selected.project_name}” ถาวรหรือไม่?\n\n` +
          "ลบถาวรได้เฉพาะโครงการที่ยังไม่เคยถูกใช้งาน",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await projectMgmtRequest(
        `/api/projects/${selected.id}`,
        { method: "DELETE" },
      );

      setSuccess(result?.message || "ลบโครงการเรียบร้อย");
      setEditing(false);
      await refresh();
    } catch (requestError) {
      setError(projectMgmtError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card project-admin-panel">
      <div className="project-admin-head">
        <div>
          <div className="eyebrow">PROJECT MANAGEMENT</div>
          <h2>จัดการโครงการ / งาน</h2>
          <p className="text-muted">
            แก้ไข ปิดงาน เปิดงานอีกครั้ง และลบโครงการที่ยังไม่เคยถูกใช้งาน
          </p>
        </div>
      </div>

      {error ? (
        <div className="feedback-message feedback-message-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="feedback-message feedback-message-success">
          {success}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <div className="text-muted">ยังไม่มีโครงการ / งาน</div>
      ) : (
        <>
          <div className="project-admin-selector">
            <div className="form-field">
              <label htmlFor="adminProjectSelect">เลือกโครงการ / งาน</label>
              <select
                id="adminProjectSelect"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setEditing(false);
                  setError("");
                  setSuccess("");
                }}
                disabled={busy}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_name}
                    {project.project_code ? ` · ${project.project_code}` : ""}
                    {project.status !== "ACTIVE"
                      ? ` · ${project.status}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {selected ? (
              <span
                className={`project-admin-status ${
                  selected.status === "ACTIVE" ? "is-active" : ""
                }`}
              >
                {selected.status === "ACTIVE"
                  ? "กำลังดำเนินการ"
                  : selected.status === "CLOSED"
                    ? "ปิดงานแล้ว"
                    : "ยกเลิก"}
              </span>
            ) : null}
          </div>

          {editing ? (
            <form className="project-admin-form" onSubmit={save}>
              <div className="form-field">
                <label htmlFor="adminProjectName">ชื่อโครงการ / งาน *</label>
                <input
                  id="adminProjectName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label htmlFor="adminProjectCode">รหัสโครงการ</label>
                <input
                  id="adminProjectCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label htmlFor="adminProjectResponsible">ผู้รับผิดชอบ</label>
                <input
                  id="adminProjectResponsible"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label htmlFor="adminProjectLocation">สถานที่</label>
                <input
                  id="adminProjectLocation"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label htmlFor="adminProjectStart">วันเริ่มงาน</label>
                <input
                  id="adminProjectStart"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label htmlFor="adminProjectEnd">กำหนดเสร็จ</label>
                <input
                  id="adminProjectEnd"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="project-admin-actions form-field-full">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy || !name.trim()}
                >
                  บันทึก
                </button>

                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : selected ? (
            <>
              <div className="project-admin-summary">
                <div>
                  <span>ผู้รับผิดชอบ</span>
                  <strong>{selected.responsible_person || "ไม่ระบุ"}</strong>
                </div>
                <div>
                  <span>สถานที่</span>
                  <strong>{selected.default_location || "ไม่ระบุ"}</strong>
                </div>
                <div>
                  <span>วันเริ่ม</span>
                  <strong>
                    {selected.start_date?.slice?.(0, 10) || "ไม่กำหนด"}
                  </strong>
                </div>
                <div>
                  <span>กำหนดเสร็จ</span>
                  <strong>
                    {selected.expected_end_date?.slice?.(0, 10) || "ไม่กำหนด"}
                  </strong>
                </div>
              </div>

              <div className="project-admin-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={edit}
                  disabled={busy}
                >
                  แก้ไข
                </button>

                {selected.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={toggleStatus}
                    disabled={busy}
                  >
                    {selected.status === "ACTIVE"
                      ? "ปิดงาน"
                      : "เปิดงานอีกครั้ง"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="button button-danger"
                  onClick={remove}
                  disabled={busy}
                >
                  ลบถาวร
                </button>
              </div>
            </>
          ) : null}

          <div className="project-admin-note">
            โครงการที่เคยมีการเบิก คืน ย้าย หรือมีอุปกรณ์อ้างอิง
            จะลบถาวรไม่ได้ เพื่อรักษา Audit History
          </div>
        </>
      )}
    </section>
  );
}

function ProjectsPageWithManagement() {
  return (
    <>
      <ProjectsPage />
      <ProjectManagementPanel />
    </>
  );
}

export default ProjectsPageWithManagement;
