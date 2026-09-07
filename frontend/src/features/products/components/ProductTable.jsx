function ProductTable({
  products = [],
  onEdit,
}) {
  return (
    <section className="card table-card">
      <div className="table-header">
        <h2 className="table-title">
          รายการสินค้า
        </h2>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          ยังไม่มีสินค้าในระบบ
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อสินค้า</th>
                <th>ยี่ห้อ</th>
                <th>Part Number</th>
                <th>หมวดหมู่</th>
                <th>รายละเอียด</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.product_name}</td>
                  <td>{product.brand}</td>
                  <td>{product.part_number}</td>
                  <td>{product.category || "-"}</td>
                  <td>{product.description || "-"}</td>

                  <td>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => onEdit?.(product)}
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ProductTable