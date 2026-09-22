function ProductTable({
  products = [],
  onEdit,
}) {
  return (
    <section className="card table-card">
      <div className="table-header">
        <div>
          <span className="section-kicker">MODELS</span>
          <h2 className="table-title">
            รายการรุ่นสินค้า
          </h2>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          ยังไม่มีรุ่นสินค้าในระบบ
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อรุ่น</th>
                <th>ยี่ห้อ</th>
                <th>Part Number</th>
                <th>หมวดหมู่</th>
                <th>รายละเอียดรุ่น</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-primary">
                      {product.product_name}
                    </div>
                  </td>
                  <td>{product.brand}</td>
                  <td>
                    <span className="part-number">
                      {product.part_number}
                    </span>
                  </td>
                  <td>{product.category || "ไม่ระบุ"}</td>
                  <td>{product.description || "ไม่ระบุ"}</td>
                  <td>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => onEdit?.(product)}
                    >
                      แก้ไขรุ่น
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

export default ProductTable;
