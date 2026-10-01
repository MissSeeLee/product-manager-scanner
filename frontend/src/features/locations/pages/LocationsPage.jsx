import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createLocation,
  deleteLocation,
  getLocations,
  setLocationActive,
  updateLocation,
} from "../api/locationsApi";

function usageMessage(error) {
  return error?.message || "ไม่สามารถดำเนินการได้";
}

function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getLocations();
      setLocations(Array.isArray(result) ? result : []);
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถโหลดรายการสถานที่ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLocations() {
      try {
        const result = await getLocations();

        if (!cancelled) {
          setLocations(Array.isArray(result) ? result : []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message || "ไม่สามารถโหลดรายการสถานที่ได้",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const active = locations.filter((item) => item.is_active).length;

    return {
      total: locations.length,
      active,
      inactive: locations.length - active,
    };
  }, [locations]);

  async function handleCreate(event) {
    event.preventDefault();

    if (!locationName.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await createLocation({
        locationName: locationName.trim(),
        locationCode: locationCode.trim(),
      });

      setLocationName("");
      setLocationCode("");
      setSuccess("เพิ่มสถานที่เรียบร้อย");
      await loadLocations();
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถเพิ่มสถานที่ได้");
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(location) {
    setError("");
    setSuccess("");
    setEditingId(location.id);
    setEditName(location.location_name || "");
    setEditCode(location.location_code || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCode("");
  }

  async function handleSaveEdit(location) {
    if (!editName.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await updateLocation(location.id, {
        locationName: editName.trim(),
        locationCode: editCode.trim(),
      });

      cancelEdit();
      setSuccess("แก้ไขสถานที่เรียบร้อย");
      await loadLocations();
    } catch (requestError) {
      setError(usageMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(location) {
    const nextActive = !location.is_active;
    const action = nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน";

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await setLocationActive(location.id, nextActive);
      setSuccess(`${action}สถานที่เรียบร้อย`);
      await loadLocations();
    } catch (requestError) {
      setError(requestError.message || `ไม่สามารถ${action}สถานที่ได้`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(location) {

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await deleteLocation(location.id);
      setSuccess("ลบสถานที่ถาวรเรียบร้อย");
      await loadLocations();
    } catch (requestError) {
      setError(usageMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">ASSET OPERATIONS</div>
          <h1>สถานที่</h1>
          <p className="text-muted">
            เพิ่ม แก้ไข และปิดใช้งานสถานที่
          </p>
        </div>
      </div>

      {error ? (
        <div className="feedback-message feedback-message-error">{error}</div>
      ) : null}

      {success ? (
        <div className="feedback-message feedback-message-success">
          {success}
        </div>
      ) : null}

      <div className="location-admin-grid">
        <section className="card location-create-card">
          <div className="card-header">
            <div>
              <div className="eyebrow"></div>
              <h2>เพิ่มสถานที่</h2>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleCreate}>
            <div className="form-field form-field-full">
              <label htmlFor="locationName">ชื่อสถานที่ *</label>
              <input
                id="locationName"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="เช่น Main Warehouse"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="locationCode">รหัสสถานที่</label>
              <input
                id="locationCode"
                value={locationCode}
                onChange={(event) => setLocationCode(event.target.value)}
                placeholder="เช่น WH-MAIN"
                disabled={submitting}
              />
            </div>

            <div className="form-actions form-field-full">
              <button
                type="submit"
                className="button button-primary"
                disabled={submitting || !locationName.trim()}
              >
                เพิ่มสถานที่
              </button>
            </div>
          </form>
        </section>

        <section className="card location-list-card">
          <div className="location-list-header">
            <div>
              <div className="eyebrow"></div>
              <h2>สถานที่ทั้งหมด</h2>
            </div>

            <div className="location-summary">
              <span>{summary.total} ทั้งหมด</span>
              <span className="location-summary-active">
                {summary.active} ใช้งาน
              </span>
              {summary.inactive > 0 ? (
                <span className="location-summary-inactive">
                  {summary.inactive} ปิดใช้งาน
                </span>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="location-empty-state">กำลังโหลดสถานที่...</div>
          ) : locations.length === 0 ? (
            <div className="location-empty-state">ยังไม่มีสถานที่</div>
          ) : (
            <div className="location-master-list">
              {locations.map((location) => {
                const editing = editingId === location.id;

                return (
                  <div
                    key={location.id}
                    className={`location-master-row ${
                      location.is_active ? "" : "is-inactive"
                    }`}
                  >
                    {editing ? (
                      <div className="location-edit-grid">
                        <div className="form-field">
                          <label htmlFor={`edit-name-${location.id}`}>
                            ชื่อสถานที่
                          </label>
                          <input
                            id={`edit-name-${location.id}`}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            disabled={submitting}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor={`edit-code-${location.id}`}>
                            รหัสสถานที่
                          </label>
                          <input
                            id={`edit-code-${location.id}`}
                            value={editCode}
                            onChange={(event) => setEditCode(event.target.value)}
                            disabled={submitting}
                          />
                        </div>

                        <div className="location-row-actions location-edit-actions">
                          <button
                            type="button"
                            className="button button-primary button-small"
                            onClick={() => handleSaveEdit(location)}
                            disabled={submitting || !editName.trim()}
                          >
                            บันทึก
                          </button>

                          <button
                            type="button"
                            className="button button-secondary button-small"
                            onClick={cancelEdit}
                            disabled={submitting}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="location-row-main">
                          <div className="location-row-title">
                            {location.location_name}
                          </div>
                          <div className="location-row-code">
                            {location.location_code || "ไม่มีรหัส"}
                          </div>
                        </div>

                        <div className="location-row-status">
                          <span
                            className={`location-status-pill ${
                              location.is_active ? "is-active" : "is-inactive"
                            }`}
                          >
                            {location.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </div>

                        <div className="location-row-actions">
                          <button
                            type="button"
                            className="button button-secondary button-small"
                            onClick={() => beginEdit(location)}
                            disabled={submitting}
                          >
                            แก้ไข
                          </button>

                          <button hidden
                            type="button"
                            className="button button-secondary button-small"
                            onClick={() => handleToggle(location)}
                            disabled={submitting}
                          >
                            {location.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </button>

                          <button
                            type="button"
                            className="button button-danger button-small"
                            onClick={() => handleDelete(location)}
                            disabled={submitting}
                          >
                            ลบ
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default LocationsPage;