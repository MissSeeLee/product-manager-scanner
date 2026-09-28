import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getOperations, getOperationsSummary } from "../api/operationsApi";
import { OPERATION_CONFIG } from "../operationConfig";
import { formatDateTime } from "../../../shared/lib/formatters";
import { FeedbackMessage, LoadingState } from "../../../shared/components/PageState";

function OperationsPage() {
  const [operations, setOperations] = useState([]);
  const [summary, setSummary] = useState({ overdue: 0, dueToday: 0, claim: 0, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [operationData, summaryData] = await Promise.all([
          getOperations({ limit: 50 }),
          getOperationsSummary(),
        ]);

        if (!cancelled) {
          setOperations(operationData);
          setSummary(summaryData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดรายการเบิกคืนได้");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState message="กำลังโหลดรายการเบิกคืน..." />;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">เบิก / คืน</h1>
          <p className="page-description">
            ทำรายการหลายอุปกรณ์ด้วยข้อมูลร่วมครั้งเดียว และตรวจสอบย้อนหลังเป็นชุด
          </p>
        </div>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>

      <section className="operation-launch-grid" aria-label="เริ่มทำรายการ">
        {Object.entries(OPERATION_CONFIG).map(([type, config]) => (
          <Link key={type} to={`/operations/new?type=${type}`} className="operation-launch-card">
            <span className={`operation-type-mark operation-type-${type.toLowerCase()}`}>
              {config.shortLabel}
            </span>
            <div>
              <strong>{config.label}</strong>
              <span>{config.description}</span>
            </div>
            <span className="operation-launch-arrow">→</span>
          </Link>
        ))}
      </section>

      <section className="operations-attention-grid">
        <Link to="/inventory?returnDue=overdue&sort=expected_return_date&order=asc" className="operations-attention-card">
          <span>เกินกำหนดคืน</span>
          <strong>{summary.overdue}</strong>
          <small>อุปกรณ์ที่ยัง IN_USE และเลยกำหนดคืน</small>
        </Link>

        <Link to="/inventory?returnDue=today&sort=expected_return_date&order=asc" className="operations-attention-card">
          <span>ครบกำหนดวันนี้</span>
          <strong>{summary.dueToday}</strong>
          <small>ควรติดตามการรับคืนวันนี้</small>
        </Link>

        <Link to="/inventory?status=CLAIM" className="operations-attention-card">
          <span>อยู่ระหว่างเคลม</span>
          <strong>{summary.claim}</strong>
          <small>รายการที่ต้องติดตามสถานะ</small>
        </Link>
      </section>

      <section className="card operations-history-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">OPERATION HISTORY</span>
            <h2 className="panel-title">รายการล่าสุด</h2>
          </div>
        </div>

        {operations.length === 0 ? (
          <div className="compact-empty">ยังไม่มีประวัติการเบิก คืน หรือย้ายแบบหลายรายการ</div>
        ) : (
          <div className="operation-history-list">
            {operations.map((operation) => {
              const config = OPERATION_CONFIG[operation.operation_type];

              return (
                <Link key={operation.id} to={`/operations/${operation.id}`} className="operation-history-row">
                  <div className="operation-history-code">
                    <strong className="serial-text">{operation.operation_code}</strong>
                    <span>{formatDateTime(operation.created_at)}</span>
                  </div>

                  <div className="operation-history-main">
                    <strong>{config?.label || operation.operation_type}</strong>
                    <span>
                      {operation.project_name_snapshot || operation.reference_code || "ไม่ผูกกับโครงการ"}
                    </span>
                  </div>

                  <div className="operation-history-meta">
                    <strong>{operation.item_count} รายการ</strong>
                    <span>{operation.destination_location}</span>
                  </div>

                  <span className="operation-history-open">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default OperationsPage;
