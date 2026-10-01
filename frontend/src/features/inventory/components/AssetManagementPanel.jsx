import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LocationSelect from "../../../shared/components/LocationSelect";
import { useCan } from "../../auth/capabilities";
import { getLocations } from "../../locations/api/locationsApi";
import { getManagedProducts } from "../../management/api/managementApi";
import {
  getAssetIntake,
  updateAsset,
  voidAssetRegistration,
} from "../api/assetManagementApi";

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function defaultForm(item, intake) {
  return {
    serialNumber: item?.serial_number || "",
    warrantyStart: dateOnly(item?.warranty_start),
    warrantyEnd: dateOnly(item?.warranty_end),
    productId: String(intake?.product_id || item?.product_id || ""),
    currentLocation:
      intake?.received_location || item?.current_location || "",
    receivedAt: dateOnly(intake?.received_at || item?.received_at),
    receivedBy: intake?.received_by || "",
    distributor: intake?.distributor || "",
    note: intake?.receive_note || "",
  };
}

export default function AssetManagementPanel({ item, onChanged }) {
  const navigate = useNavigate();
  const canEdit = useCan("asset.edit");
  const canCorrect = useCan("asset.correctIntake");
  const canVoid = useCan("asset.void");

  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intake, setIntake] = useState(null);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(() => defaultForm(item, null));

  useEffect(() => {
    let cancelled = false;

    if (!canCorrect && !canVoid) {
      return () => {
        cancelled = true;
      };
    }

    getAssetIntake(item.id)
      .then((data) => {
        if (!cancelled) {
          setIntake(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIntake(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, canCorrect, canVoid]);

  const canDelete =
    canVoid &&
    item.current_status === "IN_STOCK" &&
    item.current_project_id == null &&
    item.current_issue_operation_id == null &&
    Boolean(intake?.receive_movement_id) &&
    Number(intake?.later_movement_count || 0) === 0;

  async function openEdit() {
    setBusy(true);
    setError("");

    try {
      let intakeData = intake;

      if (!intakeData) {
        intakeData = await getAssetIntake(item.id).catch(() => null);
        setIntake(intakeData);
      }

      let locationRows = [];
      let productRows = [];

      if (canCorrect && intakeData) {
        const [locationResult, productResult] = await Promise.allSettled([
          getLocations(),
          getManagedProducts({ includeInactive: false }),
        ]);

        locationRows =
          locationResult.status === "fulfilled" ? locationResult.value : [];
        productRows =
          productResult.status === "fulfilled" ? productResult.value : [];

        if (
          intakeData.product_id &&
          !productRows.some(
            (product) => Number(product.id) === Number(intakeData.product_id),
          )
        ) {
          productRows = [
            {
              id: intakeData.product_id,
              product_name: item.product_name || "รุ่นปัจจุบัน",
              brand: item.brand || "",
              part_number: item.part_number || "",
            },
            ...productRows,
          ];
        }
      }

      setLocations(locationRows);
      setProducts(productRows);
      setForm(defaultForm(item, intakeData));
      setMode("edit");
    } catch (err) {
      setError(err.message || "ไม่สามารถเปิดแบบฟอร์มแก้ไขได้");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = {
        serialNumber: form.serialNumber.trim(),
        warrantyStart: form.warrantyStart || null,
        warrantyEnd: form.warrantyEnd || null,
        reason: "แก้ไขข้อมูลอุปกรณ์",
      };

      if (canCorrect && intake) {
        Object.assign(payload, {
          productId: Number(form.productId),
          currentLocation: form.currentLocation,
          receivedAt: form.receivedAt,
          timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
          receivedBy: form.receivedBy.trim(),
          distributor: form.distributor.trim(),
          note: form.note.trim(),
        });
      }

      await updateAsset(item.id, payload);
      setMode("");
      await onChanged?.();
    } catch (err) {
      setError(err.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function performDelete() {
    setBusy(true);
    setError("");

    try {
      await voidAssetRegistration(item.id, "ลบอุปกรณ์");
      navigate("/inventory", {
        replace: true,
        state: {
          notice: `ลบ ${item.serial_number} แล้ว`,
        },
      });
    } catch (err) {
      setError(err.message || "ลบอุปกรณ์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  if (!canEdit && !canCorrect && !canVoid) {
    return null;
  }

  return (
    <>
      {(canEdit || canCorrect) && (
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={openEdit}
        >
          แก้ไข
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          className="button button-danger"
          disabled={busy}
          onClick={performDelete}
        >
          ลบอุปกรณ์
        </button>
      )}

      {error && (
        <div className="message message-error asset-management-inline-message">
          {error}
        </div>
      )}

      {mode === "edit" && (
        <div
          className="movement-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setMode("");
            }
          }}
        >
          <section
            className="movement-dialog asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-simple-edit-title"
          >
            <header className="movement-dialog-header">
              <div>
                <span className="movement-dialog-serial serial-text">
                  {item.serial_number}
                </span>
                <h2 id="asset-simple-edit-title">แก้ไขอุปกรณ์</h2>
              </div>

              <button
                type="button"
                className="movement-dialog-close"
                onClick={() => setMode("")}
                disabled={busy}
                aria-label="ปิด"
              >
                ×
              </button>
            </header>

            <div className="movement-dialog-body">
              <form className="form-grid asset-edit-form" onSubmit={saveEdit}>
                <label className="form-field form-field-full">
                  <span className="form-label">Serial Number</span>
                  <input
                    value={form.serialNumber}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        serialNumber: event.target.value,
                      }))
                    }
                    required
                    disabled={busy}
                  />
                </label>

                {canCorrect && intake && (
                  <>
                    <label className="form-field form-field-full">
                      <span className="form-label">รุ่นสินค้า</span>
                      <select
                        value={form.productId}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            productId: event.target.value,
                          }))
                        }
                        required
                        disabled={busy}
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.product_name} — {product.brand} /{" "}
                            {product.part_number}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <span className="form-label">วันที่รับเข้า</span>
                      <input
                        type="date"
                        value={form.receivedAt}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            receivedAt: event.target.value,
                          }))
                        }
                        required
                        disabled={busy}
                      />
                    </label>

                    <label className="form-field">
                      <span className="form-label">สถานที่รับเข้า</span>
                      <LocationSelect
                        value={form.currentLocation}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            currentLocation: event.target.value,
                          }))
                        }
                        locations={locations}
                        required
                        disabled={busy}
                      />
                    </label>
                  </>
                )}

                <label className="form-field">
                  <span className="form-label">เริ่มรับประกัน</span>
                  <input
                    type="date"
                    value={form.warrantyStart}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        warrantyStart: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">สิ้นสุดรับประกัน</span>
                  <input
                    type="date"
                    value={form.warrantyEnd}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        warrantyEnd: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                </label>

                {canCorrect && intake && (
                  <details className="form-field-full asset-edit-more">
                    <summary>รายละเอียดเพิ่มเติม</summary>

                    <div className="form-grid asset-edit-more-grid">
                      <label className="form-field">
                        <span className="form-label">ผู้รับเข้า</span>
                        <input
                          value={form.receivedBy}
                          onChange={(event) =>
                            setForm((value) => ({
                              ...value,
                              receivedBy: event.target.value,
                            }))
                          }
                          disabled={busy}
                        />
                      </label>

                      <label className="form-field">
                        <span className="form-label">ผู้จัดจำหน่าย</span>
                        <input
                          value={form.distributor}
                          onChange={(event) =>
                            setForm((value) => ({
                              ...value,
                              distributor: event.target.value,
                            }))
                          }
                          disabled={busy}
                        />
                      </label>

                      <label className="form-field form-field-full">
                        <span className="form-label">หมายเหตุ</span>
                        <textarea
                          rows="2"
                          value={form.note}
                          onChange={(event) =>
                            setForm((value) => ({
                              ...value,
                              note: event.target.value,
                            }))
                          }
                          disabled={busy}
                        />
                      </label>
                    </div>
                  </details>
                )}

                {error && (
                  <div className="form-field-full message message-error">
                    {error}
                  </div>
                )}

                <div className="form-field-full form-actions movement-dialog-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setMode("")}
                    disabled={busy}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={busy}
                  >
                    {busy ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
