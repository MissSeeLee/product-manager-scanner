import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getInventorySummary } from "../../inventory/api/inventoryApi";
import { getOperationsSummary } from "../../operations/api/operationsApi";
import { OPERATION_CONFIG } from "../../operations/operationConfig";
import { formatDateTime } from "../../../shared/lib/formatters";
import {
  FeedbackMessage,
  LoadingState,
} from "../../../shared/components/PageState";

function DashboardPage() {
  const [summary, setSummary] = useState({
    total: 0,
    IN_STOCK: 0,
    IN_USE: 0,
    CLAIM: 0,
    REPLACED: 0,
    RETIRED: 0,
  });
  const [operationsSummary, setOperationsSummary] = useState({
    overdue: 0,
    dueToday: 0,
    claim: 0,
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [inventoryData, operationData] = await Promise.all([
          getInventorySummary(),
          getOperationsSummary(),
        ]);

        if (!cancelled) {
          setSummary(inventoryData);
          setOperationsSummary(operationData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.message || "ไม่สามารถโหลดภาพรวมระบบได้");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState message="กำลังโหลดภาพรวมอุปกรณ์..." />;
  }

  return (
    <section className="dashboard-page">
      <div className="hero-panel dashboard-operation-hero">
        <div>
          <span className="section-kicker">TODAY&apos;S OPERATIONS</span>
          <h2 className="hero-title">เริ่มงานประจำวันจากตรงนี้</h2>
          <p className="hero-description">
            เบิก คืน และสแกนอุปกรณ์โดยไม่ต้องเปิดรายละเอียดทีละ Serial
          </p>
        </div>

        <div className="hero-actions dashboard-quick-actions">
          <Link to="/operations/new?type=ISSUE" className="button button-primary">
            + เบิกอุปกรณ์
          </Link>
          <Link to="/operations/new?type=RETURN" className="button button-secondary">
            รับคืน
          </Link>
          <Link to="/scanner" className="button button-secondary">
            สแกน
          </Link>
        </div>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>

      <div className="metric-grid">
        <Link to="/inventory" className="metric-card metric-card-primary">
          <span className="metric-label">อุปกรณ์ทั้งหมด</span>
          <strong className="metric-value">{summary.total}</strong>
          <span className="metric-meta">Physical assets</span>
        </Link>

        <Link to="/inventory?status=IN_STOCK" className="metric-card">
          <span className="metric-label">อยู่ในคลัง</span>
          <strong className="metric-value">{summary.IN_STOCK}</strong>
          <span className="metric-meta metric-positive">พร้อมเบิกใช้งาน</span>
        </Link>

        <Link to="/inventory?status=IN_USE" className="metric-card">
          <span className="metric-label">กำลังใช้งาน</span>
          <strong className="metric-value">{summary.IN_USE}</strong>
          <span className="metric-meta">อยู่กับผู้รับผิดชอบ / งาน</span>
        </Link>

        <Link to="/inventory?status=CLAIM" className="metric-card">
          <span className="metric-label">อยู่ระหว่างเคลม</span>
          <strong className="metric-value">{summary.CLAIM}</strong>
          <span className={summary.CLAIM > 0 ? "metric-meta metric-warning" : "metric-meta"}>
            {summary.CLAIM > 0 ? "ควรติดตาม" : "ไม่มีรายการค้าง"}
          </span>
        </Link>
      </div>

      <div className="dashboard-grid">
        <section className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ACTION REQUIRED</span>
              <h3 className="panel-title">สิ่งที่ควรจัดการ</h3>
            </div>
            <Link to="/operations" className="text-link">เปิดศูนย์เบิก / คืน</Link>
          </div>

          <div className="attention-list">
            <Link to="/inventory?status=IN_USE&sort=expected_return_date&order=asc" className="attention-row attention-row-link">
              <div className="attention-icon attention-danger">!</div>
              <div className="attention-copy">
                <strong>เกินกำหนดคืน</strong>
                <span>เรียงอุปกรณ์ที่ควรติดตามคืนก่อน</span>
              </div>
              <strong className="attention-value">{operationsSummary.overdue}</strong>
            </Link>

            <Link to="/operations" className="attention-row attention-row-link">
              <div className="attention-icon attention-warning">T</div>
              <div className="attention-copy">
                <strong>ครบกำหนดวันนี้</strong>
                <span>เตรียมรับคืนหรือติดต่อผู้รับผิดชอบ</span>
              </div>
              <strong className="attention-value">{operationsSummary.dueToday}</strong>
            </Link>

            <Link to="/inventory?status=CLAIM" className="attention-row attention-row-link">
              <div className="attention-icon attention-warning">C</div>
              <div className="attention-copy">
                <strong>อยู่ระหว่างเคลม</strong>
                <span>ติดตามรับคืน เปลี่ยนทดแทน หรือปลดระวาง</span>
              </div>
              <strong className="attention-value">{operationsSummary.claim}</strong>
            </Link>
          </div>
        </section>

        <section className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">RECENT OPERATIONS</span>
              <h3 className="panel-title">รายการล่าสุด</h3>
            </div>
            <Link to="/operations" className="text-link">ดูทั้งหมด</Link>
          </div>

          {operationsSummary.recent.length === 0 ? (
            <div className="compact-empty">ยังไม่มีประวัติการเบิก คืน หรือย้ายแบบหลายรายการ</div>
          ) : (
            <div className="dashboard-operation-list">
              {operationsSummary.recent.map((operation) => (
                <Link key={operation.id} to={`/operations/${operation.id}`} className="dashboard-operation-row">
                  <div>
                    <strong className="serial-text">{operation.operation_code}</strong>
                    <span>
                      {OPERATION_CONFIG[operation.operation_type]?.label || operation.operation_type}
                      {operation.project_name_snapshot ? ` · ${operation.project_name_snapshot}` : ""}
                    </span>
                  </div>
                  <div className="dashboard-operation-meta">
                    <strong>{operation.item_count} รายการ</strong>
                    <span>{formatDateTime(operation.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default DashboardPage;
