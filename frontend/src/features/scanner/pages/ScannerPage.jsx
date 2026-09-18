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
          <h1>Scanner</h1>

          <p className="text-muted">
            ค้นหาอุปกรณ์ด้วย Barcode, QR Code หรือ Serial Number
          </p>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {!foundItem && <BarcodeScanner onScan={handleScan} disabled={loading} />}

      {lastScan && !foundItem && (
        <section className="card">
          <h2>ผลการสแกนล่าสุด</h2>

          <div className="scanner-result-grid">
            <div>
              <span className="text-muted">ค่าที่อ่านได้</span>

              <strong>{lastScan.value}</strong>
            </div>

            <div>
              <span className="text-muted">Barcode Format</span>

              <strong>{lastScan.format}</strong>
            </div>

            <div>
              <span className="text-muted">สถานะ</span>

              <strong>ไม่พบ Serial นี้ในฐานข้อมูล</strong>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={handleReset}
            >
              สแกนใหม่
            </button>
          </div>
        </section>
      )}

      {foundItem && (
        <section className="card scanner-result-card">
          <div className="card-header">
            <div>
              <h2>พบอุปกรณ์</h2>

              <p className="text-muted">ตรวจสอบข้อมูลก่อนเปิดรายการ</p>
            </div>

            <StatusBadge status={foundItem.current_status} />
          </div>

          <div className="scanner-result-grid">
            <div>
              <span className="text-muted">Serial Number</span>

              <strong>{foundItem.serial_number}</strong>
            </div>

            <div>
              <span className="text-muted">Product</span>

              <strong>{foundItem.product_name || "-"}</strong>
            </div>

            <div>
              <span className="text-muted">Brand</span>

              <strong>{foundItem.brand || "-"}</strong>
            </div>

            <div>
              <span className="text-muted">Part Number</span>

              <strong>{foundItem.part_number || "-"}</strong>
            </div>

            <div>
              <span className="text-muted">Location</span>

              <strong>{foundItem.current_location || "-"}</strong>
            </div>

            {lastScan?.format && (
              <div>
                <span className="text-muted">Barcode Format</span>

                <strong>{lastScan.format}</strong>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={handleOpenItem}
            >
              เปิดรายละเอียดอุปกรณ์
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={handleReset}
            >
              สแกนใหม่
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>ค้นหาด้วย Serial Number</h2>

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
              placeholder="เช่น SN001-UPDATED"
              disabled={loading}
            />
          </div>

          <div className="form-actions form-field-full">
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
            >
              {loading ? "กำลังค้นหา..." : "ค้นหาอุปกรณ์"}
            </button>
          </div>

          {lastScan?.benchmark && (
            <>
              <div>
                <span className="text-muted">เวลาในการสแกน</span>

                <strong>
                  {lastScan.benchmark.elapsedMs
                    ? `${(lastScan.benchmark.elapsedMs / 1000).toFixed(
                        2,
                      )} วินาที`
                    : "-"}
                </strong>
              </div>

              <div>
                <span className="text-muted">Decode Attempts</span>

                <strong>{lastScan.benchmark.decodeAttempts ?? "-"}</strong>
              </div>

              <div>
                <span className="text-muted">Camera Resolution</span>

                <strong>
                  {lastScan.benchmark.camera?.width &&
                  lastScan.benchmark.camera?.height
                    ? `${lastScan.benchmark.camera.width} × ${lastScan.benchmark.camera.height}`
                    : "-"}
                </strong>
              </div>

              <div>
                <span className="text-muted">Camera FPS</span>

                <strong>
                  {lastScan.benchmark.camera?.frameRate
                    ? Math.round(lastScan.benchmark.camera.frameRate)
                    : "-"}
                </strong>
              </div>
            </>
          )}
        </form>
      </section>
    </>
  );
}

export default ScannerPage;
