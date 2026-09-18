import { useState } from "react";

function InventoryForm({ products = [], onSubmit, onCancel, loading = false }) {
  const [productMode, setProductMode] = useState("existing");

  const [productId, setProductId] = useState("");

  // New Product
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // Inventory Item
  const [serialNumber, setSerialNumber] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
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
        category: category.trim(),
        description: description.trim(),
      },

      inventory,
    });
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>เพิ่มอุปกรณ์ใหม่</h2>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field-full">
          <label>Product</label>

          <div className="form-actions">
            <button
              type="button"
              className={
                productMode === "existing"
                  ? "button button-primary"
                  : "button button-secondary"
              }
              onClick={() => setProductMode("existing")}
              disabled={loading}
            >
              เลือกสินค้าที่มีอยู่
            </button>

            <button
              type="button"
              className={
                productMode === "new"
                  ? "button button-primary"
                  : "button button-secondary"
              }
              onClick={() => setProductMode("new")}
              disabled={loading}
            >
              + สร้างสินค้าใหม่
            </button>
          </div>
        </div>

        {productMode === "existing" ? (
          <div className="form-field form-field-full">
            <label htmlFor="productId">สินค้า</label>

            <select
              id="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
              disabled={loading}
            >
              <option value="">-- เลือกสินค้า --</option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_name}
                  {" — "}
                  {product.brand}
                  {" / "}
                  {product.part_number}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="productName">ชื่อสินค้า</label>

              <input
                id="productName"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="brand">Brand</label>

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
              <label htmlFor="category">Category</label>

              <input
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="เช่น Network Switch"
                disabled={loading}
              />
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="description">Description</label>

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

        <div className="form-field">
          <label htmlFor="serialNumber">Serial Number</label>

          <input
            id="serialNumber"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            required
            disabled={loading}
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

        <div className="form-field">
          <label htmlFor="performedBy">ผู้รับเข้า</label>

          <input
            id="performedBy"
            value={performedBy}
            onChange={(event) => setPerformedBy(event.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-field">
          <label htmlFor="distributor">Distributor</label>

          <input
            id="distributor"
            value={distributor}
            onChange={(event) => setDistributor(event.target.value)}
            disabled={loading}
          />
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

        <div className="form-field form-field-full">
          <label htmlFor="inventoryNote">หมายเหตุ</label>

          <textarea
            id="inventoryNote"
            rows="3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-actions form-field-full">
          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
          >
            {loading
              ? "กำลังบันทึก..."
              : productMode === "new"
                ? "สร้างสินค้าและเพิ่มอุปกรณ์"
                : "เพิ่มอุปกรณ์"}
          </button>

          {onCancel && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default InventoryForm;
