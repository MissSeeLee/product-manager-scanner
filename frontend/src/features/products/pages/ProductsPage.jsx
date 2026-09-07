import { useEffect, useState } from "react";

import ProductForm from "../components/ProductForm";
import ProductTable from "../components/ProductTable";

import { createProduct, getProducts, updateProduct } from "../api/productApi";

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProducts() {
      try {
        const data = await getProducts();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "ไม่สามารถโหลดรายการสินค้าได้");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshProducts() {
    const data = await getProducts();
    setProducts(data);
  }

  async function handleSubmitProduct(payload) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let result;

      if (editingProduct) {
        result = await updateProduct(editingProduct.id, payload);

        setSuccessMessage(result?.message || "แก้ไขสินค้าสำเร็จ");
      } else {
        result = await createProduct(payload);

        setSuccessMessage(result?.message || "เพิ่มสินค้าสำเร็จ");
      }

      setEditingProduct(null);

      await refreshProducts();

      return true;
    } catch (error) {
      setErrorMessage(error.message || "ไม่สามารถบันทึกสินค้าได้");

      return false;
    }
  }

  function handleEdit(product) {
    setEditingProduct(product);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleCancelEdit() {
    setEditingProduct(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <main>
      <header>
        <h1>Product Manager</h1>
        <p>จัดการข้อมูลสินค้าและรุ่นอุปกรณ์</p>
      </header>

      {errorMessage && <p role="alert">{errorMessage}</p>}

      {successMessage && <p role="status">{successMessage}</p>}

      <ProductForm
        editingProduct={editingProduct}
        onSubmit={handleSubmitProduct}
        onCancel={handleCancelEdit}
      />

      {isLoading ? (
        <p>กำลังโหลดรายการสินค้า...</p>
      ) : (
        <ProductTable products={products} onEdit={handleEdit} />
      )}
    </main>
  );
}

export default ProductsPage;
