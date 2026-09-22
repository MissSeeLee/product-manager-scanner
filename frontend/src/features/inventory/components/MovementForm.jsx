import { useState } from "react";

import { MOVEMENT_FORM_CONFIG } from "../config/inventoryConfig";

function MovementForm({ action, loading = false, onSubmit, onCancel }) {
  const config = MOVEMENT_FORM_CONFIG[action];

  const [toLocation, setToLocation] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [note, setNote] = useState("");

  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [distributor, setDistributor] = useState("");
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");

  const [confirmed, setConfirmed] = useState(false);

  if (!config) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (config.requiresConfirmation && !confirmed) {
      return;
    }

    await onSubmit?.({
      toLocation: toLocation.trim(),
      performedBy: performedBy.trim(),
      note: note.trim(),
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

  return (
    <section className="card movement-form-card">
      <span className="section-kicker">LIFECYCLE ACTION</span>
      <h2 className="card-title">{config.title}</h2>

      {config.warning && (
        <div className="message message-warning" role="note">
          {config.warning}
        </div>
      )}

      <form className="form-grid" onSubmit={handleSubmit}>
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
            <label htmlFor="movementLocation">{config.locationLabel}</label>
            <input
              id="movementLocation"
              value={toLocation}
              onChange={(event) => setToLocation(event.target.value)}
              required
              disabled={loading}
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="movementPerformedBy">ผู้ดำเนินการ</label>
          <input
            id="movementPerformedBy"
            value={performedBy}
            onChange={(event) => setPerformedBy(event.target.value)}
            disabled={loading}
          />
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

        <div className="form-actions form-field-full">
          <button
            type="submit"
            className={
              action === "RETIRE"
                ? "button button-danger"
                : action === "REPLACED"
                  ? "button button-warning"
                  : "button button-primary"
            }
            disabled={loading || (config.requiresConfirmation && !confirmed)}
          >
            {loading ? "กำลังดำเนินการ..." : config.submitLabel}
          </button>

          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </section>
  );
}

export default MovementForm;
