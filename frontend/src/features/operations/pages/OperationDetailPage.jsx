import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { getOperation } from "../api/operationsApi";
import { OPERATION_CONFIG } from "../operationConfig";
import StatusBadge from "../../inventory/components/StatusBadge";
import { formatDate, formatDateTime } from "../../../shared/lib/formatters";
import { FeedbackMessage, LoadingState } from "../../../shared/components/PageState";

function OperationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getOperation(id)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดรายละเอียดรายการได้");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <LoadingState message="กำลังโหลดรายละเอียดรายการ..." />;
  }

  if (!detail) {
    return <FeedbackMessage type="error">{error || "ไม่พบรายการ"}</FeedbackMessage>;
  }

  const { operation, items } = detail;
  const config = OPERATION_CONFIG[operation.operation_type];
  const linkedItems = items.filter(
    (item) =>
      operation.operation_type === "ISSUE" &&
      Number(item.current_issue_operation_id) === Number(operation.id),
  );
  const returnableItems = linkedItems.filter(
    (item) => item.current_status === "IN_USE",
  );
  const canReturnFromIssue = returnableItems.length > 0;
  const returnIds = returnableItems.map((item) => Number(item.id));
  const completedOrReassignedCount =
    operation.operation_type === "ISSUE"
      ? items.length - linkedItems.length
      : 0;

  return (
    <>
      <div className="page-header operation-detail-header">
        <div>
          <Link to="/operations" className="text-link">← ประวัติเบิก / คืน</Link>
          <h1 className="page-title serial-text">{operation.operation_code}</h1>
          <p className="page-description">
            {config?.label || operation.operation_type} · {items.length} รายการ · {formatDateTime(operation.created_at)}
          </p>
        </div>

        {canReturnFromIssue && (
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              navigate("/operations/new?type=RETURN", {
                state: {
                  assetIds: returnIds,
                  sourceOperationId: operation.id,
                },
              })
            }
          >
            รับคืนที่ยังค้าง {returnIds.length} รายการ
          </button>
        )}
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>
      <FeedbackMessage type="success">{location.state?.successMessage}</FeedbackMessage>

      <section className="card operation-detail-summary">
        <dl className="operation-detail-grid">
          <div>
            <dt>ประเภท</dt>
            <dd>{config?.label || operation.operation_type}</dd>
          </div>
          <div>
            <dt>งาน / โครงการ</dt>
            <dd>{operation.project_name || operation.project_name_snapshot || "ไม่ระบุ"}</dd>
          </div>
          <div>
            <dt>เลขอ้างอิง</dt>
            <dd>{operation.reference_code || "ไม่ระบุ"}</dd>
          </div>
          <div>
            <dt>ผู้รับผิดชอบ</dt>
            <dd>{operation.responsible_person || "ไม่ระบุ"}</dd>
          </div>
          <div>
            <dt>ปลายทาง</dt>
            <dd>{operation.destination_location}</dd>
          </div>
          <div>
            <dt>กำหนดคืน</dt>
            <dd>{operation.expected_return_date ? formatDate(operation.expected_return_date) : "ไม่กำหนด"}</dd>
          </div>
          <div>
            <dt>ผู้ดำเนินการ</dt>
            <dd>{operation.performed_by || "ไม่ระบุ"}</dd>
          </div>
          <div>
            <dt>หมายเหตุ</dt>
            <dd>{operation.note || "ไม่มี"}</dd>
          </div>
        </dl>
      </section>

      {operation.operation_type === "ISSUE" && (
        <section className="operation-return-progress" aria-label="สถานะการคืนของใบเบิก">
          <div>
            <span>เบิกทั้งหมด</span>
            <strong>{items.length}</strong>
          </div>
          <div>
            <span>ยังผูกกับใบเบิกนี้</span>
            <strong>{linkedItems.length}</strong>
          </div>
          <div>
            <span>คืนแล้ว / ถูกจัดสรรใหม่</span>
            <strong>{completedOrReassignedCount}</strong>
          </div>
        </section>
      )}

      <section className="card operation-detail-items">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">ASSETS</span>
            <h2 className="panel-title">อุปกรณ์ในรายการ</h2>
          </div>
          <strong>{items.length} รายการ</strong>
        </div>

        <div className="operation-detail-item-list">
          {items.map((item, index) => (
            <div key={item.movement_id} className="operation-detail-item-row">
              <span className="operation-row-number">{index + 1}</span>
              <div>
                <Link to={`/inventory/${item.id}`} className="serial-link">
                  {item.serial_number}
                </Link>
                <span>{item.product_name} · {item.brand}</span>
              </div>
              <div className="operation-item-route">
                <span>{item.from_location || "ไม่ระบุ"}</span>
                <span aria-hidden="true">→</span>
                <span>{item.to_location || "ไม่ระบุ"}</span>
              </div>
              <div className="operation-item-current-state">
                <small>ปัจจุบัน</small>
                <StatusBadge status={item.current_status} />
                <span>{item.current_location || "ไม่ระบุตำแหน่ง"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default OperationDetailPage;
