import { useEffect, useState } from "react";

import { formatDateTime } from "../../../shared/lib/formatters";
import { getActivity } from "../api/activityApi";

const LABELS = {
  RECEIVE: "รับเข้า",
  ISSUE: "เบิก",
  RETURN: "รับคืน",
  MOVE: "ย้าย",
  CLAIM: "ส่งเคลม",
  CLAIM_RETURN: "รับกลับจากเคลม",
  REPLACED: "เปลี่ยนทดแทน",
  RETIRE: "ปลดระวาง",
  EDIT_METADATA: "แก้ข้อมูลอุปกรณ์",
  CORRECT_INTAKE: "แก้ข้อมูลรับเข้า",
  VOID_REGISTRATION: "ยกเลิกการลงทะเบียน",
  EDIT_PRODUCT: "แก้ Product Master",
  ARCHIVE_PRODUCT: "Archive Product",
  ACTIVATE_PRODUCT: "เปิด Product",
  CHANGE_PROJECT_STATUS: "เปลี่ยนสถานะโครงการ",
};

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getActivity(150)
      .then((data) => {
        if (active) setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดประวัติกิจกรรมไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">ประวัติกิจกรรม</h1>
          <p className="page-description">
            รวม Lifecycle Movement กับ Record Change โดยยังแยกความหมายของเหตุการณ์ทั้งสองประเภท
          </p>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      <section className="card ux-activity-list">
        {rows.length === 0 ? (
          <div className="compact-empty">ยังไม่มีกิจกรรม</div>
        ) : (
          rows.map((row) => (
            <article className="ux-activity-row" key={`${row.source}-${row.source_id}`}>
              <div>
                <span className="section-kicker">{row.source}</span>
                <strong>{LABELS[row.action] || row.action}</strong>
                <span>
                  {row.serial_number ? `${row.serial_number} · ` : ""}
                  {row.from_location && row.to_location
                    ? `${row.from_location} → ${row.to_location}`
                    : row.to_location || row.reason || row.note || row.context_name || ""}
                </span>
              </div>
              <div className="ux-history-meta">
                <strong>{row.actor || "ไม่ระบุผู้ดำเนินการ"}</strong>
                <span>{formatDateTime(row.occurred_at)}</span>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
