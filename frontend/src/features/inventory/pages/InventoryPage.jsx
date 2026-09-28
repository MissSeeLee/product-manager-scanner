import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  createInventoryItem,
  getInventoryFilterOptions,
  getInventoryItems,
} from "../api/inventoryApi";
import { createProduct, getProducts } from "../../products/api/productApi";

import AssetExplorerToolbar from "../components/AssetExplorerToolbar";
import BulkSelectionBar from "../components/BulkSelectionBar";
import CsvImportPanel from "../components/CsvImportPanel";
import InventoryForm from "../components/InventoryForm";
import InventoryTable from "../components/InventoryTable";
import QuickBatchForm from "../components/QuickBatchForm";

import {
  FeedbackMessage,
  LoadingState,
} from "../../../shared/components/PageState";

const PAGE_SIZE = 50;

function queryFromSearchParams(searchParams) {
  return {
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    productId: searchParams.get("productId") || "",
    location: searchParams.get("location") || "",
    brand: searchParams.get("brand") || "",
    partNumber: searchParams.get("partNumber") || "",
    serialPrefix: searchParams.get("serialPrefix") || "",
    receivedFrom: searchParams.get("receivedFrom") || "",
    receivedTo: searchParams.get("receivedTo") || "",
    warranty: searchParams.get("warranty") || "all",
    returnDue: searchParams.get("returnDue") || "",
    sort: searchParams.get("sort") || "created_at",
    order: searchParams.get("order") || "desc",
    page: Math.max(1, Number(searchParams.get("page") || 1) || 1),
  };
}

function apiParamsFromQuery(query) {
  return {
    search: query.search,
    status: query.status,
    productId: query.productId,
    location: query.location,
    brand: query.brand,
    partNumber: query.partNumber,
    serialPrefix: query.serialPrefix,
    receivedFrom: query.receivedFrom,
    receivedTo: query.receivedTo,
    warranty: query.warranty === "all" ? "" : query.warranty,
    returnDue: query.returnDue,
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    sort: query.sort,
    order: query.order,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
  };
}

function hasActiveFilters(query) {
  return Boolean(
    query.search ||
      query.status ||
      query.productId ||
      query.location ||
      query.brand ||
      query.partNumber ||
      query.serialPrefix ||
      query.receivedFrom ||
      query.receivedTo ||
      (query.warranty && query.warranty !== "all") ||
      query.returnDue,
  );
}

