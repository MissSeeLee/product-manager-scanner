import { useMemo, useState } from "react";

import {
  importBulkInventory,
  validateBulkInventory,
} from "../api/inventoryApi";
import { downloadCsv, parseCsv } from "../../../shared/lib/csv";

const FIELD_OPTIONS = [
  ["", "ไม่ใช้คอลัมน์นี้"],
  ["serialNumber", "Serial Number *"],
  ["productName", "ชื่อรุ่น *"],
  ["brand", "ยี่ห้อ *"],
  ["partNumber", "Part Number *"],
  ["category", "หมวดหมู่"],
  ["description", "รายละเอียดรุ่น"],
  ["currentLocation", "ตำแหน่งเริ่มต้น *"],
  ["receivedAt", "วันที่รับเข้า"],
  ["performedBy", "ผู้รับเข้า"],
  ["distributor", "ผู้จัดจำหน่าย"],
  ["warrantyStart", "วันที่เริ่มประกัน"],
  ["warrantyEnd", "วันที่สิ้นสุดประกัน"],
  ["note", "หมายเหตุ"],
];

const HEADER_ALIASES = {
  serialNumber: ["serial", "serialnumber", "serialno", "sn", "s/n"],
  productName: ["product", "productname", "model", "modelname", "device"],
  brand: ["brand", "manufacturer", "maker"],
  partNumber: ["partnumber", "partno", "p/n", "pn"],
  category: ["category", "type"],
  description: ["description", "detail", "details"],
  currentLocation: ["location", "room", "site"],
  receivedAt: ["receiveddate", "receivedat", "date received", "receive date"],
  performedBy: ["receivedby", "performedby", "receiver"],
  distributor: ["distributor", "vendor", "supplier"],
  warrantyStart: ["warrantystart", "warranty start"],
  warrantyEnd: ["warrantyend", "warranty end", "warrantyexpiry"],
  note: ["note", "notes", "remark", "remarks"],
};

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[\s_-]/g, "").trim();
}

function guessMapping(headers) {
  const mapping = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let match = "";

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        match = field;
        break;
      }
    }

    mapping[header] = match;
  }

  return mapping;
}

function buildRows(sourceRows, mapping) {
  return sourceRows.map((source) => {
    const flat = {};

    for (const [header, field] of Object.entries(mapping)) {
      if (field) {
        flat[field] = source[header] ?? "";
      }
    }

    return {
      serialNumber: flat.serialNumber,
      currentLocation: flat.currentLocation,
      receivedAt: flat.receivedAt || null,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      performedBy: flat.performedBy,
      distributor: flat.distributor,
      warrantyStart: flat.warrantyStart || null,
      warrantyEnd: flat.warrantyEnd || null,
      note: flat.note,
      product: {
        productName: flat.productName,
        brand: flat.brand,
        partNumber: flat.partNumber,
        category: flat.category,
        description: flat.description,
      },
    };
  });
}

