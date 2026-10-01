import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import LocationSelect from "../../../shared/components/LocationSelect";
import { FeedbackMessage } from "../../../shared/components/PageState";
import { getLocations } from "../../locations/api/locationsApi";
import { getManagedProducts } from "../../management/api/managementApi";
import {
  importBulkInventory,
  validateBulkInventory,
} from "../api/inventoryApi";
import { createAtomicIntake } from "../api/assetManagementApi";
import CsvImportPanel from "../components/CsvImportPanel";

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function serialsFromText(value) {
  return [...new Set(
    String(value || "")
      .split(/[\n,;\t]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

const EMPTY_SINGLE = {
  productId: "",
  productMode: "existing",
  productName: "",
  brand: "",
  partNumber: "",
  category: "",
  description: "",
  serialNumber: "",
  currentLocation: "",
  receivedAt: todayIsoDate(),
  receivedBy: "",
  distributor: "",
  warrantyStart: "",
  warrantyEnd: "",
  note: "",
};

export default function IntakePageV2() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("single");
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [single, setSingle] = useState(EMPTY_SINGLE);
  const [batch, setBatch] = useState({
    productId: "",
    serialText: "",
    currentLocation: "",
    receivedAt: todayIsoDate(),
    receivedBy: "",
    distributor: "",
    warrantyStart: "",
    warrantyEnd: "",
    note: "",
  });
  const [batchValidation, setBatchValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getManagedProducts({ includeInactive: false }),
      getLocations(),
    ])
      .then(([productRows, locationRows]) => {
        if (!active) return;
        setProducts(Array.isArray(productRows) ? productRows : []);
        setLocations(Array.isArray(locationRows) ? locationRows : []);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดข้อมูลสำหรับ Intake ไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, []);

  const batchSerials = useMemo(
    () => serialsFromText(batch.serialText),
    [batch.serialText],
  );

  async function submitSingle(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        inventory: {
          serialNumber: single.serialNumber.trim(),
          currentLocation: single.currentLocation,
          receivedAt: single.receivedAt,
          timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
          performedBy: single.receivedBy.trim(),
          distributor: single.distributor.trim(),
          warrantyStart: single.warrantyStart || null,
          warrantyEnd: single.warrantyEnd || null,
          note: single.note.trim(),
        },
      };

      if (single.productMode === "existing") {
        payload.productId = Number(single.productId);
      } else {
        payload.product = {
          productName: single.productName.trim(),
          brand: single.brand.trim(),
          partNumber: single.partNumber.trim(),
          category: single.category.trim() || "ทั่วไป",
          description: single.description.trim(),
        };
      }

      const result = await createAtomicIntake(payload);
      const newId = result?.data?.item?.id;
      setSuccess(result?.message || "ลงทะเบียนอุปกรณ์เรียบร้อย");
      if (newId) {
        navigate(`/inventory/${newId}`, {
          replace: true,
          state: { notice: "ลงทะเบียนอุปกรณ์เรียบร้อย" },
        });
      }
    } catch (err) {
      setError(err.message || "ลงทะเบียนอุปกรณ์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function batchRows() {
    return batchSerials.map((serialNumber) => ({
      productId: Number(batch.productId),
      serialNumber,
      currentLocation: batch.currentLocation,
      receivedAt: batch.receivedAt,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      performedBy: batch.receivedBy.trim(),
      distributor: batch.distributor.trim(),
      warrantyStart: batch.warrantyStart || null,
      warrantyEnd: batch.warrantyEnd || null,
      note: batch.note.trim(),
    }));
  }

  async function validateBatch() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await validateBulkInventory(batchRows());
      setBatchValidation(result?.data ?? null);
    } catch (err) {
      setBatchValidation(null);
      setError(err.message || "ตรวจสอบ Batch ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function importBatch() {
    setBusy(true);
    setError("");
    try {
      const result = await importBulkInventory(batchRows());
      setSuccess(result?.message || "นำเข้า Batch เรียบร้อย");
      setBatchValidation(null);
      setBatch((current) => ({ ...current, serialText: "" }));
    } catch (err) {
      setError(err.message || "นำเข้า Batch ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const noLocations = locations.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="section-kicker">CONTROLLED INTAKE</span>
          <h1 className="page-title">นำอุปกรณ์เข้าระบบ</h1>
          <p className="page-description">
            Location ต้องมาจาก Location Master เท่านั้น และรุ่นใหม่ + Asset + RECEIVE
            จะบันทึกแบบ transaction เดียว
          </p>
        </div>
        <Link to="/inventory" className="button button-secondary">
          ← กลับ Asset Explorer
        </Link>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>
      <FeedbackMessage type="success">{success}</FeedbackMessage>

      {noLocations && (
        <div className="message message-error">
          ไม่มี Location ที่เลบ จึงไม่อนุญาตให้พิมพ์สถานที่เอง
          กรุณาให้ Admin เพิ่ม/เลบ Location ก่อน
        </div>
      )}

      <div className="ux-intake-tabs">
        <button
          type="button"
          className={mode === "single" ? "button button-primary" : "button button-secondary"}
          onClick={() => setMode("single")}
        >
          1 อุปกรณ์
        </button>
        <button
          type="button"
          className={mode === "batch" ? "button button-primary" : "button button-secondary"}
          onClick={() => setMode("batch")}
        >
          หลาย Serial
        </button>
        <button
          type="button"
          className={mode === "csv" ? "button button-primary" : "button button-secondary"}
          onClick={() => setMode("csv")}
        >
          CSV
        </button>
      </div>

      {mode === "single" && (
        <section className="card ux-editor-card">
          <form className="form-grid" onSubmit={submitSingle}>
            <div className="form-section form-field-full">
              <span className="form-step">01</span>
              <div>
                <strong>Product / Model</strong>
                <span>เลือก Master เดิม หรือสร้างรุ่นใหม่พร้อม Asset แบบ Atomic</span>
              </div>
            </div>

            <div className="form-field form-field-full">
              <div className="ux-segmented">
                <button
                  type="button"
                  className={single.productMode === "existing" ? "button button-primary" : "button button-secondary"}
                  onClick={() => setSingle((v) => ({ ...v, productMode: "existing" }))}
                >
                  เลือกรุ่นเดิม
                </button>
                <button
                  type="button"
                  className={single.productMode === "new" ? "button button-primary" : "button button-secondary"}
                  onClick={() => setSingle((v) => ({ ...v, productMode: "new" }))}
                >
                  สร้างรุ่นใหม่
                </button>
              </div>
            </div>

            {single.productMode === "existing" ? (
              <label className="form-field form-field-full">
                <span>รุ่นสินค้า *</span>
                <select
                  value={single.productId}
                  onChange={(e) => setSingle((v) => ({ ...v, productId: e.target.value }))}
                  required
                  disabled={busy}
                >
                  <option value="">-- เลือกรุ่นสินค้า --</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_name} — {product.brand} / {product.part_number}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="form-field">
                  <span>ชื่อรุ่น *</span>
                  <input value={single.productName} onChange={(e) => setSingle((v) => ({ ...v, productName: e.target.value }))} required disabled={busy} />
                </label>
                <label className="form-field">
                  <span>ยี่ห้อ *</span>
                  <input value={single.brand} onChange={(e) => setSingle((v) => ({ ...v, brand: e.target.value }))} required disabled={busy} />
                </label>
                <label className="form-field">
                  <span>Part Number *</span>
                  <input value={single.partNumber} onChange={(e) => setSingle((v) => ({ ...v, partNumber: e.target.value }))} required disabled={busy} />
                </label>
                <label className="form-field">
                  <span>หมวดหมู่</span>
                  <input value={single.category} onChange={(e) => setSingle((v) => ({ ...v, category: e.target.value }))} disabled={busy} />
                </label>
                <label className="form-field form-field-full">
                  <span>รายละเอียดรุ่น</span>
                  <textarea rows="2" value={single.description} onChange={(e) => setSingle((v) => ({ ...v, description: e.target.value }))} disabled={busy} />
                </label>
              </>
            )}

            <div className="form-section form-field-full">
              <span className="form-step">02</span>
              <div>
                <strong>Physical Asset</strong>
                <span>Serial ต้องไม่ซ้ำ และ Location เลือกจาก Master</span>
              </div>
            </div>

            <label className="form-field">
              <span>Serial Number *</span>
              <input value={single.serialNumber} onChange={(e) => setSingle((v) => ({ ...v, serialNumber: e.target.value }))} required disabled={busy} />
            </label>
            <label className="form-field">
              <span>ตำแหน่งเริ่มต้น *</span>
              <LocationSelect
                value={single.currentLocation}
                onChange={(e) => setSingle((v) => ({ ...v, currentLocation: e.target.value }))}
                locations={locations}
                required
                disabled={busy || noLocations}
              />
              <small className="field-hint">ไม่อนุญาต Free Text</small>
            </label>

            <div className="form-section form-field-full">
              <span className="form-step">03</span>
              <div>
                <strong>RECEIVE</strong>
                <span>ถ้าข้อมูลส่วนนี้ผิดภายหลัง ให้ใช้ “แก้ข้อมูลรับเข้า” ไม่ใช่ MOVE</span>
              </div>
            </div>

            <label className="form-field">
              <span>วันที่รับเข้า *</span>
              <input type="date" value={single.receivedAt} onChange={(e) => setSingle((v) => ({ ...v, receivedAt: e.target.value }))} required disabled={busy} />
            </label>
            <label className="form-field">
              <span>ผู้รับเข้า</span>
              <input value={single.receivedBy} onChange={(e) => setSingle((v) => ({ ...v, receivedBy: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>ผู้จัดจำหน่าย</span>
              <input value={single.distributor} onChange={(e) => setSingle((v) => ({ ...v, distributor: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>เริ่มรับประกัน</span>
              <input type="date" value={single.warrantyStart} onChange={(e) => setSingle((v) => ({ ...v, warrantyStart: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>สิ้นสุดรับประกัน</span>
              <input type="date" value={single.warrantyEnd} onChange={(e) => setSingle((v) => ({ ...v, warrantyEnd: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field form-field-full">
              <span>หมายเหตุ</span>
              <textarea rows="3" value={single.note} onChange={(e) => setSingle((v) => ({ ...v, note: e.target.value }))} disabled={busy} />
            </label>

            <div className="form-actions form-field-full">
              <button className="button button-primary" disabled={busy || noLocations}>
                {busy ? "กำลังบันทึก..." : "ลงทะเบียนอุปกรณ์"}
              </button>
            </div>
          </form>
        </section>
      )}

      {mode === "batch" && (
        <section className="card ux-editor-card">
          <div className="form-grid">
            <label className="form-field">
              <span>รุ่นสินค้า *</span>
              <select value={batch.productId} onChange={(e) => { setBatch((v) => ({ ...v, productId: e.target.value })); setBatchValidation(null); }} disabled={busy}>
                <option value="">-- เลือกรุ่นสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name} — {product.brand} / {product.part_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>ตำแหน่งเริ่มต้น *</span>
              <LocationSelect value={batch.currentLocation} onChange={(e) => { setBatch((v) => ({ ...v, currentLocation: e.target.value })); setBatchValidation(null); }} locations={locations} disabled={busy || noLocations} />
            </label>
            <label className="form-field form-field-full">
              <span>Serial Number *</span>
              <textarea
                rows="7"
                value={batch.serialText}
                onChange={(e) => { setBatch((v) => ({ ...v, serialText: e.target.value })); setBatchValidation(null); }}
                placeholder={"หนึ่ง Serial ต่อบรรทัด\nSN-001\nSN-002"}
                disabled={busy}
              />
              <small className="field-hint">{batchSerials.length} Serial ที่ไม่ซ้ำกัน</small>
            </label>
            <label className="form-field">
              <span>วันที่รับเข้า *</span>
              <input type="date" value={batch.receivedAt} onChange={(e) => setBatch((v) => ({ ...v, receivedAt: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>ผู้รับเข้า</span>
              <input value={batch.receivedBy} onChange={(e) => setBatch((v) => ({ ...v, receivedBy: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>ผู้จัดจำหน่าย</span>
              <input value={batch.distributor} onChange={(e) => setBatch((v) => ({ ...v, distributor: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>เริ่มรับประกัน</span>
              <input type="date" value={batch.warrantyStart} onChange={(e) => setBatch((v) => ({ ...v, warrantyStart: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field">
              <span>สิ้นสุดรับประกัน</span>
              <input type="date" value={batch.warrantyEnd} onChange={(e) => setBatch((v) => ({ ...v, warrantyEnd: e.target.value }))} disabled={busy} />
            </label>
            <label className="form-field form-field-full">
              <span>หมายเหตุ</span>
              <textarea rows="2" value={batch.note} onChange={(e) => setBatch((v) => ({ ...v, note: e.target.value }))} disabled={busy} />
            </label>

            {batchValidation && (
              <div className="message message-info form-field-full">
                ตรวจสอบแล้ว: ทั้งหมด {batchValidation.summary?.total ?? batchSerials.length} ·
                ผ่าน {batchValidation.summary?.valid ?? 0} ·
                ไม่ผ่าน {batchValidation.summary?.invalid ?? 0}
              </div>
            )}

            <div className="form-actions form-field-full">
              {batchValidation && Number(batchValidation.summary?.invalid || 0) === 0 ? (
                <button type="button" className="button button-primary" onClick={importBatch} disabled={busy || noLocations}>
                  {busy ? "กำลังนำเข้า..." : "ยืนยันนำเข้า Batch"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={validateBatch}
                  disabled={busy || noLocations || !batch.productId || !batch.currentLocation || batchSerials.length === 0}
                >
                  {busy ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนนำเข้า"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {mode === "csv" && (
        <div className="ux-csv-master-note">
          <div className="message message-info">
            CSV ยังใช้ Template 12 คอลัมน์เดิม แต่คอลัมน์ Location ทุกแถวจะถูกตรวจเทียบ Location Master ฝั่ง Backend
            และจะ reject ทั้งแถวที่ไม่ตรง/Inactive
          </div>
          <CsvImportPanel
            onDone={(response) => setSuccess(response?.message || "นำเข้า CSV เรียบร้อย")}
            onCancel={() => setMode("single")}
          />
        </div>
      )}
    </>
  );
}
