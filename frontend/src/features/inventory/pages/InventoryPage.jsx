import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createInventoryItem, getInventoryItems } from "../api/inventoryApi";

import { getProducts, createProduct } from "../../products/api/productApi";

import InventoryForm from "../components/InventoryForm";
import InventoryTable from "../components/InventoryTable";

function InventoryPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);

  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        const [inventoryData, productData] = await Promise.all([
          getInventoryItems(),
          getProducts(),
        ]);

        if (cancelled) {
          return;
        }

        setItems(inventoryData);
        setProducts(productData);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ไม่สามารถโหลดข้อมูลได้");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleView(item) {
    navigate(`/inventory/${item.id}`);
  }

  function handleOpenForm() {
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function handleCancelForm() {
    setShowForm(false);
  }

  async function handleCreate(payload) {
    setCreating(true);
    setError("");
    setSuccessMessage("");

    try {
      let productId = payload.productId;
      let createdNewProduct = false;

      if (payload.productMode === "new") {
        const productResult = await createProduct(payload.product);

        productId = productResult?.data?.id;

        if (!productId) {
          throw new Error("สร้างสินค้าแล้ว แต่ไม่ได้รับ Product ID");
        }

        createdNewProduct = true;
      }

      await createInventoryItem({
        ...payload.inventory,
        productId,
      });

      const [refreshedItems, refreshedProducts] = await Promise.all([
        getInventoryItems(),
        getProducts(),
      ]);

      setItems(refreshedItems);
      setProducts(refreshedProducts);

      setShowForm(false);

      setSuccessMessage(
        createdNewProduct
          ? "สร้างสินค้าและเพิ่มอุปกรณ์เรียบร้อย"
          : "เพิ่มอุปกรณ์เรียบร้อย",
      );
    } catch (err) {
      setError(err.message || "ไม่สามารถเพิ่มอุปกรณ์ได้");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>

          <p className="text-muted">จัดการอุปกรณ์และ Serial Number</p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={handleOpenForm}
          disabled={showForm}
        >
          + เพิ่มอุปกรณ์
        </button>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {successMessage && (
        <div className="message message-success">{successMessage}</div>
      )}

      {showForm && (
        <InventoryForm
          products={products}
          loading={creating}
          onSubmit={handleCreate}
          onCancel={handleCancelForm}
        />
      )}

      {loading ? (
        <div className="card">กำลังโหลดข้อมูล...</div>
      ) : (
        <InventoryTable items={items} onView={handleView} />
      )}
    </>
  );
}

export default InventoryPage;
