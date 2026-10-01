import { useEffect, useRef, useState } from "react";

import { formatDate } from "../../../shared/lib/formatters";

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function InventoryMetadataDialog({
  item,
  loading = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const panelRef = useRef(null);

  // The dialog is conditionally mounted by InventoryDetailPage.
  // Initialize form state once on mount instead of synchronizing props -> state
  // inside an effect. This avoids react-hooks/set-state-in-effect and prevents
  // unnecessary cascading renders.
  const initialSerialNumber = item?.serial_number || "";
  const initialWarrantyStart = toDateInput(item?.warranty_start);
  const initialWarrantyEnd = toDateInput(item?.warranty_end);

  const [serialNumber, setSerialNumber] = useState(() => initialSerialNumber);
  const [warrantyStart, setWarrantyStart] = useState(
    () => initialWarrantyStart,
  );
  const [warrantyEnd, setWarrantyEnd] = useState(() => initialWarrantyEnd);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onClose]);

  const cleanSerial = serialNumber.trim();
  const clientError = !cleanSerial
    ? "กรุณากรอก Serial Number"
    : warrantyStart && warrantyEnd && warrantyEnd < warrantyStart
      ? "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน"
      : "";

  const dirty =
    cleanSerial !== initialSerialNumber ||
    warrantyStart !== initialWarrantyStart ||
    warrantyEnd !== initialWarrantyEnd;

  function handleSubmit(event) {
    event.preventDefault();
    if (loading || clientError || !dirty) return;

    onSubmit?.({
      serialNumber: cleanSerial,
      warrantyStart: warrantyStart || null,
      warrantyEnd: warrantyEnd || null,
    });
  }

  return (
    <div
      className="movement-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <section
        ref={panelRef}
        className="movement-dialog asset-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-edit-dialog-title"
        tabIndex="-1"
      >
        <header className="movement-dialog-header">
          <div>
            <span className="movement-dialog-serial serial-text">
              {item?.serial_number}
            </span>
            <h2 id="asset-edit-dialog-title">แก้ไขข้อมูลอุปกรณ์</h2>
            <p>
              แก้เฉพาะข้อมูลประจำชิ้นและข้อมูลรับประกัน โดยไม่เปลี่ยน Lifecycle
            </p>
          </div>

          <button
            type="button"
            className="movement-dialog-close"
            onClick={onClose}
            disabled={loading}
            aria-label="ปิดหน้าต่าง"
          >
            ×
          </button>
        </header>

        <div className="movement-dialog-body">
          <div className="asset-edit-safety-note">
            <strong>ข้อมูลที่แก้จากหน้านี้ได้</strong>
            <span>
              Serial Number และช่วงรับประกันเท่านั้น การแก้ไขจะไม่สร้าง Movement
              และจะไม่เปลี่ยนสถานะ ตำแหน่ง โครงการ ผู้รับผิดชอบ หรือกำหนดคืน
            </span>
          </div>

          {(error || clientError) && (
            <div className="message message-error asset-edit-message">
              {error || clientError}
            </div>
          )}

          <form className="form-grid asset-edit-form" onSubmit={handleSubmit}>
            <label className="form-field form-field-full">
              <span className="form-label">Serial Number</span>
              <input
                type="text"
                value={serialNumber}
                onChange={(event) => setSerialNumber(event.target.value)}
                autoComplete="off"
                disabled={loading}
                required
              />
              <span className="asset-edit-field-hint">
                เป็นรหัสประจำอุปกรณ์ชิ้นนี้ ต้องไม่ซ้ำกับอุปกรณ์อื่น
              </span>
            </label>

            <label className="form-field">
              <span className="form-label">เริ่มรับประกัน</span>
              <input
                type="date"
                value={warrantyStart}
                onChange={(event) => setWarrantyStart(event.target.value)}
                disabled={loading}
              />
            </label>

            <label className="form-field">
              <span className="form-label">สิ้นสุดรับประกัน</span>
              <input
                type="date"
                value={warrantyEnd}
                onChange={(event) => setWarrantyEnd(event.target.value)}
                disabled={loading}
              />
            </label>

            <div className="form-field-full asset-edit-locked-section">
              <div className="asset-edit-locked-heading">
                <strong>ข้อมูลที่ล็อกไว้ในหน้าต่างนี้</strong>
                <span>
                  เพื่อไม่ให้การแก้ Metadata ข้ามกฎของ Operations และประวัติย้อนหลัง
                </span>
              </div>

              <dl className="asset-edit-readonly-grid">
                <div>
                  <dt>สถานะ</dt>
                  <dd>{item?.current_status || "—"}</dd>
                </div>
                <div>
                  <dt>ตำแหน่งปัจจุบัน</dt>
                  <dd>{item?.current_location || "—"}</dd>
                </div>
                <div>
                  <dt>งาน / โครงการ</dt>
                  <dd>
                    {item?.current_project_name
                      ? item.current_project_code
                        ? `${item.current_project_code} · ${item.current_project_name}`
                        : item.current_project_name
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>ผู้รับผิดชอบ</dt>
                  <dd>{item?.current_responsible_person || "—"}</dd>
                </div>
                <div>
                  <dt>กำหนดคืน</dt>
                  <dd>
                    {item?.expected_return_date
                      ? formatDate(item.expected_return_date)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>วันที่รับเข้า</dt>
                  <dd>
                    {item?.received_at ? formatDate(item.received_at) : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="form-field-full asset-edit-product-note">
              <strong>ข้อมูลรุ่นสินค้าเป็น Product Master</strong>
              <span>
                ชื่อรุ่น ยี่ห้อ และ Part Number อาจถูกใช้ร่วมกันหลายเครื่อง
                จึงไม่แก้จากหน้า Physical Asset นี้
              </span>
            </div>

            <div className="form-actions movement-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={loading || Boolean(clientError) || !dirty}
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export default InventoryMetadataDialog;
