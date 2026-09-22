import { useEffect, useState } from "react";
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

import MovementForm from "../components/MovementForm";
import MovementTimeline from "../components/MovementTimeline";
import StatusBadge from "../components/StatusBadge";

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

  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        const data = await fetchDetail(id);

        if (!cancelled) {
          setItem(data.item);
          setMovements(data.movements);
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
      const result = await handler(id, data);
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

  const availableActions = ACTIONS_BY_STATUS[item.current_status] ?? [];

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
              <p>คำสั่งที่ทำได้จากสถานะปัจจุบัน</p>
            </div>
          </div>

          {availableActions.length > 0 ? (
            <div className="asset-action-list">
              {availableActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={
                    selectedAction === action
                      ? `${ACTION_BUTTON_CLASSES[action]} action-selected`
                      : ACTION_BUTTON_CLASSES[action]
                  }
                  disabled={actionLoading}
                  onClick={() => handleSelectAction(action)}
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          ) : (
            <div className="terminal-state">
              <strong>สิ้นสุด Lifecycle</strong>
              <span>
                อุปกรณ์สถานะ {item.current_status} ไม่สามารถทำ Movement เพิ่มได้
              </span>
            </div>
          )}
        </aside>
      </div>

      {selectedAction && (
        <MovementForm
          key={selectedAction}
          action={selectedAction}
          loading={actionLoading}
          onSubmit={handleMovementSubmit}
          onCancel={() => setSelectedAction(null)}
        />
      )}

      <MovementTimeline movements={movements} />
    </>
  );
}

export default InventoryDetailPage;
