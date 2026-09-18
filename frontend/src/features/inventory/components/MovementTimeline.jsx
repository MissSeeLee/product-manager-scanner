function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MovementTimeline({ movements = [] }) {
  if (movements.length === 0) {
    return (
      <section className="card">
        <h2>ประวัติการเคลื่อนไหว</h2>

        <div className="empty-state">ยังไม่มีประวัติการเคลื่อนไหว</div>
      </section>
    );
  }

  return (
    <section className="card table-card">
      <div className="table-header">
        <h2 className="table-title">ประวัติการเคลื่อนไหว</h2>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>จาก</th>
              <th>ไปยัง</th>
              <th>ผู้ดำเนินการ</th>
              <th>Serial ที่เกี่ยวข้อง</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDateTime(movement.movement_date)}</td>

                <td>
                  <strong>{movement.movement_type}</strong>
                </td>

                <td>{movement.from_location || "-"}</td>

                <td>{movement.to_location || "-"}</td>

                <td>{movement.performed_by || "-"}</td>

                <td>{movement.related_serial_number || "-"}</td>

                <td>{movement.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default MovementTimeline;
