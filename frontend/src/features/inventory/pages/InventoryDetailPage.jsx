import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getInventoryItemById } from "../api/inventoryApi";
import {
  claimInventory,
  claimReturnInventory,
  getMovementHistory,
  issueInventory,
  moveInventory,
  replaceInventory,
  retireInventory,
  returnInventory,
} from "../api/movementApi";
import {
  ACTIONS_BY_STATUS,
  ACTION_BUTTON_CLASSES,
  ACTION_LABELS,
} from "../config/inventoryConfig";

import MovementActionDialog from "../components/MovementActionDialog";
import MovementTimeline from "../components/MovementTimeline";
import StatusBadge from "../components/StatusBadge";
import { getLocations } from "../../locations/api/locationsApi";
import { getProjects } from "../../projects/api/projectsApi";
import { useCan } from "../../auth/capabilities";
import AssetManagementPanel from "../components/AssetManagementPanel";

import { formatDate, formatDateTime } from "../../../shared/lib/formatters";

import "../styles/inventoryDetail.css";

const MOVEMENT_HANDLERS = {
  ISSUE: issueInventory,
  RETURN: returnInventory,
  MOVE: moveInventory,
  CLAIM: claimInventory,
  CLAIM_RETURN: claimReturnInventory,
  REPLACED: replaceInventory,
  RETIRE: retireInventory,
};

const ACTION_GROUPS = {
  IN_STOCK: {
    primary: "ISSUE",
    secondary: ["MOVE"],
    more: [],
  },
  IN_USE: {
    primary: "RETURN",
    secondary: ["MOVE", "CLAIM"],
    more: [],
  },
  CLAIM: {
    primary: "CLAIM_RETURN",
    secondary: ["REPLACED", "RETIRE"],
    more: [],
  },
};

async function fetchDetail(id) {
  const [item, movements] = await Promise.all([
    getInventoryItemById(id),
    getMovementHistory(id),
  ]);

  return { item, movements };
}

function formatWarrantyPeriod(start, end) {
  if (!start && !end) {
    return "ไม่ระบุ";
  }

  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  if (start) {
    return `เริ่ม ${formatDate(start)}`;
  }

  return `สิ้นสุด ${formatDate(end)}`;
}

