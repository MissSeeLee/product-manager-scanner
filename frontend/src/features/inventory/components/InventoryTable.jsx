import { Link } from "react-router-dom";

import { formatDate } from "../../../shared/lib/formatters";
import StatusBadge from "./StatusBadge";

const SORTABLE_COLUMNS = {
  serial_number: "Serial Number",
  product_name: "รุ่นสินค้า",
  brand: "ยี่ห้อ",
  current_location: "ตำแหน่ง",
  received_at: "วันที่รับเข้า",
  warranty_end: "Warranty",
};

function SortButton({ field, query, onSort }) {
  const active = query.sort === field;
  const arrow = active ? (query.order === "asc" ? "↑" : "↓") : "↕";

  return (
    <button
      type="button"
      className={active ? "sort-header active" : "sort-header"}
      onClick={() => onSort(field)}
      aria-label={`เรียงตาม ${SORTABLE_COLUMNS[field]}`}
    >
      {SORTABLE_COLUMNS[field]} <span aria-hidden="true">{arrow}</span>
    </button>
  );
}

function warrantyText(item) {
  if (!item.warranty_start && !item.warranty_end) {
    return "ไม่ระบุ";
  }

  if (item.warranty_end) {
    return `ถึง ${formatDate(item.warranty_end)}`;
  }

  return `เริ่ม ${formatDate(item.warranty_start)}`;
}

function InventoryTable({
  items = [],
  query,
  onSort,
  hasFilters = false,
  onClearFilters,
}) {
  if (items.length === 0) {
    return (
      <section className="card empty-state-block">
        <strong>{hasFilters ? "ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง" : "ยังไม่มีอุปกรณ์ในระบบ"}</strong>
        <span>
          {hasFilters
            ? "ลองแก้คำค้นหาหรือล้างตัวกรองเพื่อดูรายการอื่น"
            : "เริ่มต้นด้วยการลงทะเบียนอุปกรณ์ หรือนำข้อมูลเดิมเข้าระบบ"}
        </span>
        {hasFilters && (
          <button type="button" className="button button-secondary" onClick={onClearFilters}>
            ล้างตัวกรอง
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="asset-table-view table-wrapper">
        <table className="data-table asset-table">
          <thead>
            <tr>
              <th aria-sort={query.sort === "serial_number" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="serial_number" query={query} onSort={onSort} />
              </th>
              <th aria-sort={query.sort === "product_name" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="product_name" query={query} onSort={onSort} />
              </th>
              <th aria-sort={query.sort === "brand" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="brand" query={query} onSort={onSort} />
                <span className="table-subhead"> / Part Number</span>
              </th>
              <th>สถานะ</th>
              <th aria-sort={query.sort === "current_location" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="current_location" query={query} onSort={onSort} />
              </th>
              <th aria-sort={query.sort === "received_at" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="received_at" query={query} onSort={onSort} />
              </th>
              <th aria-sort={query.sort === "warranty_end" ? (query.order === "asc" ? "ascending" : "descending") : "none"}>
                <SortButton field="warranty_end" query={query} onSort={onSort} />
              </th>
              <th aria-label="เปิดรายละเอียด" />
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link to={`/inventory/${item.id}`} className="serial-link">
                    {item.serial_number}
                  </Link>
                </td>
                <td><div className="table-primary">{item.product_name || "-"}</div></td>
                <td>
                  <div className="table-stack">
                    <span>{item.brand || "-"}</span>
                    <span className="part-number">{item.part_number || "-"}</span>
                  </div>
                </td>
                <td><StatusBadge status={item.current_status} /></td>
                <td>{item.current_location || "ไม่ระบุ"}</td>
                <td>{item.received_at ? formatDate(item.received_at) : "ไม่ระบุ"}</td>
                <td>{warrantyText(item)}</td>
                <td className="table-action-cell">
                  <Link to={`/inventory/${item.id}`} className="row-action" aria-label={`เปิดรายละเอียด ${item.serial_number}`}>
                    →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="asset-card-list">
        {items.map((item) => (
          <Link key={item.id} to={`/inventory/${item.id}`} className="asset-card">
            <div className="asset-card-top">
              <strong className="serial-text">{item.serial_number}</strong>
              <StatusBadge status={item.current_status} />
            </div>
            <div className="asset-card-title">{item.product_name || "ไม่ระบุรุ่น"}</div>
            <div className="asset-card-meta">
              <span>{[item.brand, item.part_number].filter(Boolean).join(" · ") || "-"}</span>
              <span>ตำแหน่ง: {item.current_location || "ไม่ระบุ"}</span>
              <span>รับเข้า: {item.received_at ? formatDate(item.received_at) : "ไม่ระบุ"}</span>
              <span>ประกัน: {warrantyText(item)}</span>
            </div>
            <span className="asset-card-open">ดูรายละเอียด →</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default InventoryTable;
