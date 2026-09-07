function ProductTable({ products = [], onEdit }) {
  if (products.length === 0) {
    return (
      <section>
        <h2>รายการสินค้า</h2>
        <p>ยังไม่มีสินค้าในระบบ</p>
      </section>
    );
  }

  return (
    <section>
      <h2>รายการสินค้า</h2>

      <div>
        <table>
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
                  <button type="button" onClick={() => onEdit?.(product)}>
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ProductTable;
