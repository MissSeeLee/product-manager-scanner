import { useRef, useState } from "react";

const STATUS_LABELS = {
  IN_STOCK: "อยู่ในคลัง",
  IN_USE: "กำลังใช้งาน",
  CLAIM: "อยู่ระหว่างเคลม",
  REPLACED: "ถูกเปลี่ยนทดแทน",
  RETIRED: "ปลดระวาง",
};

const WARRANTY_LABELS = {
  active: "ยังอยู่ในประกัน",
  expiring: "หมดภายใน 30 วัน",
  expired: "หมดอายุแล้ว",
  none: "ไม่ระบุวันหมดประกัน",
};

function AdvancedFilterForm({ query, filterOptions, onApply }) {
  const detailsRef = useRef(null);
  const [draft, setDraft] = useState({
    serialPrefix: query.serialPrefix || "",
    brand: query.brand || "",
    partNumber: query.partNumber || "",
    receivedFrom: query.receivedFrom || "",
    receivedTo: query.receivedTo || "",
    warranty: query.warranty || "all",
  });

  function setField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onApply(draft);

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  function handleCancel() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  function handleClear() {
    const cleared = {
      serialPrefix: "",
      brand: "",
      partNumber: "",
      receivedFrom: "",
      receivedTo: "",
      warranty: "all",
    };

    setDraft(cleared);
    onApply(cleared);

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details className="advanced-filter" ref={detailsRef}>
      <summary className="button button-secondary">ตัวกรองเพิ่มเติม</summary>

      <form className="advanced-filter-panel" onSubmit={handleSubmit}>
        <div className="advanced-filter-heading">
          <div>
            <strong>ตัวกรองเพิ่มเติม</strong>
            <span>ตั้งหลายเงื่อนไขแล้วกดแสดงผลพร้อมกัน</span>
          </div>
        </div>

        <label>
          <span>Serial Number ขึ้นต้นด้วย</span>
          <input
            value={draft.serialPrefix}
            onChange={(event) => setField("serialPrefix", event.target.value)}
            autoComplete="off"
          />
        </label>

        <label>
          <span>ยี่ห้อ</span>
          <select
            value={draft.brand}
            onChange={(event) => setField("brand", event.target.value)}
          >
            <option value="">ทุกยี่ห้อ</option>
            {filterOptions.brands?.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Part Number</span>
          <input
            value={draft.partNumber}
            onChange={(event) => setField("partNumber", event.target.value)}
            autoComplete="off"
          />
        </label>

        <label>
          <span>รับเข้าตั้งแต่</span>
          <input
            type="date"
            value={draft.receivedFrom}
            onChange={(event) => setField("receivedFrom", event.target.value)}
          />
        </label>

        <label>
          <span>รับเข้าถึง</span>
          <input
            type="date"
            value={draft.receivedTo}
            onChange={(event) => setField("receivedTo", event.target.value)}
          />
        </label>

        <label>
          <span>การรับประกัน</span>
          <select
            value={draft.warranty}
            onChange={(event) => setField("warranty", event.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="active">ยังอยู่ในประกัน</option>
            <option value="expiring">หมดภายใน 30 วัน</option>
            <option value="expired">หมดอายุแล้ว</option>
            <option value="none">ไม่ระบุวันหมดประกัน</option>
          </select>
        </label>

        <div className="advanced-filter-actions">
          <button type="button" className="button button-secondary" onClick={handleClear}>
            ล้างตัวกรองเพิ่มเติม
          </button>
          <button type="button" className="button button-secondary" onClick={handleCancel}>
            ปิด
          </button>
          <button type="submit" className="button button-primary">
            แสดงผล
          </button>
        </div>
      </form>
    </details>
  );
}

function AssetExplorerToolbar({
  query,
  products = [],
  filterOptions = { locations: [], brands: [] },
  onChange,
  onClear,
}) {
  function handleSearch(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onChange({ search: String(formData.get("search") || "").trim() });
  }

  const advancedKey = [
    query.serialPrefix,
    query.brand,
    query.partNumber,
    query.receivedFrom,
    query.receivedTo,
    query.warranty,
  ].join("|");

  const activeFilters = [
    query.search && ["search", `ค้นหา: ${query.search}`],
    query.status && ["status", `สถานะ: ${STATUS_LABELS[query.status] || query.status}`],
    query.productId && [
      "productId",
      `รุ่น: ${products.find((product) => String(product.id) === String(query.productId))?.product_name || query.productId}`,
    ],
    query.location && ["location", `ตำแหน่ง: ${query.location}`],
    query.receivedFrom && ["receivedFrom", `รับเข้าตั้งแต่: ${query.receivedFrom}`],
    query.receivedTo && ["receivedTo", `รับเข้าถึง: ${query.receivedTo}`],
    query.serialPrefix && ["serialPrefix", `Serial ขึ้นต้น: ${query.serialPrefix}`],
    query.brand && ["brand", `ยี่ห้อ: ${query.brand}`],
    query.partNumber && ["partNumber", `Part Number: ${query.partNumber}`],
    query.warranty && query.warranty !== "all" && [
      "warranty",
      `ประกัน: ${WARRANTY_LABELS[query.warranty] || query.warranty}`,
    ],
  ].filter(Boolean);

  return (
    <section className="card explorer-toolbar">
      <form className="explorer-search" onSubmit={handleSearch} key={query.search || "empty"}>
        <label className="sr-only" htmlFor="assetSearch">ค้นหาอุปกรณ์</label>
        <input
          id="assetSearch"
          name="search"
          defaultValue={query.search || ""}
          placeholder="ค้นหา Serial, รุ่นสินค้า, ยี่ห้อ, Part Number หรือตำแหน่ง"
          autoComplete="off"
        />
        <button className="button button-primary" type="submit">
          ค้นหา
        </button>
      </form>

      <div className="quick-filter-grid">
        <label>
          <span>สถานะ</span>
          <select
            value={query.status || ""}
            onChange={(event) => onChange({ status: event.target.value })}
          >
            <option value="">ทุกสถานะ</option>
            <option value="IN_STOCK">อยู่ในคลัง</option>
            <option value="IN_USE">กำลังใช้งาน</option>
            <option value="CLAIM">อยู่ระหว่างเคลม</option>
            <option value="REPLACED">ถูกเปลี่ยนทดแทน</option>
            <option value="RETIRED">ปลดระวาง</option>
          </select>
        </label>

        <label>
          <span>รุ่นสินค้า</span>
          <select
            value={query.productId || ""}
            onChange={(event) => onChange({ productId: event.target.value })}
          >
            <option value="">ทุกรุ่น</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name} — {product.brand}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>ตำแหน่ง</span>
          <select
            value={query.location || ""}
            onChange={(event) => onChange({ location: event.target.value })}
          >
            <option value="">ทุกตำแหน่ง</option>
            {filterOptions.locations?.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </label>

        <AdvancedFilterForm
          key={advancedKey}
          query={query}
          filterOptions={filterOptions}
          onApply={onChange}
        />
      </div>

      {activeFilters.length > 0 && (
        <div className="filter-chip-row" aria-label="ตัวกรองที่ใช้งานอยู่">
          {activeFilters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="filter-chip"
              onClick={() => onChange({ [key]: "" })}
              aria-label={`ยกเลิก ${label}`}
            >
              {label} ×
            </button>
          ))}

          <button type="button" className="text-link clear-filter-button" onClick={onClear}>
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}

export default AssetExplorerToolbar;
