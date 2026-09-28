import { useState } from "react";

import LocationSelect from "../../../shared/components/LocationSelect";
import { MOVEMENT_FORM_CONFIG } from "../config/inventoryConfig";

const LAST_PERFORMED_BY_KEY = "assetops.last-performed-by";

function MovementForm({
  action,
  loading = false,
  onSubmit,
  onCancel,
  locations = [],
  projects = [],
  embedded = false,
}) {
  const config = MOVEMENT_FORM_CONFIG[action];

  const [toLocation, setToLocation] = useState("");
  const [performedBy, setPerformedBy] = useState(
    () => localStorage.getItem(LAST_PERFORMED_BY_KEY) || "",
  );
  const [note, setNote] = useState("");

  const [projectId, setProjectId] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [distributor, setDistributor] = useState("");
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");

  const [confirmed, setConfirmed] = useState(false);

  function handleProjectChange(event) {
    const nextProjectId = event.target.value;

    setProjectId(nextProjectId);

    const nextProject = projects.find(
      (project) => String(project.id) === String(nextProjectId),
    );

    if (action === "ISSUE" && nextProject) {
      setResponsiblePerson(nextProject.responsible_person || "");
      setToLocation(nextProject.default_location || "");
      setExpectedReturnDate(nextProject.expected_end_date || "");
      return;
    }

    setResponsiblePerson("");
    setToLocation("");
    setExpectedReturnDate("");
  }



  if (!config) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (config.requiresConfirmation && !confirmed) {
      return;
    }

    if (!performedBy.trim()) {
      return;
    }

    if (action === "ISSUE" && !responsiblePerson.trim()) {
      return;
    }

    localStorage.setItem(LAST_PERFORMED_BY_KEY, performedBy.trim());

    await onSubmit?.({
      toLocation: toLocation.trim(),
      performedBy: performedBy.trim(),
      note: note.trim(),
      ...(action === "ISSUE"
        ? {
            projectId: projectId ? Number(projectId) : null,
            responsiblePerson: responsiblePerson.trim(),
            expectedReturnDate: expectedReturnDate || null,
          }
        : {}),
      ...(config.needsReplacement
        ? {
            newSerialNumber: newSerialNumber.trim(),
            distributor: distributor.trim(),
            warrantyStart: warrantyStart || null,
            warrantyEnd: warrantyEnd || null,
          }
        : {}),
    });
  }

  const content = (
    <>
      {config.warning && (
        <div className="message message-warning" role="note">
          {config.warning}
        </div>
      )}

      <form className="form-grid movement-action-form" onSubmit={handleSubmit}>
        {action === "ISSUE" && (
          <>
            <div className="form-field form-field-full">
              <label htmlFor="movementProject">งาน / โครงการ</label>
              <select
                id="movementProject"
                value={projectId}
                onChange={handleProjectChange}
                disabled={loading}
              >
                <option value="">ไม่ผูกกับโครงการ</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code
                      ? `${project.project_code} · ${project.project_name}`
                      : project.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="movementResponsible">ผู้รับผิดชอบ *</label>
              <input
                id="movementResponsible"
                value={responsiblePerson}
                onChange={(event) => setResponsiblePerson(event.target.value)}
                required
                disabled={loading}
                placeholder="ผู้รับหรือผู้ดูแลอุปกรณ์"
              />
            </div>

            <div className="form-field">
              <label htmlFor="movementExpectedReturn">กำหนดคืน</label>
              <input
                id="movementExpectedReturn"
                type="date"
                value={expectedReturnDate}
                onChange={(event) => setExpectedReturnDate(event.target.value)}
                disabled={loading}
              />
            </div>
          </>
        )}

        {config.needsReplacement && (
          <>
            <div className="form-field">
              <label htmlFor="newSerialNumber">Serial Number ใหม่</label>
              <input
                id="newSerialNumber"
                value={newSerialNumber}
                onChange={(event) => setNewSerialNumber(event.target.value)}
                required
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <div className="form-field">
              <label htmlFor="replacementDistributor">ผู้จัดจำหน่าย</label>
              <input
                id="replacementDistributor"
                value={distributor}
                onChange={(event) => setDistributor(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="replacementWarrantyStart">เริ่มประกัน</label>
              <input
                id="replacementWarrantyStart"
                type="date"
                value={warrantyStart}
                onChange={(event) => setWarrantyStart(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="replacementWarrantyEnd">สิ้นสุดประกัน</label>
              <input
                id="replacementWarrantyEnd"
                type="date"
                value={warrantyEnd}
                onChange={(event) => setWarrantyEnd(event.target.value)}
                disabled={loading}
              />
            </div>
          </>
        )}

        {config.needsLocation && (
          <div className="form-field">
            <label htmlFor="movementLocation">{config.locationLabel} *</label>
            {locations.length > 0 ? (
              <LocationSelect
                id="movementLocation"
                value={toLocation}
                onChange={(event) => setToLocation(event.target.value)}
                locations={locations}
                required
                disabled={loading}
              />
            ) : (
              <input
                id="movementLocation"
                value={toLocation}
                onChange={(event) => setToLocation(event.target.value)}
                required
                disabled={loading}
              />
            )}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="movementPerformedBy">ผู้ดำเนินการ *</label>
          <input
            id="movementPerformedBy"
            value={performedBy}
            onChange={(event) => setPerformedBy(event.target.value)}
            required
            disabled={loading}
            autoComplete="name"
          />
          <span className="field-hint">ระบบจำค่าล่าสุดไว้ใน Browser เครื่องนี้</span>
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="movementNote">หมายเหตุ</label>
          <textarea
            id="movementNote"
            rows="3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
          />
        </div>

        {config.requiresConfirmation && (
          <label className="confirmation-field form-field-full">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={loading}
            />
            <span>ฉันตรวจสอบ Serial Number และผลของการดำเนินการแล้ว</span>
          </label>
        )}

        <div className="form-actions form-field-full movement-dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            className={
              action === "RETIRE"
                ? "button button-danger"
                : action === "REPLACED"
                  ? "button button-warning"
                  : "button button-primary"
            }
            disabled={
              loading ||
              !toLocation.trim() ||
              !performedBy.trim() ||
              (action === "ISSUE" && !responsiblePerson.trim()) ||
              (config.requiresConfirmation && !confirmed)
            }
          >
            {loading ? "กำลังดำเนินการ..." : config.submitLabel}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <section className="card movement-form-card">
      <h2 className="card-title">{config.title}</h2>
      {content}
    </section>
  );
}

export default MovementForm;
