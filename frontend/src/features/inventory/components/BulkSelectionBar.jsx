function BulkSelectionBar({
  count = 0,
  canIssue = false,
  canReturn = false,
  canMove = false,
  onIssue,
  onReturn,
  onMove,
  onClear,
}) {
  if (count <= 0) {
    return null;
  }

  const hasAction = canIssue || canReturn || canMove;

  return (
    <div className="bulk-selection-bar" role="region" aria-label="การดำเนินการกับอุปกรณ์ที่เลือก">
      <div className="bulk-selection-summary">
        <strong>เลือกแล้ว {count} รายการ</strong>
        <span>
          {hasAction
            ? "ข้อมูลร่วมจะกรอกเพียงครั้งเดียวสำหรับทั้งชุด"
            : "สถานะของรายการที่เลือกไม่รองรับการทำรายการร่วมกัน"}
        </span>
      </div>

      <div className="bulk-selection-actions">
        {canIssue && (
          <button type="button" className="button button-primary" onClick={onIssue}>
            เบิกที่เลือก
          </button>
        )}

        {canReturn && (
          <button type="button" className="button button-primary" onClick={onReturn}>
            รับคืนที่เลือก
          </button>
        )}

        {canMove && (
          <button type="button" className="button button-secondary" onClick={onMove}>
            ย้ายที่เลือก
          </button>
        )}

        <button type="button" className="button button-ghost" onClick={onClear}>
          ยกเลิกการเลือก
        </button>
      </div>
    </div>
  );
}

export default BulkSelectionBar;
