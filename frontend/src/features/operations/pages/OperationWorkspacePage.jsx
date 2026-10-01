import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  createOperation,
  validateOperation,
} from "../api/operationsApi";
import {
  OPERATION_CONFIG,
  OPERATION_TYPES,
  operationEligible,
} from "../operationConfig";
import { getInventoryItemBySerial, getInventoryItems } from "../../inventory/api/inventoryApi";
import StatusBadge from "../../inventory/components/StatusBadge";
import { getProjects } from "../../projects/api/projectsApi";
import { getLocations } from "../../locations/api/locationsApi";
import OperationBarcodeScanner from "../components/OperationBarcodeScanner";
import LocationSelect from "../../../shared/components/LocationSelect";
import { FeedbackMessage, LoadingState } from "../../../shared/components/PageState";

const DRAFT_KEY = "assetops.operation-draft.v4";

function newRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function typeFromParams(searchParams) {
  const raw = (searchParams.get("type") || "ISSUE").toUpperCase();
  return OPERATION_CONFIG[raw] ? raw : "ISSUE";
}

function OperationWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialState] = useState(() => location.state || {});
  const sourceOperationId = initialState.sourceOperationId || null;
  const didInitializeRef = useRef(false);

  const [type, setType] = useState(() => typeFromParams(searchParams));
  const config = OPERATION_CONFIG[type];

  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState(() => {
    try {
      const raw = sessionStorage.getItem(
        "assetops.pending-operation-selection.v6",
      );

      if (!raw) {
        return [];
      }

      const transfer = JSON.parse(raw);
      const age = Date.now() - Number(transfer?.createdAt || 0);

      if (
        transfer?.version !== 1 ||
        !Number.isFinite(age) ||
        age < 0 ||
        age > 30 * 60 * 1000
      ) {
        sessionStorage.removeItem(
          "assetops.pending-operation-selection.v6",
        );
        return [];
      }

      const currentType = typeFromParams(searchParams);

      if (
        transfer.type &&
        String(transfer.type).toUpperCase() !==
          String(currentType).toUpperCase()
      ) {
        return [];
      }

      const urlIds = (searchParams.get("assetIds") || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);

      const transferIds = Array.isArray(transfer.assetIds)
        ? transfer.assetIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

      const requestedIds =
        urlIds.length > 0 ? urlIds : transferIds;

      const requestedSet = new Set(requestedIds);

      return Array.isArray(transfer.selectedAssets)
        ? transfer.selectedAssets.filter(
            (item) =>
              item?.id &&
              (requestedSet.size === 0 ||
                requestedSet.has(Number(item.id))),
          )
        : [];
    } catch {
      sessionStorage.removeItem(
        "assetops.pending-operation-selection.v6",
      );
      return [];
    }
  });
  const [projectId, setProjectId] = useState(
    () => String(initialState.projectId || ""),
  );
  const [referenceCodeOverride, setReferenceCode] = useState();
  const [responsiblePersonOverride, setResponsiblePerson] = useState();
  const [destinationLocationOverride, setDestinationLocation] = useState();
  const [expectedReturnDateOverride, setExpectedReturnDate] = useState();
  const [performedBy, setPerformedBy] = useState(
    () => localStorage.getItem("assetops.last-performed-by") || "",
  );
  const [note, setNote] = useState("");

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => String(project.id) === String(projectId),
      ),
    [projectId, projects],
  );

  const projectDefaultsEnabled =
    type === "ISSUE" && Boolean(selectedProject);

  const referenceCode =
    referenceCodeOverride ??
    (projectDefaultsEnabled
      ? selectedProject.project_code || ""
      : "");

  const responsiblePerson =
    responsiblePersonOverride ??
    (projectDefaultsEnabled
      ? selectedProject.responsible_person || ""
      : "");

  const destinationLocation =
    destinationLocationOverride ??
    (projectDefaultsEnabled
      ? selectedProject.default_location || ""
      : "");

  const expectedReturnDate =
    expectedReturnDateOverride ??
    (projectDefaultsEnabled
      ? selectedProject.expected_end_date || ""
      : "");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [clientRequestId, setClientRequestId] = useState(newRequestId);

  const selectedIds = useMemo(
    () => selectedAssets.map((item) => Number(item.id)),
    [selectedAssets],
  );
  const ineligible = useMemo(
    () => selectedAssets.filter((item) => !operationEligible(type, item.current_status)),
    [selectedAssets, type],
  );
  const eligibleCount = selectedAssets.length - ineligible.length;

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      setReferenceLoading(true);

      try {
        const [projectData, locationData] = await Promise.all([
          getProjects({ status: "ACTIVE" }),
          getLocations(),
        ]);

        if (!cancelled) {
          setProjects(projectData);
          setLocations(locationData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดข้อมูลอ้างอิงได้");
        }
      } finally {
        if (!cancelled) {
          setReferenceLoading(false);
        }
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (didInitializeRef.current) {
      return;
    }

    didInitializeRef.current = true;

    const stateIds = Array.isArray(initialState.assetIds)
      ? initialState.assetIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const queryIds = (searchParams.get("assetIds") || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    let pendingIds = [];

    try {
      const raw = sessionStorage.getItem(
        "assetops.pending-operation-selection.v6",
      );

      if (raw) {
        const transfer = JSON.parse(raw);
        const age = Date.now() - Number(transfer?.createdAt || 0);
        const currentType = typeFromParams(searchParams);
        const sameType =
          !transfer?.type ||
          String(transfer.type).toUpperCase() ===
            String(currentType).toUpperCase();

        if (
          transfer?.version === 1 &&
          Number.isFinite(age) &&
          age >= 0 &&
          age <= 30 * 60 * 1000 &&
          sameType &&
          Array.isArray(transfer.assetIds)
        ) {
          pendingIds = transfer.assetIds
            .map((value) => Number(value))
            .filter(
              (value) =>
                Number.isInteger(value) && value > 0,
            );
        }
      }
    } catch {
      pendingIds = [];
    }

    const hasExplicitSelection =
      stateIds.length > 0 ||
      queryIds.length > 0 ||
      pendingIds.length > 0;

    let draft = null;

    if (!hasExplicitSelection && !initialState.projectId) {
      try {
        draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      } catch {
        draft = null;
      }
    }

    const ids =
      stateIds.length > 0
        ? stateIds
        : queryIds.length > 0
          ? queryIds
          : pendingIds.length > 0
            ? pendingIds
            : draft?.assetIds || [];

    if (draft && !hasExplicitSelection) {
      if (OPERATION_CONFIG[draft.type]) {
        setType(draft.type);
        const next = new URLSearchParams(searchParams);
        next.set("type", draft.type);
        setSearchParams(next, { replace: true });
      }
      setProjectId(String(draft.projectId || ""));
      setReferenceCode(draft.referenceCode || "");
      setResponsiblePerson(draft.responsiblePerson || "");
      setDestinationLocation(draft.destinationLocation || "");
      setExpectedReturnDate(draft.expectedReturnDate || "");
      setPerformedBy(
        draft.performedBy || localStorage.getItem("assetops.last-performed-by") || "",
      );
      setNote(draft.note || "");
    }

    if (ids.length === 0) {
      return;
    }

    let cancelled = false;

    const initialValidationType =
      draft && OPERATION_CONFIG[draft.type]
        ? draft.type
        : typeFromParams(searchParams);

    validateOperation(initialValidationType, ids)
      .then((result) => {
        if (!cancelled) {
          const validatedAssets = Array.isArray(result?.rows)
            ? result.rows.filter((row) => row?.id)
            : [];

          if (validatedAssets.length > 0) {
            setSelectedAssets(validatedAssets);
            sessionStorage.removeItem(
              "assetops.pending-operation-selection.v6",
            );
          }
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดอุปกรณ์ที่เลือกไว้ได้");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialState, searchParams, setSearchParams]);


  useEffect(() => {
    const draft = {
      type,
      assetIds: selectedIds,
      projectId,
      referenceCode,
      responsiblePerson,
      destinationLocation,
      expectedReturnDate,
      performedBy,
      note,
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    type,
    selectedIds,
    projectId,
    referenceCode,
    responsiblePerson,
    destinationLocation,
    expectedReturnDate,
    performedBy,
    note,
  ]);

  function changeType(nextType) {
    if (!OPERATION_CONFIG[nextType]) {
      return;
    }

    setType(nextType);
    setConflicts([]);
    setError("");
    setSuccessMessage("");

    const next = new URLSearchParams(searchParams);
    next.set("type", nextType);
    setSearchParams(next, { replace: true });
  }

  function addAsset(item) {
    if (!item?.id) {
      return;
    }

    setSelectedAssets((current) => {
      if (current.some((existing) => Number(existing.id) === Number(item.id))) {
        setSuccessMessage(`${item.serial_number} อยู่ในรายการแล้ว`);
        return current;
      }

      return [...current, item];
    });
    setError("");
    setConflicts([]);
  }

  function removeAsset(id) {
    setSelectedAssets((current) => current.filter((item) => Number(item.id) !== Number(id)));
    setConflicts((current) => current.filter((item) => Number(item.id) !== Number(id)));
  }

  async function addBySerial(serial) {
    const clean = typeof serial === "string" ? serial.trim() : "";

    if (!clean) {
      return;
    }

    try {
      const item = await getInventoryItemBySerial(clean);
      addAsset(item);
      setSuccessMessage(`${item.serial_number} เพิ่มเข้ารายการแล้ว`);
    } catch (requestError) {
      setError(requestError.message || `ไม่พบ ${clean}`);
    }
  }

  async function handleSearch(event) {
    event?.preventDefault();
    const clean = query.trim();

    if (!clean) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setSuccessMessage("");

    try {
      try {
        const exact = await getInventoryItemBySerial(clean);
        addAsset(exact);
        setQuery("");
        setSearchResults([]);
        setSuccessMessage(`${exact.serial_number} เพิ่มเข้ารายการแล้ว`);
        return;
      } catch (requestError) {
        if (requestError.status !== 404) {
          throw requestError;
        }
      }

      const result = await getInventoryItems({
        search: clean,
        limit: 8,
        offset: 0,
        sort: "serial_number",
        order: "asc",
      });

      setSearchResults(Array.isArray(result?.data) ? result.data : []);
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถค้นหาอุปกรณ์ได้");
    } finally {
      setSearching(false);
    }
  }

  async function handleScan(result) {
    const value = typeof result === "string" ? result : result?.value;

    if (!value) {
      return;
    }

    await addBySerial(value);
  }

  function removeIneligible() {
    setSelectedAssets((current) =>
      current.filter((item) => operationEligible(type, item.current_status)),
    );
    setConflicts([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setConflicts([]);

    if (selectedAssets.length === 0) {
      setError("กรุณาเพิ่มอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }

    if (ineligible.length > 0) {
      setError("มีอุปกรณ์ที่สถานะไม่พร้อมสำหรับการดำเนินการนี้");
      return;
    }

    if (!destinationLocation) {
      setError(`กรุณาเลือก${config.destinationLabel}`);
      return;
    }

    if (type === "ISSUE" && !responsiblePerson.trim()) {
      setError("กรุณาระบุผู้รับผิดชอบอุปกรณ์");
      return;
    }

    if (!performedBy.trim()) {
      setError("กรุณาระบุผู้ดำเนินการ");
      return;
    }

    setSubmitting(true);

    try {
      const preflight = await validateOperation(type, selectedIds);
      const changed = preflight.rows.filter((row) => !row.eligible);

      if (changed.length > 0) {
        setConflicts(changed);
        setError("สถานะอุปกรณ์มีการเปลี่ยนแปลง กรุณาตรวจสอบก่อนยืนยันอีกครั้ง");
        return;
      }

      const response = await createOperation({
        type,
        assetIds: selectedIds,
        projectId: type === "ISSUE" && projectId ? Number(projectId) : null,
        referenceCode: referenceCode.trim(),
        responsiblePerson: type === "ISSUE" ? responsiblePerson.trim() : null,
        destinationLocation,
        expectedReturnDate: type === "ISSUE" ? expectedReturnDate || null : null,
        performedBy: performedBy.trim(),
        note: note.trim(),
        clientRequestId,
        sourceOperationId: type === "RETURN" ? sourceOperationId : null,
      });

      localStorage.setItem("assetops.last-performed-by", performedBy.trim());
      localStorage.removeItem(DRAFT_KEY);
      setClientRequestId(newRequestId());

      const operationId = response?.data?.operation?.id;

      if (operationId) {
        navigate(`/operations/${operationId}`, {
          replace: true,
          state: { successMessage: response.message },
        });
      } else {
        setSuccessMessage(response?.message || "ดำเนินการเรียบร้อย");
      }
    } catch (requestError) {
      const conflictRows = requestError?.data?.data?.rows;

      if (Array.isArray(conflictRows)) {
        setConflicts(conflictRows.filter((row) => !row.eligible));
      }

      setError(requestError.message || "ไม่สามารถบันทึกรายการได้");
    } finally {
      setSubmitting(false);
    }
  }

  if (referenceLoading) {
    return <LoadingState message="กำลังเตรียมพื้นที่ทำรายการ..." />;
  }

  return (
    <div className="operation-workspace">
      <div className="page-header operation-page-header">
        <div>
          <Link to="/operations" className="text-link">← เบิก / คืน</Link>
          <h1 className="page-title">{config.label}</h1>
          <p className="page-description">{config.description}</p>
        </div>
      </div>

      <div className="operation-type-tabs" role="tablist" aria-label="ประเภทการดำเนินการ">
        {Object.values(OPERATION_TYPES).map((operationType) => (
          <button
            key={operationType}
            type="button"
            role="tab"
            aria-selected={type === operationType}
            className={type === operationType ? "operation-type-tab active" : "operation-type-tab"}
            onClick={() => changeType(operationType)}
          >
            {OPERATION_CONFIG[operationType].label}
          </button>
        ))}
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>
      <FeedbackMessage type="success">{successMessage}</FeedbackMessage>

      {conflicts.length > 0 && (
        <section className="message message-warning operation-conflict-panel">
          <strong>มี {conflicts.length} รายการที่ไม่พร้อม</strong>
          <div>
            {conflicts.slice(0, 8).map((item) => (
              <span key={item.id ?? item.serial_number}>
                {item.serial_number || `ID ${item.id}`} — {item.reason}
              </span>
            ))}
          </div>
          <button type="button" className="button button-secondary" onClick={removeIneligible}>
            เอารายการที่ใช้ไม่ได้ออก
          </button>
        </section>
      )}

      <div className="operation-layout">
        <main className="operation-main-column">
          <section className="card operation-context-card">
            <div className="operation-section-heading">
              <span className="operation-step">1</span>
              <div>
                <h2 className="card-title">รายละเอียด</h2>

              </div>
            </div>

            <div className="form-grid operation-context-grid">
              {type === "ISSUE" && (
                <>
                  <div className="form-field">
                    <label htmlFor="operationProject">งาน / โครงการ</label>
                    <select
                      id="operationProject"
                      value={projectId}
                      onChange={(event) => {
                        setProjectId(event.target.value);
                        setResponsiblePerson(undefined);
                        setDestinationLocation(undefined);
                        setExpectedReturnDate(undefined);
                        setReferenceCode(undefined);
                      }}
                      disabled={submitting}
                    >
                      <option value="">ไม่ผูกกับโครงการ</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_code
                            ? `${project.project_code} · ${project.project_name}`
                            : project.project_name}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">
                      ไม่มีงานนี้? <Link to="/projects" className="text-link">สร้างโครงการ</Link>
                    </span>
                  </div>

                  <div className="form-field">
                    <label htmlFor="operationReference">เลขอ้างอิง</label>
                    <input
                      id="operationReference"
                      value={referenceCode}
                      onChange={(event) => setReferenceCode(event.target.value)}
                      placeholder="เช่น WO-2026-014"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="operationResponsible">ผู้รับผิดชอบ *</label>
                    <input
                      id="operationResponsible"
                      value={responsiblePerson}
                      onChange={(event) => setResponsiblePerson(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="operationExpectedReturn">กำหนดคืน</label>
                    <input
                      id="operationExpectedReturn"
                      type="date"
                      value={expectedReturnDate}
                      onChange={(event) => setExpectedReturnDate(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </>
              )}

              <div className="form-field">
                <label htmlFor="operationLocation">{config.destinationLabel} *</label>
                <LocationSelect
                  id="operationLocation"
                  value={destinationLocation}
                  onChange={(event) => setDestinationLocation(event.target.value)}
                  locations={locations}
                  required
                  disabled={submitting}
                />

              </div>

              <div className="form-field">
                <label htmlFor="operationPerformedBy">ผู้ดำเนินการ *</label>
                <input
                  id="operationPerformedBy"
                  value={performedBy}
                  onChange={(event) => setPerformedBy(event.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="name"
                />

              </div>

              <div className="form-field form-field-full">
                <label htmlFor="operationNote">หมายเหตุ</label>
                <textarea
                  id="operationNote"
                  rows="3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={submitting}
                  placeholder="ข้อมูลเพิ่มเติมของการทำรายการครั้งนี้"
                />
              </div>
            </div>
          </section>

          <section className="card operation-assets-card">
            <div className="operation-section-heading">
              <span className="operation-step">2</span>
              <div>
                <h2 className="card-title">เพิ่มอุปกรณ์</h2>

              </div>
            </div>

            <form className="operation-search" onSubmit={handleSearch}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Serial Number / รุ่น / ยี่ห้อ / Part Number / สถานที่"
                autoComplete="off"
                disabled={submitting}
              />
              <button type="submit" className="button button-secondary" disabled={searching || submitting}>
                {searching ? "กำลังค้นหา..." : "ค้นหา / เพิ่ม"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setScannerOpen((current) => !current)}
                disabled={submitting}
              >
                {scannerOpen ? "ปิด Scanner" : "สแกนด้วยกล้อง"}
              </button>
            </form>

            {scannerOpen && (
              <OperationBarcodeScanner onScan={handleScan} disabled={submitting} />
            )}

            {searchResults.length > 0 && (
              <div className="operation-search-results">
                {searchResults.map((item) => (
                  <div key={item.id} className="operation-search-row">
                    <div>
                      <strong className="serial-text">{item.serial_number}</strong>
                      <span>{item.product_name} · {item.brand}</span>
                    </div>
                    <StatusBadge status={item.current_status} />
                    <button type="button" className="button button-secondary" onClick={() => addAsset(item)}>
                      เพิ่ม
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="operation-selected-heading">
              <div>
                <strong>อุปกรณ์ในรายการ</strong>
                <span>{selectedAssets.length} รายการ · พร้อม {eligibleCount}</span>
              </div>
              {ineligible.length > 0 && (
                <button type="button" className="text-link operation-remove-invalid" onClick={removeIneligible}>
                  เอา {ineligible.length} รายการที่ใช้ไม่ได้ออก
                </button>
              )}
            </div>

            {selectedAssets.length === 0 ? (
              <div className="operation-empty-selection">
                ยังไม่มีอุปกรณ์ในรายการ เริ่มจากค้นหา สแกน หรือเลือกหลายรายการจากหน้าอุปกรณ์
              </div>
            ) : (
              <div className="operation-selected-list">
                {selectedAssets.map((item, index) => {
                  const eligible = operationEligible(type, item.current_status);

                  return (
                    <div key={item.id} className={eligible ? "operation-selected-row" : "operation-selected-row invalid"}>
                      <span className="operation-row-number">{index + 1}</span>
                      <div className="operation-selected-identity">
                        <strong className="serial-text">{item.serial_number}</strong>
                        <span>{item.product_name || "ไม่ระบุรุ่น"} · {item.brand || "-"}</span>
                        <small>{item.current_location || "ไม่ระบุตำแหน่ง"}</small>
                      </div>
                      <StatusBadge status={item.current_status} />
                      <span className={eligible ? "operation-ready" : "operation-not-ready"}>
                        {eligible ? "พร้อม" : "ใช้ไม่ได้"}
                      </span>
                      <button
                        type="button"
                        className="operation-remove-item"
                        onClick={() => removeAsset(item.id)}
                        aria-label={`เอา ${item.serial_number} ออกจากรายการ`}
                        disabled={submitting}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="card operation-confirm-card">
          <span className="section-kicker">SUMMARY</span>
          <h2 className="card-title">ตรวจสอบก่อนยืนยัน</h2>

          <dl className="operation-confirm-list">
            <div>
              <dt>รายการ</dt>
              <dd>{config.label}</dd>
            </div>
            <div>
              <dt>อุปกรณ์</dt>
              <dd>{selectedAssets.length} รายการ</dd>
            </div>
            {type === "ISSUE" && (
              <>
                <div>
                  <dt>ผู้รับผิดชอบ</dt>
                  <dd>{responsiblePerson || "ยังไม่ระบุ"}</dd>
                </div>
                <div>
                  <dt>กำหนดคืน</dt>
                  <dd>{expectedReturnDate || "ไม่กำหนด"}</dd>
                </div>
              </>
            )}
            <div>
              <dt>{config.destinationLabel}</dt>
              <dd>{destinationLocation || "ยังไม่เลือก"}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="button button-primary operation-confirm-button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              selectedAssets.length === 0 ||
              ineligible.length > 0 ||
              !destinationLocation ||
              !performedBy.trim() ||
              (type === "ISSUE" && !responsiblePerson.trim())
            }
          >
            {submitting
              ? "กำลังบันทึก..."
              : `${config.submitLabel} ${selectedAssets.length} รายการ`}
          </button>

          <Link to="/inventory" className="button button-secondary operation-back-button">
            กลับไปเลือกจาก Asset Explorer
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default OperationWorkspacePage;
