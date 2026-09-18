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
} from "../api/movementApi";

import MovementForm from "../components/MovementForm";
import MovementTimeline from "../components/MovementTimeline";
import StatusBadge from "../components/StatusBadge";

const ACTIONS_BY_STATUS = {
  IN_STOCK: ["ISSUE", "MOVE", "CLAIM", "RETIRE"],

  IN_USE: ["MOVE", "CLAIM", "RETIRE"],

  CLAIM: ["MOVE", "CLAIM_RETURN", "REPLACED", "RETIRE"],

  REPLACED: [],
  RETIRED: [],
};

const ACTION_LABELS = {
  ISSUE: "เบิกใช้งาน",
  MOVE: "ย้ายตำแหน่ง",
  CLAIM: "ส่งเคลม",
  CLAIM_RETURN: "รับคืนจากเคลม",
  REPLACED: "เปลี่ยนอุปกรณ์",
  RETIRE: "ปลดระวาง",
};

const MOVEMENT_HANDLERS = {
  ISSUE: issueInventory,
  MOVE: moveInventory,
  CLAIM: claimInventory,
  CLAIM_RETURN: claimReturnInventory,
  REPLACED: replaceInventory,
  RETIRE: retireInventory,
};

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

async function fetchDetail(id) {
  const [itemData, historyData] = await Promise.all([
    getInventoryItemById(id),
    getMovementHistory(id),
  ]);

  const movements = Array.isArray(historyData)
    ? historyData
    : (historyData?.movements ?? []);

  return {
    item: itemData,
    movements,
  };
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

        if (cancelled) {
          return;
        }

        setItem(data.item);
        setMovements(data.movements);
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
    if (!selectedAction) {
      return;
    }

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
    return <div className="card">กำลังโหลดข้อมูล...</div>;
  }

  if (!item) {
    return (
      <>
        {error && <div className="message message-error">{error}</div>}

        <Link to="/inventory" className="button button-secondary">
          กลับหน้า Inventory
        </Link>
      </>
    );
  }

  const availableActions = ACTIONS_BY_STATUS[item.current_status] ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/inventory" className="button button-secondary">
            ← กลับ
          </Link>

          <h1>{item.serial_number}</h1>

          <p className="text-muted">รายละเอียดอุปกรณ์</p>
        </div>

        <StatusBadge status={item.current_status} />
      </div>

      {error && <div className="message message-error">{error}</div>}

      {successMessage && (
        <div className="message message-success">{successMessage}</div>
      )}

      <section className="card">
        <h2>ข้อมูลอุปกรณ์</h2>

        <div className="table-wrapper">
          <table className="data-table">
            <tbody>
              <tr>
                <th>Serial Number</th>

                <td>{item.serial_number}</td>
              </tr>

              <tr>
                <th>สินค้า</th>

                <td>{item.product_name || "-"}</td>
              </tr>

              <tr>
                <th>ยี่ห้อ</th>

                <td>{item.brand || "-"}</td>
              </tr>

              <tr>
                <th>Part Number</th>

                <td>{item.part_number || "-"}</td>
              </tr>

              <tr>
                <th>สถานะ</th>

                <td>
                  <StatusBadge status={item.current_status} />
                </td>
              </tr>

              <tr>
                <th>ตำแหน่ง</th>

                <td>{item.current_location || "-"}</td>
              </tr>

              <tr>
                <th>เริ่มประกัน</th>

                <td>{formatDate(item.warranty_start)}</td>
              </tr>

              <tr>
                <th>สิ้นสุดประกัน</th>

                <td>{formatDate(item.warranty_end)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>จัดการอุปกรณ์</h2>

        {availableActions.length > 0 ? (
          <div className="form-actions">
            {availableActions.map((action) => (
              <button
                key={action}
                type="button"
                className={
                  selectedAction === action
                    ? "button button-primary"
                    : "button button-secondary"
                }
                disabled={actionLoading}
                onClick={() => handleSelectAction(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted">
            อุปกรณ์นี้สิ้นสุด Lifecycle แล้ว ไม่สามารถทำ Movement เพิ่มได้
          </p>
        )}
      </section>

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
