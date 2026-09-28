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

const BULK_SELECTABLE_STATUSES = new Set(["IN_STOCK", "IN_USE", "CLAIM"]);

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
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
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

  const selectableItems = items.filter((item) =>
    BULK_SELECTABLE_STATUSES.has(item.current_status),
  );
  const selectedSet = new Set(selectedIds.map(Number));
  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedSet.has(Number(item.id)));
  const someSelectableSelected = selectableItems.some((item) =>
    selectedSet.has(Number(item.id)),
  );

  return (
    <>
      <div className="asset-table-view table-wrapper">
        <table className="data-table asset-table">
          <thead>
            <tr>
              <th className="asset-select-cell">
                <input
                  type="checkbox"
                  aria-label="เลือกอุปกรณ์ที่ทำรายการได้ทั้งหมดในหน้านี้"
                  checked={allSelectableSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = !allSelectableSelected && someSelectableSelected;
                    }
                  }}
                  onChange={() => onToggleSelectAll?.(selectableItems)}
                  disabled={selectableItems.length === 0}
                />
              </th>
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

          <tbody
            data-click-select="true"
            onClick={(event) => {
              const target = event.target;

              if (!(target instanceof Element)) {
                return;
              }

              if (
                target.closest(
                  "a, button, input, select, textarea, label, [role='button']",
                )
              ) {
                return;
              }

              if (window.getSelection()?.toString()) {
                return;
              }

              const row = target.closest("tr");
              const checkbox = row?.querySelector('input[type="checkbox"]');

              if (checkbox && !checkbox.disabled) {
                checkbox.click();
              }
            }}
          >
            {items.map((item) => {
              const selectable = BULK_SELECTABLE_STATUSES.has(item.current_status);
              const selected = selectedSet.has(Number(item.id));

              return (
                <tr key={item.id} className={selected ? "asset-row-selected" : ""}>
                  <td className="asset-select-cell">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selectable}
                      onChange={() => onToggleSelect?.(item)}
                      aria-label={
                        selectable
                          ? `เลือก ${item.serial_number}`
                          : `${item.serial_number} อยู่ในสถานะที่ไม่รองรับ Bulk Action`
                      }
                    />
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="asset-card-list">
        {items.map((item) => {
          const selectable = BULK_SELECTABLE_STATUSES.has(item.current_status);
          const selected = selectedSet.has(Number(item.id));

          return (
            <article key={item.id} className={selected ? "asset-card asset-card-selected" : "asset-card"}>
              <div className="asset-card-selection">
                <label className="asset-mobile-checkbox">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selectable}
                    onChange={() => onToggleSelect?.(item)}
                  />
                  <span>{selectable ? "เลือกทำรายการ" : "สิ้นสุด Lifecycle"}</span>
                </label>
                <StatusBadge status={item.current_status} />
              </div>

              <Link to={`/inventory/${item.id}`} className="asset-card-main-link">
                <strong className="serial-text asset-card-serial">{item.serial_number}</strong>
                <div className="asset-card-title">{item.product_name || "ไม่ระบุรุ่น"}</div>
                <div className="asset-card-meta">
                  <span>{[item.brand, item.part_number].filter(Boolean).join(" · ") || "-"}</span>
                  <span>ตำแหน่ง: {item.current_location || "ไม่ระบุ"}</span>
                  {item.current_project_name && <span>งาน: {item.current_project_name}</span>}
                  <span>รับเข้า: {item.received_at ? formatDate(item.received_at) : "ไม่ระบุ"}</span>
                  <span>ประกัน: {warrantyText(item)}</span>
                </div>
                <span className="asset-card-open">ดูรายละเอียด →</span>
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default InventoryTable;