function CsvImportPanel({ onDone, onCancel }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [mapping, setMapping] = useState({});

  const [validation, setValidation] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mappedRows = useMemo(
    () => buildRows(sourceRows, mapping),
    [sourceRows, mapping],
  );

  const selectedFields = new Set(Object.values(mapping).filter(Boolean));
  const requiredMapped = [
    "serialNumber",
    "productName",
    "brand",
    "partNumber",
    "currentLocation",
  ].every((field) => selectedFields.has(field));

  async function handleFile(event) {
    const file = event.target.files?.[0];

    setError("");
    setValidation(null);
    setImportResult(null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("เวอร์ชันนี้รองรับไฟล์ CSV เท่านั้น");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("ไฟล์ใหญ่เกิน 5 MB กรุณาแบ่งไฟล์ก่อนนำเข้า");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("ไม่พบข้อมูลในไฟล์ CSV");
        return;
      }

      if (parsed.rows.length > 2000) {
        setError("รองรับสูงสุด 2,000 แถวต่อการนำเข้าหนึ่งครั้ง");
        return;
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setSourceRows(parsed.rows);
      setMapping(guessMapping(parsed.headers));
    } catch (parseError) {
      if (parseError?.message === "CSV_UNCLOSED_QUOTE") {
        setError("ไฟล์ CSV มีเครื่องหมายคำพูดเปิดไว้แต่ไม่ปิด กรุณาตรวจสอบไฟล์");
      } else if (parseError?.message === "CSV_EMPTY_HEADER") {
        setError("ไฟล์ CSV มีชื่อคอลัมน์ว่าง กรุณาตั้งชื่อทุกคอลัมน์ก่อนนำเข้า");
      } else if (parseError?.message === "CSV_DUPLICATE_HEADER") {
        setError("ไฟล์ CSV มีชื่อคอลัมน์ซ้ำ กรุณาเปลี่ยนชื่อคอลัมน์ให้ไม่ซ้ำกัน");
      } else if (parseError?.message?.startsWith("CSV_TOO_MANY_COLUMNS:")) {
        const rowNumber = parseError.message.split(":")[1];
        setError(`แถว ${rowNumber} มีจำนวนคอลัมน์มากกว่าหัวตาราง กรุณาตรวจสอบไฟล์`);
      } else {
        setError("ไม่สามารถอ่านไฟล์ CSV ได้");
      }
    }
  }

  function updateMapping(header, field) {
    setMapping((current) => ({
      ...current,
      [header]: field,
    }));
    setValidation(null);
    setImportResult(null);
  }

  async function handleValidate() {
    setError("");
    setValidation(null);
    setImportResult(null);

    if (!requiredMapped) {
      setError("กรุณา map Serial Number, ชื่อรุ่น, ยี่ห้อ, Part Number และตำแหน่งเริ่มต้นให้ครบ");
      return;
    }

    setLoading(true);

    try {
      const response = await validateBulkInventory(mappedRows);
      setValidation(response?.data ?? null);
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถตรวจสอบข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!validation || validation.summary.invalid > 0) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await importBulkInventory(mappedRows);
      setImportResult(response?.data ?? null);

      if ((response?.data?.summary?.failed || 0) === 0) {
        onDone?.(response);
      }
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถนำเข้าข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    downloadCsv("asset-import-template.csv", [
      {
        SerialNumber: "TEST-SN-001",
        ModelName: "Cisco Catalyst 9200L",
        Brand: "Cisco",
        PartNumber: "C9200L-24T-4G",
        Category: "Network Switch",
        Location: "Main Warehouse",
        ReceivedDate: "2026-09-21",
        ReceivedBy: "QA Tester",
        Distributor: "Example Vendor",
        WarrantyStart: "2026-09-21",
        WarrantyEnd: "2029-09-21",
        Note: "Initial import",
      },
    ]);
  }

  function downloadValidationReport() {
    if (!validation) {
      return;
    }

    downloadCsv(
      "asset-import-validation-report.csv",
      validation.rows.map((row) => ({
        Row: row.index + 2,
        SerialNumber: row.serialNumber || "",
        Valid: row.valid ? "YES" : "NO",
        Errors: row.errors.join(" | "),
        Warnings: row.warnings.join(" | "),
      })),
    );
  }

  function downloadImportReport() {
    if (!importResult) {
      return;
    }

    downloadCsv(
      "asset-import-result.csv",
      importResult.rows.map((row) => ({
        Row: row.index + 2,
        SerialNumber: row.serialNumber || "",
        Success: row.success ? "YES" : "NO",
        Code: row.code || "",
        Message: row.message || (row.success ? "Imported" : ""),
        ItemId: row.itemId || "",
      })),
    );
  }

  return (
    <section className="card intake-panel">
      <span className="section-kicker">CSV IMPORT</span>
      <h2 className="card-title">นำเข้าข้อมูลอุปกรณ์</h2>
      <p className="page-description">
        สำหรับข้อมูลเดิมหลายรุ่น หลายตำแหน่ง และหลายวันที่รับเข้า ระบบจะตรวจสอบก่อนเขียนข้อมูลจริง
      </p>

      {error && <div className="message message-error">{error}</div>}

      <div className="import-upload-row">
        <label className="button button-primary import-file-button">
          เลือกไฟล์ CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFile} hidden />
        </label>
        <button type="button" className="button button-secondary" onClick={downloadTemplate}>
          ดาวน์โหลดไฟล์ตัวอย่าง
        </button>
        <button type="button" className="button button-secondary" onClick={onCancel}>
          ยกเลิก
        </button>
      </div>

      {fileName && (
        <p className="field-hint">
          ไฟล์: {fileName} · {sourceRows.length} แถว
        </p>
      )}

      {headers.length > 0 && (
        <>
          <div className="import-section-heading">
            <span className="form-step">01</span>
            <div>
              <strong>จับคู่คอลัมน์</strong>
              <span>เลือกว่าคอลัมน์ในไฟล์ตรงกับข้อมูลใดในระบบ</span>
            </div>
          </div>

          <div className="mapping-grid">
            {headers.map((header) => (
              <label key={header}>
                <span>{header}</span>
                <select
                  value={mapping[header] || ""}
                  onChange={(event) => updateMapping(header, event.target.value)}
                >
                  {FIELD_OPTIONS.map(([value, label]) => (
                    <option
                      key={value || "none"}
                      value={value}
                      disabled={value && value !== mapping[header] && selectedFields.has(value)}
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="button button-primary" onClick={handleValidate} disabled={loading}>
              {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล"}
            </button>
          </div>
        </>
      )}

      {validation && (
        <>
          <div className="import-section-heading">
            <span className="form-step">02</span>
            <div>
              <strong>ผลการตรวจสอบ</strong>
              <span>ต้องไม่มี Error ก่อนเริ่มนำเข้าจริง</span>
            </div>
          </div>

          <div className="import-summary-grid">
            <div><span>ทั้งหมด</span><strong>{validation.summary.total}</strong></div>
            <div><span>พร้อมนำเข้า</span><strong>{validation.summary.valid}</strong></div>
            <div><span>ผิดพลาด</span><strong>{validation.summary.invalid}</strong></div>
            <div><span>คำเตือน</span><strong>{validation.summary.warnings}</strong></div>
          </div>

          <div className="import-preview table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>Serial Number</th>
                  <th>ผล</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {validation.rows.slice(0, 100).map((row) => (
                  <tr key={row.index}>
                    <td>{row.index + 2}</td>
                    <td className="serial-text">{row.serialNumber || "-"}</td>
                    <td>{row.valid ? "พร้อม" : "ผิดพลาด"}</td>
                    <td>
                      {row.errors.length > 0
                        ? row.errors.join(" · ")
                        : row.warnings.length > 0
                          ? row.warnings.join(" · ")
                          : "ผ่านการตรวจสอบ"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            {validation.summary.invalid > 0 ? (
              <button type="button" className="button button-secondary" onClick={downloadValidationReport}>
                ดาวน์โหลดรายงานข้อผิดพลาด
              </button>
            ) : (
              <button type="button" className="button button-primary" onClick={handleImport} disabled={loading}>
                {loading ? "กำลังนำเข้า..." : `นำเข้า ${validation.summary.valid} อุปกรณ์`}
              </button>
            )}
          </div>
        </>
      )}

      {importResult && (
        <div className={importResult.summary.failed > 0 ? "message message-warning" : "message message-success"}>
          <div>
            นำเข้าสำเร็จ {importResult.summary.succeeded} จาก {importResult.summary.total} รายการ
            {importResult.summary.failed > 0 && ` · ไม่สำเร็จ ${importResult.summary.failed} รายการ`}
          </div>

          <div className="form-actions import-result-actions">
            <button type="button" className="button button-secondary" onClick={downloadImportReport}>
              ดาวน์โหลดรายงานผลนำเข้า
            </button>
          </div>
        </div>
      )}

      {importResult?.rows?.some((row) => !row.success) && (
        <div className="import-error-list">
          <strong>รายการที่นำเข้าไม่สำเร็จ</strong>
          {importResult.rows
            .filter((row) => !row.success)
            .slice(0, 100)
            .map((row) => (
              <div key={`${row.index}-${row.serialNumber || "unknown"}`}>
                <span className="serial-text">{row.serialNumber || `แถว ${row.index + 2}`}</span>
                <span>{row.message || "นำเข้ารายการนี้ไม่สำเร็จ"}</span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

export default CsvImportPanel;
