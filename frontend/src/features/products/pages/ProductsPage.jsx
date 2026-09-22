import { useEffect, useState } from "react";

import ProductForm from "../components/ProductForm";
import ProductTable from "../components/ProductTable";

import {
  createProduct,
  getProducts,
  updateProduct,
} from "../api/productApi";

import {
  FeedbackMessage,
  LoadingState,
} from "../../../shared/components/PageState";

function ProductsPage() {
  const [products, setProducts] = useState([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formIsOpen = showCreateForm || Boolean(editingProduct);

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
          setErrorMessage(
            error.message || "ไม่สามารถโหลดรายการรุ่นสินค้าได้",
          );
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

  function handleOpenCreateForm() {
    setEditingProduct(null);
    setErrorMessage("");
    setSuccessMessage("");
    setShowCreateForm(true);
  }

  async function handleSubmitProduct(payload) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let result;

      if (editingProduct) {
        result = await updateProduct(editingProduct.id, payload);

        setSuccessMessage(
          result?.message || "แก้ไขรุ่นสินค้าเรียบร้อย",
        );
      } else {
        result = await createProduct(payload);

        setSuccessMessage(
          result?.message || "สร้างรุ่นสินค้าเรียบร้อย",
        );
      }

      setEditingProduct(null);
      setShowCreateForm(false);

      await refreshProducts();

      return true;
    } catch (error) {
      setErrorMessage(
        error.message || "ไม่สามารถบันทึกรุ่นสินค้าได้",
      );

      return false;
    }
  }

  function handleEdit(product) {
    setShowCreateForm(false);
    setEditingProduct(product);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleCancelForm() {
    setEditingProduct(null);
    setShowCreateForm(false);
    setErrorMessage("");
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">รุ่นสินค้า</h1>

          <p className="page-description">
            จัดการข้อมูลแม่แบบของอุปกรณ์ เช่น ชื่อรุ่น ยี่ห้อ
            Part Number และหมวดหมู่
          </p>
        </div>

        {!formIsOpen && (
          <button
            type="button"
            className="button button-primary"
            onClick={handleOpenCreateForm}
          >
            + สร้างรุ่นสินค้า
          </button>
        )}
      </header>

      <FeedbackMessage type="error">
        {errorMessage}
      </FeedbackMessage>

      <FeedbackMessage type="success">
        {successMessage}
      </FeedbackMessage>

      {formIsOpen && (
        <ProductForm
          key={editingProduct?.id ?? "new"}
          editingProduct={editingProduct}
          onSubmit={handleSubmitProduct}
          onCancel={handleCancelForm}
        />
      )}

      {isLoading ? (
        <LoadingState message="กำลังโหลดรายการรุ่นสินค้า..." />
      ) : (
        <ProductTable
          products={products}
          onEdit={handleEdit}
        />
      )}
    </>
  );
}

export default ProductsPage;