function InventoryDetailPage() {
  const { id } = useParams();
  const canOperate = useCan("operations.execute");

  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        const [detailData, locationData, projectData] = await Promise.all([
          fetchDetail(id),
          getLocations().catch(() => []),
          getProjects({ status: "ACTIVE" }).catch(() => []),
        ]);

        if (!cancelled) {
          setItem(detailData.item);
          setMovements(detailData.movements);
          setLocations(locationData);
          setProjects(projectData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleSelectAction(action) {
    setError("");
    setSuccessMessage("");
    setSelectedAction(action);
  }

  async function handleMovementSubmit(data) {
    const handler = MOVEMENT_HANDLERS[selectedAction];

    if (!handler) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload =
        selectedAction === "RETURN"
          ? {
              ...data,
              sourceOperationId: item?.current_issue_operation_id ?? null,
            }
          : data;
      const result = await handler(id, payload);
      const refreshed = await fetchDetail(id);

      setItem(refreshed.item);
      setMovements(refreshed.movements);
      setSelectedAction(null);
      setSuccessMessage(result?.message || "ดำเนินการเรียบร้อย");
    } catch (err) {
      setError(err.message || "ไม่สามารถดำเนินการได้");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssetChanged() {
    const refreshed = await fetchDetail(id);
    setItem(refreshed.item);
    setMovements(refreshed.movements);
  }

  const actionLayout = useMemo(() => {
    if (!item) {
      return { primary: null, secondary: [], more: [] };
    }

    const available = new Set(
      canOperate ? ACTIONS_BY_STATUS[item.current_status] ?? [] : [],
    );
    const preferred = ACTION_GROUPS[item.current_status] ?? {
      primary: null,
      secondary: [],
      more: [],
    };

    return {
      primary: available.has(preferred.primary) ? preferred.primary : null,
      secondary: preferred.secondary.filter((action) => available.has(action)),
      more: preferred.more.filter((action) => available.has(action)),
    };
  }, [item, canOperate]);

  if (loading) {
    return <div className="card">กำลังโหลดข้อมูลอุปกรณ์...</div>;
  }

  if (!item) {
    return (
      <>
        {error && <div className="message message-error">{error}</div>}
        <Link to="/inventory" className="button button-secondary">
          กลับหน้ารายการอุปกรณ์
        </Link>
      </>
    );
  }

  const availableActions = canOperate
    ? ACTIONS_BY_STATUS[item.current_status] ?? []
    : [];

  return (
    <>
      <div className="asset-detail-hero">
        <Link to="/inventory" className="text-link asset-detail-back">
          ← รายการอุปกรณ์
        </Link>

        <div className="asset-title-row">
          <h1 className="page-title serial-text">{item.serial_number}</h1>
          <StatusBadge status={item.current_status} />
        </div>

        <div className="asset-meta-inline" aria-label="ข้อมูลรุ่นสินค้า">
          <span>{item.product_name || "ไม่ระบุรุ่น"}</span>
          <span>{item.brand || "ไม่ระบุยี่ห้อ"}</span>
          <span className="serial-text">
            {item.part_number || "ไม่ระบุ Part Number"}
          </span>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {successMessage && (
        <div className="message message-success">{successMessage}</div>
      )}

      <div className="asset-detail-layout">
        <section className="card asset-detail-summary-card">
          <div className="asset-section-heading">
            <div>
              <h2 className="card-title">ข้อมูลอุปกรณ์</h2>
              <p>ข้อมูลปัจจุบันและข้อมูลอ้างอิงของอุปกรณ์ชิ้นนี้</p>
            </div>
          </div>

          <dl className="asset-summary-list">
            <div className="asset-summary-row">
              <dt>ตำแหน่งปัจจุบัน</dt>
              <dd>{item.current_location || "ไม่ระบุ"}</dd>
            </div>

            {item.current_project_name && (
              <div className="asset-summary-row asset-summary-highlight">
                <dt>งาน / โครงการ</dt>
                <dd>
                  {item.current_project_code
                    ? `${item.current_project_code} · ${item.current_project_name}`
                    : item.current_project_name}
                </dd>
              </div>
            )}

            {item.current_responsible_person && (
              <div className="asset-summary-row">
                <dt>ผู้รับผิดชอบ</dt>
                <dd>{item.current_responsible_person}</dd>
              </div>
            )}

            {item.expected_return_date && (
              <div className="asset-summary-row">
                <dt>กำหนดคืน</dt>
                <dd>{formatDate(item.expected_return_date)}</dd>
              </div>
            )}

            <div className="asset-summary-row">
              <dt>วันที่รับเข้า</dt>
              <dd>
                {item.received_at ? formatDate(item.received_at) : "ไม่ระบุ"}
              </dd>
            </div>

            <div className="asset-summary-row">
              <dt>การรับประกัน</dt>
              <dd>
                {formatWarrantyPeriod(item.warranty_start, item.warranty_end)}
              </dd>
            </div>
          </dl>

          <div className="asset-subsection">
            <h3>รุ่นสินค้า</h3>

            <dl className="asset-summary-list asset-summary-list-compact">
              <div className="asset-summary-row">
                <dt>ชื่อรุ่น</dt>
                <dd>{item.product_name || "ไม่ระบุ"}</dd>
              </div>

              <div className="asset-summary-row">
                <dt>ยี่ห้อ</dt>
                <dd>{item.brand || "ไม่ระบุ"}</dd>
              </div>

              <div className="asset-summary-row">
                <dt>Part Number</dt>
                <dd className="serial-text">
                  {item.part_number || "ไม่ระบุ"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="asset-record-meta">
            <span>บันทึกเข้าระบบเมื่อ</span>
            <strong>
              {item.created_at ? formatDateTime(item.created_at) : "ไม่ระบุ"}
            </strong>
          </div>
        </section>
        <aside className="card asset-actions-panel">
          <div className="asset-section-heading">
            <div>
              <h2 className="card-title">การดำเนินการ</h2>
            </div>
          </div>

          <div className="asset-action-list asset-action-list-priority">
            {actionLayout.primary && (
              <button
                type="button"
                className={ACTION_BUTTON_CLASSES[actionLayout.primary]}
                disabled={actionLoading}
                onClick={() => handleSelectAction(actionLayout.primary)}
              >
                {ACTION_LABELS[actionLayout.primary]}
              </button>
            )}

            {actionLayout.secondary.map((action) => (
              <button
                key={action}
                type="button"
                className={ACTION_BUTTON_CLASSES[action]}
                disabled={actionLoading}
                onClick={() => handleSelectAction(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}

            <AssetManagementPanel item={item} onChanged={handleAssetChanged} />
          </div>

          {availableActions.length === 0 && (
            <div className="terminal-state">
              <span>ไม่มีรายการดำเนินการเพิ่มเติม</span>
            </div>
          )}
        </aside>
      </div>

      <MovementTimeline movements={movements} />

      {selectedAction && (
        <MovementActionDialog
          key={selectedAction}
          action={selectedAction}
          item={item}
          loading={actionLoading}
          locations={locations}
          projects={projects}
          onSubmit={handleMovementSubmit}
          onClose={() => !actionLoading && setSelectedAction(null)}
        />
      )}
    </>
  );
}

export default InventoryDetailPage;
