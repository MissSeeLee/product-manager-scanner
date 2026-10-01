import { useEffect, useState } from "react";

import { formatDateTime } from "../../../shared/lib/formatters";
import { getAssetChangeHistory } from "../api/assetManagementApi";

const LABELS = {
  EDIT_METADATA: "แก้ไขข้อมูลอุปกรณ์",
  CORRECT_INTAKE: "แก้ไขข้อมูลรับเข้า",
  VOID_REGISTRATION: "ยกเลิกการลงทะเบียน",
};

export default function AssetChangeHistory({ assetId, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAssetChangeHistory(assetId)
      .then((data) => {
        if (active) setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดประวัติการแก้ไขไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [assetId, refreshKey]);

  return (
    <section className="card ux-change-history">
      <div className="card-header">
        <div>
          <span className="section-kicker">RECORD CHANGE HISTORY</span>
          <h2 className="card-title">ประวัติการแก้ไขข้อมูล</h2>
          <p className="page-description">
            แยกจาก Movement History เพื่อไม่ทำให้การแก้ Metadata ดูเหมือนการเคลื่อนย้ายจริง
          </p>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {rows.length === 0 ? (
        <div className="compact-empty">ยังไม่มีการแก้ข้อมูลย้อนหลัง</div>
      ) : (
        <div className="ux-history-list">
          {rows.map((row) => (
            <article className="ux-history-row" key={row.id}>
              <div>
                <strong>{LABELS[row.action] || row.action}</strong>
                <span>{row.reason || "ไม่ระบุเหตุผล"}</span>
              </div>
              <div className="ux-history-meta">
                <strong>{row.display_name || row.username || "ไม่ระบุผู้แก้"}</strong>
                <span>{formatDateTime(row.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
