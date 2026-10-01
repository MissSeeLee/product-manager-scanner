import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getInventoryItemBySerial } from "../../inventory/api/inventoryApi";

import BarcodeScanner from "../components/BarcodeScanner";
import StatusBadge from "../../inventory/components/StatusBadge";

function ScannerPage() {
  const navigate = useNavigate();

  const [serialNumber, setSerialNumber] = useState("");

  const [lastScan, setLastScan] = useState(null);

  const [foundItem, setFoundItem] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  async function searchSerial(
    serial,
    format = "",
    source = "manual",
    benchmark = null,
  ) {
    const cleanSerial = serial.trim();

    if (!cleanSerial) {
      setError("กรุณาระบุ Serial Number");

      return;
    }

    setLoading(true);
    setError("");
    setFoundItem(null);

    setSerialNumber(cleanSerial);

    if (source === "scanner") {
      setLastScan({
        value: cleanSerial,
        format: format || "Unknown",
        benchmark,
      });
    }

    try {
      const item = await getInventoryItemBySerial(cleanSerial);

      if (!item?.id) {
        setError("อ่าน Barcode สำเร็จ แต่ไม่พบ Serial Number นี้ในระบบ");

        return;
      }

      setFoundItem(item);
    } catch (err) {
      setError(
        err?.status === 404
          ? "อ่านข้อมูลสำเร็จ แต่ไม่พบอุปกรณ์นี้ในระบบ"
          : err.message || "ไม่สามารถค้นหาอุปกรณ์ได้",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleScan(result) {
    searchSerial(result.value, result.format, "scanner", result.benchmark);
  }

  function handleSubmit(event) {
    event.preventDefault();

    setLastScan(null);

    searchSerial(serialNumber, "", "manual");
  }

  function handleOpenItem() {
    if (!foundItem?.id) {
      return;
    }

    navigate(`/inventory/${foundItem.id}`);
  }

  function handleReset() {
    setFoundItem(null);
    setLastScan(null);
    setSerialNumber("");
    setError("");
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>สแกนอุปกรณ์</h1>
          <p className="text-muted">สแกนบาร์โค้ดหรือค้นหาด้วย Serial Number</p>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {!foundItem && (
        <>
          <section className="card scanner-quick-search">
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="form-field form-field-full">
                <label htmlFor="scannerSerial">Serial Number</label>
                <input
                  id="scannerSerial"
                  value={serialNumber}
                  onChange={(event) => {
                    setSerialNumber(event.target.value);
                    setFoundItem(null);
                    setError("");
                  }}
                  placeholder="Serial Number"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
              <div className="form-actions form-field-full">
                <button type="submit" className="button button-primary" disabled={loading}>
                  {loading ? "กำลังค้นหา..." : "ค้นหา"}
                </button>
              </div>
            </form>
          </section>

          <BarcodeScanner onScan={handleScan} disabled={loading} />

          {lastScan && !loading && (
            <div className="scanner-last-value text-muted">
              สแกนล่าสุด: <strong>{lastScan.value}</strong>
            </div>
          )}
        </>
      )}

      {foundItem && (
        <section className="card scanner-result-card">
          <div className="card-header">
            <div>
              <h2 className="serial-text">{foundItem.serial_number}</h2>
              <p className="text-muted">
                {foundItem.product_name || "ไม่ระบุรุ่น"}
                {foundItem.brand ? ` · ${foundItem.brand}` : ""}
              </p>
            </div>
            <StatusBadge status={foundItem.current_status} />
          </div>

          <div className="scanner-result-grid">
            <div>
              <span className="text-muted">สถานที่</span>
              <strong>{foundItem.current_location || "ไม่ระบุ"}</strong>
            </div>
            {foundItem.part_number && (
              <div>
                <span className="text-muted">Part Number</span>
                <strong>{foundItem.part_number}</strong>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="button button-primary" onClick={handleOpenItem}>
              เปิดอุปกรณ์
            </button>
            <button type="button" className="button button-secondary" onClick={handleReset}>
              สแกนใหม่
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default ScannerPage;
