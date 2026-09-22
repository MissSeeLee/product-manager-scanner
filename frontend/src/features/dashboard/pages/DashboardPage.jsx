import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getInventoryItems,
  getInventorySummary,
} from "../../inventory/api/inventoryApi";
import StatusBadge from "../../inventory/components/StatusBadge";
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
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [summaryData, recentResult] = await Promise.all([
          getInventorySummary(),
          getInventoryItems({
            sort: "updated_at",
            order: "desc",
            limit: 5,
            offset: 0,
          }),
        ]);

        if (!cancelled) {
          setSummary(summaryData);
          setRecentItems(Array.isArray(recentResult?.data) ? recentResult.data : []);
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
      <div className="hero-panel">
        <div>
          <span className="section-kicker">IT ASSET OPERATIONS</span>
          <h2 className="hero-title">จัดการอุปกรณ์จากสถานะจริง</h2>
          <p className="hero-description">
            ค้นหา สแกน รับเข้า และจัดการ Lifecycle ของอุปกรณ์โดยอ้างอิง Serial Number และ Movement History
          </p>
        </div>

        <div className="hero-actions">
          <Link to="/scanner" className="button button-primary">
            สแกนอุปกรณ์
          </Link>
          <Link to="/inventory" className="button button-secondary">
            เปิด Asset Explorer
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
          <span className="metric-meta metric-positive">พร้อมใช้งาน</span>
        </Link>

        <Link to="/inventory?status=IN_USE" className="metric-card">
          <span className="metric-label">กำลังใช้งาน</span>
          <strong className="metric-value">{summary.IN_USE}</strong>
          <span className="metric-meta">Active deployment</span>
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
              <span className="section-kicker">ATTENTION</span>
              <h3 className="panel-title">สถานะที่ควรตรวจสอบ</h3>
            </div>
          </div>

          <div className="attention-list">
            <Link to="/inventory?status=CLAIM" className="attention-row attention-row-link">
              <div className="attention-icon attention-warning">!</div>
              <div className="attention-copy">
                <strong>อยู่ระหว่างเคลม</strong>
                <span>รอรับคืน เปลี่ยนทดแทน หรือปลดระวาง</span>
              </div>
              <strong className="attention-value">{summary.CLAIM}</strong>
            </Link>

            <Link to="/inventory?status=REPLACED" className="attention-row attention-row-link">
              <div className="attention-icon">R</div>
              <div className="attention-copy">
                <strong>ถูกเปลี่ยนทดแทน</strong>
                <span>Terminal state เก็บไว้เพื่อประวัติ</span>
              </div>
              <strong className="attention-value">{summary.REPLACED}</strong>
            </Link>

            <Link to="/inventory?status=RETIRED" className="attention-row attention-row-link">
              <div className="attention-icon attention-danger">×</div>
              <div className="attention-copy">
                <strong>ปลดระวาง</strong>
                <span>อุปกรณ์ที่สิ้นสุด Lifecycle</span>
              </div>
              <strong className="attention-value">{summary.RETIRED}</strong>
            </Link>
          </div>
        </section>

        <section className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">RECENT ASSETS</span>
              <h3 className="panel-title">อุปกรณ์ที่อัปเดตล่าสุด</h3>
            </div>
            <Link to="/inventory?sort=updated_at&order=desc" className="text-link">
              ดูทั้งหมด
            </Link>
          </div>

          {recentItems.length === 0 ? (
            <div className="compact-empty">ยังไม่มีข้อมูลอุปกรณ์</div>
          ) : (
            <div className="recent-asset-list">
              {recentItems.map((item) => (
                <Link key={item.id} to={`/inventory/${item.id}`} className="recent-asset-row">
                  <div className="recent-asset-identity">
                    <strong className="serial-text">{item.serial_number}</strong>
                    <span>{item.product_name || "ไม่ระบุรุ่น"}</span>
                  </div>
                  <div className="recent-asset-meta">
                    <span>{item.current_location || "ไม่ระบุตำแหน่ง"}</span>
                    <StatusBadge status={item.current_status} />
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
