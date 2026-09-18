import StatusBadge from "./StatusBadge";

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

function InventoryTable({ items = [], onView }) {
  return (
    <section className="card table-card">
      <div className="table-header">
        <h2 className="table-title">รายการอุปกรณ์</h2>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">ยังไม่มีอุปกรณ์ในระบบ</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>สินค้า</th>
                <th>ยี่ห้อ</th>
                <th>Part Number</th>
                <th>สถานะ</th>
                <th>ตำแหน่ง</th>
                <th>ประกันถึง</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.serial_number}</strong>
                  </td>

                  <td>{item.product_name || "-"}</td>

                  <td>{item.brand || "-"}</td>

                  <td>{item.part_number || "-"}</td>

                  <td>
                    <StatusBadge status={item.current_status} />
                  </td>

                  <td>{item.current_location || "-"}</td>

                  <td>{formatDate(item.warranty_end)}</td>

                  <td>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => onView?.(item)}
                    >
                      ดูรายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default InventoryTable;
