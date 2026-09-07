import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    productName: "",
    brand: "",
    partNumber: "",
    description: "",
    category: "ทั่วไป",
  });

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/products");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "ไม่สามารถโหลดรายการสินค้าได้");
      }

      setProducts(result.data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "ไม่สามารถเพิ่มสินค้าได้");
      }

      setSuccess(result.message);

      setForm({
        productName: "",
        brand: "",
        partNumber: "",
        description: "",
        category: "ทั่วไป",
      });

      await loadProducts();
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1>Product Manager Scanner</h1>

      <section>
        <h2>เพิ่มสินค้า</h2>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="productName">ชื่อสินค้า</label>

            <input
              id="productName"
              name="productName"
              value={form.productName}
              onChange={handleChange}
              placeholder="เช่น Cisco Catalyst 9200"
              required
            />
          </div>

          <div>
            <label htmlFor="brand">ยี่ห้อ</label>

            <input
              id="brand"
              name="brand"
              value={form.brand}
              onChange={handleChange}
              placeholder="เช่น Cisco"
              required
            />
          </div>

          <div>
            <label htmlFor="partNumber">Part Number</label>

            <input
              id="partNumber"
              name="partNumber"
              value={form.partNumber}
              onChange={handleChange}
              placeholder="เช่น C9200L-24P-4G-E"
              required
            />
          </div>

          <div>
            <label htmlFor="category">หมวดหมู่</label>

            <input
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="description">รายละเอียด</label>

            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="รายละเอียดเพิ่มเติม"
            />
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังเพิ่มสินค้า..." : "เพิ่มสินค้า"}
          </button>
        </form>
      </section>

      {success && <p className="success">{success}</p>}

      {error && <p className="error">{error}</p>}

      <section>
        <h2>รายการสินค้า</h2>

        {loading && <p>กำลังโหลดข้อมูล...</p>}

        {!loading && !error && products.length === 0 && (
          <p>ยังไม่มีสินค้าในระบบ</p>
        )}

        {!loading && products.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อสินค้า</th>
                <th>ยี่ห้อ</th>
                <th>Part Number</th>
                <th>หมวดหมู่</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product, index) => (
                <tr key={product.id}>
                  <td>{index + 1}</td>
                  <td>{product.product_name}</td>
                  <td>{product.brand}</td>
                  <td>{product.part_number}</td>
                  <td>{product.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default App;