function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const query = useMemo(
    () => queryFromSearchParams(new URLSearchParams(queryKey)),
    [queryKey],
  );

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    overallTotal: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });

  const [products, setProducts] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    statuses: [],
    locations: [],
    brands: [],
  });

  const [intakeMode, setIntakeMode] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const selectionKey = `${queryKey}::${reloadVersion}`;
  const [selectionState, setSelectionState] = useState(() => ({
    key: selectionKey,
    ids: [],
  }));

  const selectedIds =
    selectionState.key === selectionKey ? selectionState.ids : [];

  function setSelectedIds(nextValue) {
    setSelectionState((current) => {
      const currentIds =
        current.key === selectionKey ? current.ids : [];

      const nextIds =
        typeof nextValue === "function"
          ? nextValue(currentIds)
          : nextValue;

      return {
        key: selectionKey,
        ids: nextIds,
      };
    });
  }

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      try {
        const [productData, optionsData] = await Promise.all([
          getProducts(),
          getInventoryFilterOptions(),
        ]);

        if (!cancelled) {
          setProducts(productData);
          setFilterOptions(optionsData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดข้อมูลตัวกรองได้");
        }
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setError("");

      try {
        const currentQuery = queryFromSearchParams(new URLSearchParams(queryKey));
        const result = await getInventoryItems(apiParamsFromQuery(currentQuery));

        if (!cancelled) {
          setItems(Array.isArray(result?.data) ? result.data : []);
          setMeta(result?.meta ?? {
            total: 0,
            overallTotal: 0,
            limit: PAGE_SIZE,
            offset: 0,
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดรายการอุปกรณ์ได้");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadVersion]);


  function updateQuery(patch) {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }

    if (!("page" in patch)) {
      next.delete("page");
    }

    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();

    if (query.sort !== "created_at") {
      next.set("sort", query.sort);
    }

    if (query.order !== "desc") {
      next.set("order", query.order);
    }

    setSearchParams(next);
  }

  function handleSort(field) {
    if (query.sort === field) {
      updateQuery({
        sort: field,
        order: query.order === "asc" ? "desc" : "asc",
      });
      return;
    }

    updateQuery({
      sort: field,
      order: field === "received_at" || field === "warranty_end" ? "desc" : "asc",
    });
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
          throw new Error("สร้างรุ่นสินค้าแล้ว แต่ไม่ได้รับ Product ID");
        }

        createdNewProduct = true;
      }

      await createInventoryItem({
        ...payload.inventory,
        productId,
      });

      setIntakeMode(null);
      setSuccessMessage(
        createdNewProduct
          ? "สร้างรุ่นสินค้าและลงทะเบียนอุปกรณ์เรียบร้อย"
          : "ลงทะเบียนอุปกรณ์เรียบร้อย",
      );
      setReloadVersion((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "ไม่สามารถลงทะเบียนอุปกรณ์ได้");
    } finally {
      setCreating(false);
    }
  }

  function handleBulkDone(response) {
    setIntakeMode(null);
    setSuccessMessage(response?.message || "นำข้อมูลอุปกรณ์เข้าระบบเรียบร้อย");
    setReloadVersion((value) => value + 1);
  }

  function handleToggleSelect(item) {
    const id = Number(item.id);

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function handleToggleSelectAll(selectableItems) {
    const ids = selectableItems.map((item) => Number(item.id));
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));

    setSelectedIds(allSelected ? [] : ids);
  }

  function openBulkOperation(type) {
    if (selectedIds.length === 0) {
      return;
    }

    const selectedAssetsForOperation = items.filter((item) =>
      selectedIds.includes(Number(item.id)),
    );

    sessionStorage.setItem(
      "assetops.pending-operation-selection.v6",
      JSON.stringify({
        version: 1,
        type,
        assetIds: selectedIds,
        selectedAssets: selectedAssetsForOperation,
        createdAt: Date.now(),
      }),
    );

    navigate(`/operations/new?type=${type}&assetIds=${encodeURIComponent(selectedIds.join(","))}`, {
      state: { assetIds: selectedIds },
    });
  }

  const selectedItems = items.filter((item) => selectedIds.includes(Number(item.id)));
  const canIssue =
    selectedItems.length > 0 &&
    selectedItems.every((item) => item.current_status === "IN_STOCK");
  const canReturn =
    selectedItems.length > 0 &&
    selectedItems.every((item) => item.current_status === "IN_USE");
  const canMove =
    selectedItems.length > 0 &&
    selectedItems.every((item) => ["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status));

  const filtered = hasActiveFilters(query);
  const pageCount = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const firstItem = meta.total === 0 ? 0 : meta.offset + 1;
  const lastItem = Math.min(meta.offset + items.length, meta.total);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">รายการอุปกรณ์</h1>
          <p className="page-description">
            ค้นหา ตรวจสอบสถานะ และจัดการอุปกรณ์จริงราย Serial Number
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setIntakeMode((current) => (current ? null : "choose"))}
        >
          {intakeMode ? "← กลับรายการอุปกรณ์" : "+ นำอุปกรณ์เข้าระบบ"}
        </button>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>
      <FeedbackMessage type="success">{successMessage}</FeedbackMessage>

      {intakeMode === "choose" && (
        <section className="card intake-chooser">
          <button type="button" className="intake-choice" onClick={() => setIntakeMode("single")}>
            <strong>ลงทะเบียน 1 อุปกรณ์</strong>
            <span>สำหรับอุปกรณ์หนึ่งชิ้นและ Serial เดียว</span>
          </button>

          <button type="button" className="intake-choice" onClick={() => setIntakeMode("batch")}>
            <strong>ลงทะเบียนหลาย Serial</strong>
            <span>รุ่นเดียวกัน ข้อมูลรับเข้าเหมือนกัน แต่ Serial ต่างกัน</span>
          </button>

          <button type="button" className="intake-choice" onClick={() => setIntakeMode("csv")}>
            <strong>นำเข้าจาก CSV</strong>
            <span>สำหรับข้อมูลเดิมหลายรุ่น หลายตำแหน่ง และหลายวันที่รับเข้า</span>
          </button>
        </section>
      )}

      {intakeMode === "single" && (
        <InventoryForm
          products={products}
          loading={creating}
          onSubmit={handleCreate}
          onCancel={() => setIntakeMode(null)}
        />
      )}

      {intakeMode === "batch" && (
        <QuickBatchForm
          products={products}
          onDone={handleBulkDone}
          onCancel={() => setIntakeMode(null)}
        />
      )}

      {intakeMode === "csv" && (
        <CsvImportPanel
          onDone={handleBulkDone}
          onCancel={() => setIntakeMode(null)}
        />
      )}

      {!intakeMode && (
        <>
          <AssetExplorerToolbar
            query={query}
            products={products}
            filterOptions={filterOptions}
            onChange={updateQuery}
            onClear={clearFilters}
          />

          <div className="explorer-result-bar">
            <div>
              <strong>
                {filtered
                  ? `${meta.total} จาก ${meta.overallTotal} อุปกรณ์`
                  : `${meta.total} อุปกรณ์`}
              </strong>
              {filtered && <span>ผลลัพธ์ตามคำค้นหาและตัวกรองปัจจุบัน</span>}
            </div>

            <label className="mobile-sort-control">
              <span>เรียงตาม</span>
              <select
                value={`${query.sort}:${query.order}`}
                onChange={(event) => {
                  const [sort, order] = event.target.value.split(":");
                  updateQuery({ sort, order });
                }}
              >
                <option value="created_at:desc">เพิ่มเข้าระบบล่าสุด</option>
                <option value="serial_number:asc">Serial A–Z</option>
                <option value="serial_number:desc">Serial Z–A</option>
                <option value="received_at:desc">รับเข้าล่าสุด</option>
                <option value="received_at:asc">รับเข้าเก่าสุด</option>
                <option value="warranty_end:asc">ประกันใกล้หมดก่อน</option>
              </select>
            </label>
          </div>

          {loading ? (
            <LoadingState message="กำลังค้นหาอุปกรณ์..." />
          ) : (
            <InventoryTable
              items={items}
              query={query}
              onSort={handleSort}
              hasFilters={filtered}
              onClearFilters={clearFilters}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
            />
          )}

          {!loading && meta.total > 0 && (
            <nav className="pagination-bar" aria-label="เปลี่ยนหน้ารายการอุปกรณ์">
              <span>
                {firstItem}–{lastItem} จาก {meta.total}
              </span>

              <div className="pagination-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={query.page <= 1}
                  onClick={() => updateQuery({ page: query.page - 1 })}
                >
                  ก่อนหน้า
                </button>

                <span>หน้า {query.page} / {pageCount}</span>

                <button
                  type="button"
                  className="button button-secondary"
                  disabled={query.page >= pageCount}
                  onClick={() => updateQuery({ page: query.page + 1 })}
                >
                  ถัดไป
                </button>
              </div>
            </nav>
          )}

          <BulkSelectionBar
            count={selectedIds.length}
            canIssue={canIssue}
            canReturn={canReturn}
            canMove={canMove}
            onIssue={() => openBulkOperation("ISSUE")}
            onReturn={() => openBulkOperation("RETURN")}
            onMove={() => openBulkOperation("MOVE")}
            onClear={() => setSelectedIds([])}
          />
        </>
      )}
    </>
  );
}

export default InventoryPage;
