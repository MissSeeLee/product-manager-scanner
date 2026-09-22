import { formatDateTime } from "../../../shared/lib/formatters";

const MOVEMENT_LABELS = {
  RECEIVE: "รับเข้า",
  ISSUE: "เบิกใช้งาน",
  RETURN: "รับคืนเข้าคลัง",
  MOVE: "ย้ายตำแหน่ง",
  CLAIM: "ส่งเคลม",
  CLAIM_RETURN: "รับคืนจากเคลม",
  REPLACED: "เปลี่ยนอุปกรณ์ทดแทน",
  RETIRE: "ปลดระวาง",
};

function MovementTimeline({ movements = [] }) {
  return (
    <section className="card">
      <span className="section-kicker">MOVEMENT HISTORY</span>
      <h2 className="card-title">ประวัติการเคลื่อนไหว</h2>

      {movements.length === 0 ? (
        <div className="empty-state">ยังไม่มีประวัติการเคลื่อนไหว</div>
      ) : (
        <div className="movement-timeline">
          {movements.map((movement) => (
            <article className="movement-event" key={movement.id}>
              <div className="movement-dot" aria-hidden="true" />
              <div className="movement-event-body">
                <div className="movement-event-heading">
                  <strong>
                    {MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}
                  </strong>
                  <time>{formatDateTime(movement.movement_date)}</time>
                </div>

                <div className="movement-event-meta">
                  {movement.from_location && (
                    <span>จาก: {movement.from_location}</span>
                  )}
                  {movement.to_location && (
                    <span>ไป: {movement.to_location}</span>
                  )}
                  {movement.performed_by && (
                    <span>ผู้ดำเนินการ: {movement.performed_by}</span>
                  )}
                  {movement.distributor && (
                    <span>ผู้จัดจำหน่าย: {movement.distributor}</span>
                  )}
                  {movement.related_serial_number && (
                    <span>
                      Serial ที่เกี่ยวข้อง: {movement.related_serial_number}
                    </span>
                  )}
                </div>

                {movement.note && (
                  <p className="movement-note">{movement.note}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default MovementTimeline;
