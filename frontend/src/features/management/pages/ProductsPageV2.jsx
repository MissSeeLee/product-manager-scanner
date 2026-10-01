import { useEffect, useMemo, useState } from "react";

import { useCan } from "../../auth/capabilities";
import { createProduct } from "../../products/api/productApi";
import {
  getManagedProducts,
  setManagedProductActive,
  updateManagedProduct,
} from "../api/managementApi";

const EMPTY = {
  productName: "",
  brand: "",
  partNumber: "",
  category: "",
  description: "",
  reason: "",
};

export default function ProductsPageV2() {
  const canManage = useCan("product.manage");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const showInactive = false;
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setRows(await getManagedProducts({ includeInactive: showInactive }));
  }

  useEffect(() => {
    let active = true;
    getManagedProducts({ includeInactive: showInactive })
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err.message || "โหลด Product Master ไม่สำเร็จ"));
    return () => {
      active = false;
    };
  }, [showInactive]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.product_name, row.brand, row.part_number, row.category].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [rows, search]);

  function startCreate() {
    setEditing("new");
    setForm(EMPTY);
  }

  function startEdit(row) {
    setEditing(row.id);
    setForm({
      productName: row.product_name || "",
      brand: row.brand || "",
      partNumber: row.part_number || "",
      category: row.category || "",
      description: row.description || "",
      reason: "",
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (editing === "new") {
        const result = await createProduct({
          productName: form.productName,
          brand: form.brand,
          partNumber: form.partNumber,
          category: form.category,
          description: form.description,
        });
        setMessage(result?.message || "สร้างรุ่นสินค้าเรียบร้อย");
      } else {
        const row = rows.find((item) => Number(item.id) === Number(editing));
        const result = await updateManagedProduct(editing, form);
        setMessage(
          `${result?.message || "แก้ไขรุ่นสินค้าเรียบร้อย"}${
            Number(row?.usage_count || 0) > 0
              ? ` · มีผลต่อ Asset ${row.usage_count} เครื่อง`
              : ""
          }`,
        );
      }

      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err.message || "บันทึก Product Master ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row) {
    const reason = "ลบรุ่นสินค้า";
    if (!reason?.trim()) return;

    setBusy(true);
    setError("");
    try {
      const result = await setManagedProductActive(
        row.id,
        !row.is_active,
        reason.trim(),
      );
      setMessage(result?.message || "เปลี่ยนสถานะรุ่นสินค้าเรียบร้อย");
      await load();
    } catch (err) {
      setError(err.message || "เปลี่ยนสถานะรุ่นสินค้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">รุ่นสินค้า</h1>
          <p className="page-description">
            Product Master อาจถูกใช้ร่วมกันหลาย Asset · รุ่นที่เลิกใช้ให้ ลบ แทน Delete
          </p>
        </div>
        {canManage && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            + สร้างรุ่นสินค้า
          </button>
        )}
      </div>

      {error && <div className="message message-error">{error}</div>}
      {message && <div className="message message-success">{message}</div>}

      <section className="card ux-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหา รุ่น / Brand / Part Number / Category"
        />

      </section>

      {editing && canManage && (
        <section className="card ux-editor-card">
          <h2 className="card-title">
            {editing === "new" ? "สร้างรุ่นสินค้า" : "แก้ไข Product Master"}
          </h2>

          {editing !== "new" && (
            <div className="message message-warning">
              การแก้ Product Master จะเปลี่ยนชื่อ/Brand/Part Number ที่แสดงของ Asset
              ทุกเครื่องที่อ้างรุ่นนี้
            </div>
          )}

          <form className="form-grid" onSubmit={save}>
            <label className="form-field">
              <span>ชื่อรุ่น *</span>
              <input value={form.productName} onChange={(e) => setForm((v) => ({ ...v, productName: e.target.value }))} required />
            </label>
            <label className="form-field">
              <span>ยี่ห้อ *</span>
              <input value={form.brand} onChange={(e) => setForm((v) => ({ ...v, brand: e.target.value }))} required />
            </label>
            <label className="form-field">
              <span>Part Number *</span>
              <input value={form.partNumber} onChange={(e) => setForm((v) => ({ ...v, partNumber: e.target.value }))} required />
            </label>
            <label className="form-field">
              <span>หมวดหมู่</span>
              <input value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} />
            </label>
            <label className="form-field form-field-full">
              <span>รายละเอียด</span>
              <textarea rows="2" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
            </label>
            {editing !== "new" && (
              <label className="form-field form-field-full">
                <span>เหตุผลการแก้ไข *</span>
                <textarea rows="2" value={form.reason} onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} required />
              </label>
            )}
            <div className="form-actions form-field-full">
              <button className="button button-primary" disabled={busy}>บันทึก</button>
              <button type="button" className="button button-secondary" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </form>
        </section>
      )}

      <section className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>รุ่น</th>
              <th>Brand / Part Number</th>
              <th>Category</th>
              <th>Assets</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.product_name}</strong></td>
                <td>{row.brand} / <span className="serial-text">{row.part_number}</span></td>
                <td>{row.category || "-"}</td>
                <td>{row.usage_count}</td>
                <td>{row.is_active ? "Active" : "ลบแล้ว"}</td>
                <td>
                  {canManage && (
                    <div className="ux-row-actions">
                      <button type="button" className="button button-secondary button-inline" onClick={() => startEdit(row)}>แก้ไข</button>
                      <button type="button" className="button button-secondary button-inline" onClick={() => toggleStatus(row)} disabled={busy}>
                        {row.is_active ? "ลบ" : "เลบ"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
