import { useState } from "react";

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function InventoryForm({ products = [], onSubmit, onCancel, loading = false }) {
  const [productMode, setProductMode] = useState("existing");
  const [productId, setProductId] = useState("");

  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const [serialNumber, setSerialNumber] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIsoDate());
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [distributor, setDistributor] = useState("");
  const [note, setNote] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const inventory = {
      serialNumber: serialNumber.trim(),
      currentLocation: currentLocation.trim(),
      receivedAt: receivedAt || null,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      warrantyStart: warrantyStart || null,
      warrantyEnd: warrantyEnd || null,
      performedBy: performedBy.trim(),
      distributor: distributor.trim(),
      note: note.trim(),
    };

    if (productMode === "existing") {
      await onSubmit?.({
        productMode: "existing",
        productId,
        inventory,
      });
      return;
    }

    await onSubmit?.({
      productMode: "new",
      product: {
        productName: productName.trim(),
        brand: brand.trim(),
        partNumber: partNumber.trim(),
        category: category.trim() || "ทั่วไป",
        description: description.trim(),
      },
      inventory,
    });
  }

  return (
    <section className="card intake-panel">
      <div className="card-header">
        <div>
          <span className="section-kicker">SINGLE ASSET</span>
          <h2 className="card-title">ลงทะเบียน 1 อุปกรณ์</h2>
          <p className="page-description">
            สร้างอุปกรณ์จริงหนึ่งชิ้นและบันทึก RECEIVE เป็นประวัติรายการแรก
          </p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-section form-field-full">
          <span className="form-step">01</span>
          <div>
            <strong>รุ่นสินค้า</strong>
            <span>เลือกข้อมูลแม่แบบก่อนระบุ Serial Number ของอุปกรณ์จริง</span>
          </div>
        </div>

        {productMode === "existing" ? (
          <>
            <div className="form-field form-field-full">
              <label htmlFor="productId">รุ่นสินค้า</label>
              <select
                id="productId"
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

            <div className="form-actions form-field-full form-actions-secondary">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setProductMode("new")}
                disabled={loading}
              >
                + ยังไม่มีรุ่นนี้? สร้างรุ่นสินค้าใหม่
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="form-field form-field-full">
              <button
                type="button"
                className="button button-secondary button-inline"
                onClick={() => setProductMode("existing")}
                disabled={loading}
              >
                ← กลับไปเลือกรุ่นที่มีอยู่
              </button>
            </div>

            <div className="form-field">
              <label htmlFor="productName">ชื่อรุ่น</label>
              <input
                id="productName"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="brand">ยี่ห้อ</label>
              <input
                id="brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="partNumber">Part Number</label>
              <input
                id="partNumber"
                value={partNumber}
                onChange={(event) => setPartNumber(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="category">หมวดหมู่</label>
              <input
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="เช่น Network Switch"
                disabled={loading}
              />
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="description">รายละเอียดรุ่น</label>
              <textarea
                id="description"
                rows="2"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={loading}
              />
            </div>
          </>
        )}

        <div className="form-section form-field-full">
          <span className="form-step">02</span>
          <div>
            <strong>ตัวตนอุปกรณ์</strong>
            <span>Serial Number ต้องไม่ซ้ำกับอุปกรณ์อื่นในระบบ</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="serialNumber">Serial Number</label>
          <input
            id="serialNumber"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            required
            disabled={loading}
            autoComplete="off"
          />
        </div>

        <div className="form-field">
          <label htmlFor="currentLocation">ตำแหน่งเริ่มต้น</label>
          <input
            id="currentLocation"
            value={currentLocation}
            onChange={(event) => setCurrentLocation(event.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-section form-field-full">
          <span className="form-step">03</span>
          <div>
            <strong>การรับเข้า</strong>
            <span>วันที่รับเข้าเป็นวันที่ของ RECEIVE จริง ไม่ใช่วันที่สร้าง record</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="receivedAt">วันที่รับเข้า</label>
          <input
            id="receivedAt"
            type="date"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="performedBy">ผู้รับเข้า</label>
          <input
            id="performedBy"
            value={performedBy}
            onChange={(event) => setPerformedBy(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="distributor">ผู้จัดจำหน่าย</label>
          <input
            id="distributor"
            value={distributor}
            onChange={(event) => setDistributor(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="inventoryNote">หมายเหตุการรับเข้า</label>
          <textarea
            id="inventoryNote"
            rows="3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-section form-field-full">
          <span className="form-step">04</span>
          <div>
            <strong>การรับประกัน</strong>
            <span>ไม่บังคับกรอก หากไม่มีข้อมูลสามารถเว้นว่างได้</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="warrantyStart">วันที่เริ่มประกัน</label>
          <input
            id="warrantyStart"
            type="date"
            value={warrantyStart}
            onChange={(event) => setWarrantyStart(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="warrantyEnd">วันที่สิ้นสุดประกัน</label>
          <input
            id="warrantyEnd"
            type="date"
            value={warrantyEnd}
            onChange={(event) => setWarrantyEnd(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-actions form-field-full">
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading
              ? "กำลังลงทะเบียน..."
              : productMode === "new"
                ? "สร้างรุ่นและลงทะเบียนอุปกรณ์"
                : "ลงทะเบียนอุปกรณ์"}
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

export default InventoryForm;
