import { useMemo, useState } from "react";

import {
  importBulkInventory,
  validateBulkInventory,
} from "../api/inventoryApi";

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseSerials(text) {
  return text
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function QuickBatchForm({ products = [], onDone, onCancel }) {
  const [productId, setProductId] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIsoDate());
  const [performedBy, setPerformedBy] = useState("");
  const [distributor, setDistributor] = useState("");
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [serialText, setSerialText] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const serials = useMemo(() => parseSerials(serialText), [serialText]);
  const duplicateCount = useMemo(() => {
    const counts = new Map();
    let duplicates = 0;

    for (const serial of serials) {
      const next = (counts.get(serial) || 0) + 1;
      counts.set(serial, next);
      if (next === 2) {
        duplicates += 1;
      }
    }

    return duplicates;
  }, [serials]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (serials.length === 0) {
      setError("กรุณาใส่ Serial Number อย่างน้อย 1 รายการ");
      return;
    }

    if (duplicateCount > 0) {
      setError("มี Serial Number ซ้ำภายในรายการ กรุณาแก้ไขก่อนลงทะเบียน");
      return;
    }

    if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
      setError("วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน");
      return;
    }

    const rows = serials.map((serialNumber) => ({
      productId,
      serialNumber,
      currentLocation: currentLocation.trim(),
      receivedAt: receivedAt || null,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      performedBy: performedBy.trim(),
      distributor: distributor.trim(),
      warrantyStart: warrantyStart || null,
      warrantyEnd: warrantyEnd || null,
      note: note.trim(),
    }));

    setLoading(true);

    try {
      const validationResponse = await validateBulkInventory(rows);
      const validation = validationResponse?.data;

      if ((validation?.summary?.invalid || 0) > 0) {
        setResult({
          summary: {
            total: validation.summary.total,
            succeeded: 0,
            failed: validation.summary.invalid,
          },
          rows: validation.rows.map((row) => ({
            index: row.index,
            serialNumber: row.serialNumber,
            success: row.valid,
            message: row.valid
              ? "พร้อมลงทะเบียน"
              : row.errors.join(" · "),
          })),
        });
        return;
      }

      const response = await importBulkInventory(rows);
      setResult(response?.data ?? null);

      if ((response?.data?.summary?.failed || 0) === 0) {
        onDone?.(response);
      }
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถลงทะเบียนหลายอุปกรณ์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card intake-panel">
      <span className="section-kicker">QUICK BATCH</span>
      <h2 className="card-title">ลงทะเบียนหลาย Serial</h2>
      <p className="page-description">
        ใช้เมื่ออุปกรณ์เป็นรุ่นเดียวกันและข้อมูลรับเข้าเหมือนกัน วาง Serial Number จาก Excel ได้หนึ่งรายการต่อหนึ่งบรรทัด
      </p>

      {error && <div className="message message-error">{error}</div>}

      {result && (
        <div className={result.summary.failed ? "message message-warning" : "message message-success"}>
          สำเร็จ {result.summary.succeeded} / {result.summary.total} รายการ
          {result.summary.failed > 0 && ` · ไม่สำเร็จ ${result.summary.failed} รายการ`}
        </div>
      )}

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field-full">
          <label htmlFor="batchProductId">รุ่นสินค้า</label>
          <select
            id="batchProductId"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
            disabled={loading}
          >
            <option value="">-- เลือกรุ่นสินค้า --</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name} — {product.brand} / {product.part_number}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="batchLocation">ตำแหน่งเริ่มต้น</label>
          <input
            id="batchLocation"
            value={currentLocation}
            onChange={(event) => setCurrentLocation(event.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="batchReceivedAt">วันที่รับเข้า</label>
          <input
            id="batchReceivedAt"
            type="date"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="batchPerformedBy">ผู้รับเข้า</label>
          <input
            id="batchPerformedBy"
            value={performedBy}
            onChange={(event) => setPerformedBy(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="batchDistributor">ผู้จัดจำหน่าย</label>
          <input
            id="batchDistributor"
            value={distributor}
            onChange={(event) => setDistributor(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="batchWarrantyStart">วันที่เริ่มประกัน</label>
          <input
            id="batchWarrantyStart"
            type="date"
            value={warrantyStart}
            onChange={(event) => setWarrantyStart(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="batchWarrantyEnd">วันที่สิ้นสุดประกัน</label>
          <input
            id="batchWarrantyEnd"
            type="date"
            value={warrantyEnd}
            onChange={(event) => setWarrantyEnd(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="batchSerials">Serial Numbers</label>
          <textarea
            id="batchSerials"
            rows="10"
            value={serialText}
            onChange={(event) => setSerialText(event.target.value)}
            placeholder={"SN-001\nSN-002\nSN-003"}
            required
            disabled={loading}
            className="serial-text"
          />
          <small className="field-hint">
            ตรวจพบ {serials.length} Serial{duplicateCount > 0 ? ` · ซ้ำ ${duplicateCount}` : ""}
          </small>
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="batchNote">หมายเหตุการรับเข้า</label>
          <textarea
            id="batchNote"
            rows="3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
          />
        </div>

        {result?.rows?.some((row) => !row.success) && (
          <div className="import-error-list form-field-full">
            <strong>รายการที่ไม่สำเร็จ</strong>
            {result.rows
              .filter((row) => !row.success)
              .map((row) => (
                <div key={`${row.index}-${row.serialNumber || "unknown"}`}>
                  <span className="serial-text">{row.serialNumber || `แถว ${row.index + 1}`}</span>
                  <span>{row.message}</span>
                </div>
              ))}
          </div>
        )}

        <div className="form-actions form-field-full">
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? "กำลังลงทะเบียน..." : `ลงทะเบียน ${serials.length || 0} อุปกรณ์`}
          </button>
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={loading}>
            ยกเลิก
          </button>
        </div>
      </form>
    </section>
  );
}

export default QuickBatchForm;
