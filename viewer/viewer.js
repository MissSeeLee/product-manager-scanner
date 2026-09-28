(() => {
  "use strict";

  const state = {
    assets: [],
    history: [],
    recent: [],
    summary: {},
    search: "",
    status: "",
    location: "",
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    refreshButton: $("refreshButton"),
    lastUpdated: $("lastUpdated"),
    kpiTotal: $("kpiTotal"),
    kpiStock: $("kpiStock"),
    kpiUse: $("kpiUse"),
    kpiClaim: $("kpiClaim"),
    kpiTerminal: $("kpiTerminal"),
    resultMeta: $("resultMeta"),
    searchInput: $("searchInput"),
    statusFilter: $("statusFilter"),
    locationFilter: $("locationFilter"),
    clearFilters: $("clearFilters"),
    loadingState: $("loadingState"),
    errorState: $("errorState"),
    tableWrap: $("tableWrap"),
    emptyState: $("emptyState"),
    assetTableBody: $("assetTableBody"),
    recentList: $("recentList"),
    drawerBackdrop: $("drawerBackdrop"),
    detailDrawer: $("detailDrawer"),
    drawerSerial: $("drawerSerial"),
    drawerContent: $("drawerContent"),
    drawerHistory: $("drawerHistory"),
    closeDrawer: $("closeDrawer"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstValue(object, names, fallback = "") {
    if (!object || typeof object !== "object") return fallback;

    for (const name of names) {
      const value = object[name];

      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }

    return fallback;
  }

  function unwrap(payload, collectionNames = []) {
    let value = payload;

    if (value && typeof value === "object" && "data" in value) {
      value = value.data;
    }

    if (Array.isArray(value)) return value;

    if (value && typeof value === "object") {
      for (const key of collectionNames) {
        if (Array.isArray(value[key])) return value[key];
      }
    }

    return value;
  }

  async function getJson(path) {
    const response = await fetch(path, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${path} → HTTP ${response.status}`);
    }

    return response.json();
  }

  function normalizeAsset(raw) {
    return {
      raw,
      id: firstValue(raw, ["id", "inventory_item_id", "inventoryItemId"], ""),
      serial: String(firstValue(raw, ["serial_number", "serialNumber", "serial"], "—")),
      name: String(firstValue(raw, ["product_name", "productName", "model_name", "modelName", "name"], "ไม่ระบุรุ่น")),
      brand: String(firstValue(raw, ["brand", "manufacturer"], "—")),
      partNumber: String(firstValue(raw, ["part_number", "partNumber", "sku"], "")),
      status: String(firstValue(raw, ["current_status", "status"], "UNKNOWN")).toUpperCase(),
      location: String(firstValue(raw, ["current_location", "location"], "ไม่ระบุตำแหน่ง")),
      responsible: String(firstValue(raw, ["current_responsible_person", "responsible_person", "responsiblePerson"], "")),
      project: String(firstValue(raw, ["project_name", "projectName", "project_code", "projectCode"], "")),
      expectedReturn: firstValue(raw, ["expected_return_date", "expectedReturnDate"], ""),
      warrantyEnd: firstValue(raw, ["warranty_end", "warrantyEnd"], ""),
      receivedDate: firstValue(raw, ["received_date", "receivedDate"], ""),
    };
  }

  function normalizeMovement(raw) {
    return {
      raw,
      id: firstValue(raw, ["id", "movement_id", "movementId"], ""),
      assetId: firstValue(raw, ["inventory_item_id", "inventoryItemId", "asset_id", "assetId"], ""),
      serial: String(firstValue(raw, ["serial_number", "serialNumber", "serial"], "")),
      type: String(firstValue(raw, ["movement_type", "movementType", "type", "operation_type"], "EVENT")).toUpperCase(),
      date: firstValue(raw, ["movement_date", "movementDate", "created_at", "createdAt", "operation_date"], ""),
      from: String(firstValue(raw, ["from_location", "fromLocation"], "")),
      to: String(firstValue(raw, ["to_location", "toLocation"], "")),
      note: String(firstValue(raw, ["note", "notes"], "")),
      operationCode: String(firstValue(raw, ["operation_code", "operationCode", "reference_code", "referenceCode"], "")),
    };
  }

  function formatDate(value, withTime = false) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" } : {}),
    }).format(date);
  }

  function statusLabel(status) {
    const map = {
      IN_STOCK: "พร้อมใช้งาน",
      IN_USE: "กำลังใช้งาน",
      CLAIM: "เคลม",
      REPLACED: "เปลี่ยนทดแทน",
      RETIRED: "ปลดระวาง",
      UNKNOWN: "ไม่ทราบสถานะ",
    };

    return map[status] || status;
  }

  function movementLabel(type) {
    const map = {
      RECEIVE: "รับเข้า",
      ISSUE: "เบิก",
      RETURN: "คืน",
      MOVE: "ย้าย",
      CLAIM: "ส่งเคลม",
      CLAIM_RETURN: "รับกลับจากเคลม",
      REPLACED: "เปลี่ยนทดแทน",
      RETIRE: "ปลดระวาง",
    };

    return map[type] || type;
  }

  function statusBadge(status) {
    const safe = ["IN_STOCK", "IN_USE", "CLAIM", "REPLACED", "RETIRED"].includes(status)
      ? status
      : "UNKNOWN";

    return `<span class="status ${safe}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function computeCounts() {
    const counts = {
      total: state.assets.length,
      IN_STOCK: 0,
      IN_USE: 0,
      CLAIM: 0,
      REPLACED: 0,
      RETIRED: 0,
    };

    for (const asset of state.assets) {
      if (asset.status in counts) counts[asset.status] += 1;
    }

    return counts;
  }

  function renderKpis() {
    const counts = computeCounts();

    els.kpiTotal.textContent = counts.total.toLocaleString("th-TH");
    els.kpiStock.textContent = counts.IN_STOCK.toLocaleString("th-TH");
    els.kpiUse.textContent = counts.IN_USE.toLocaleString("th-TH");
    els.kpiClaim.textContent = counts.CLAIM.toLocaleString("th-TH");
    els.kpiTerminal.textContent = (counts.REPLACED + counts.RETIRED).toLocaleString("th-TH");
  }

  function sortedUnique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), "th")
    );
  }

  function buildFilters() {
    const currentStatus = els.statusFilter.value;
    const currentLocation = els.locationFilter.value;

    const statuses = sortedUnique(state.assets.map((item) => item.status));
    const locations = sortedUnique(state.assets.map((item) => item.location));

    els.statusFilter.innerHTML =
      `<option value="">ทุกสถานะ</option>` +
      statuses
        .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</option>`)
        .join("");

    els.locationFilter.innerHTML =
      `<option value="">ทุกตำแหน่ง</option>` +
      locations
        .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`)
        .join("");

    if (statuses.includes(currentStatus)) els.statusFilter.value = currentStatus;
    if (locations.includes(currentLocation)) els.locationFilter.value = currentLocation;
  }

  function filteredAssets() {
    const query = state.search.trim().toLowerCase();

    return state.assets.filter((asset) => {
      const searchable = [
        asset.serial,
        asset.name,
        asset.brand,
        asset.partNumber,
        asset.location,
        asset.project,
        asset.responsible,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = !state.status || asset.status === state.status;
      const matchesLocation = !state.location || asset.location === state.location;

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }

  function renderTable() {
    const items = filteredAssets();

    els.resultMeta.textContent =
      `แสดง ${items.length.toLocaleString("th-TH")} จาก ${state.assets.length.toLocaleString("th-TH")} รายการ`;

    els.assetTableBody.innerHTML = items
      .map(
        (asset) => `
          <tr data-asset-id="${escapeHtml(asset.id)}" data-serial="${escapeHtml(asset.serial)}">
            <td><span class="serial">${escapeHtml(asset.serial)}</span></td>
            <td>
              <div class="model-main">${escapeHtml(asset.name)}</div>
              ${asset.partNumber ? `<div class="model-sub">${escapeHtml(asset.partNumber)}</div>` : ""}
            </td>
            <td>${escapeHtml(asset.brand)}</td>
            <td>${statusBadge(asset.status)}</td>
            <td>${escapeHtml(asset.location)}</td>
            <td>${escapeHtml(formatDate(asset.expectedReturn))}</td>
          </tr>
        `
      )
      .join("");

    els.tableWrap.classList.toggle("hidden", items.length === 0);
    els.emptyState.classList.toggle("hidden", items.length !== 0);

    for (const row of els.assetTableBody.querySelectorAll("tr")) {
      row.addEventListener("click", () => {
        const id = row.dataset.assetId;
        const serial = row.dataset.serial;
        const asset =
          state.assets.find((item) => String(item.id) === String(id)) ||
          state.assets.find((item) => item.serial === serial);

        if (asset) openDrawer(asset);
      });
    }
  }

  function renderRecent() {
    const items = (state.recent.length ? state.recent : state.history).slice(0, 12);

    if (!items.length) {
      els.recentList.innerHTML = `<div class="state-box slim">ยังไม่มีประวัติการเคลื่อนไหว</div>`;
      return;
    }

    els.recentList.innerHTML = items
      .map((event) => {
        const route = [event.from, event.to].filter(Boolean).join(" → ");

        return `
          <div class="activity-item">
            <span class="activity-dot"></span>
            <div>
              <div class="activity-title">
                ${escapeHtml(movementLabel(event.type))}
                ${event.serial ? ` · <span class="serial">${escapeHtml(event.serial)}</span>` : ""}
              </div>
              <div class="activity-meta">${escapeHtml(formatDate(event.date, true))}</div>
              ${route ? `<div class="activity-route">${escapeHtml(route)}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function detailField(label, value, full = false) {
    return `
      <div class="detail-field${full ? " full" : ""}">
        <span class="detail-label">${escapeHtml(label)}</span>
        <div class="detail-value">${escapeHtml(value || "—")}</div>
      </div>
    `;
  }

  function matchingHistory(asset) {
    return state.history
      .filter((event) => {
        if (event.serial && asset.serial && event.serial === asset.serial) return true;
        if (event.assetId !== "" && asset.id !== "" && String(event.assetId) === String(asset.id)) return true;
        return false;
      })
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
  }

  function openDrawer(asset) {
    els.drawerSerial.textContent = asset.serial;

    els.drawerContent.innerHTML = [
      detailField("รุ่น / อุปกรณ์", asset.name, true),
      detailField("Brand", asset.brand),
      detailField("Part Number", asset.partNumber),
      detailField("สถานะ", statusLabel(asset.status)),
      detailField("ตำแหน่ง", asset.location),
      detailField("โครงการ / งาน", asset.project),
      detailField("ผู้รับผิดชอบ", asset.responsible),
      detailField("กำหนดคืน", formatDate(asset.expectedReturn)),
      detailField("สิ้นสุดประกัน", formatDate(asset.warrantyEnd)),
      detailField("วันที่รับเข้า", formatDate(asset.receivedDate)),
    ].join("");

    const history = matchingHistory(asset);

    els.drawerHistory.innerHTML = history.length
      ? history
          .map((event) => {
            const route = [event.from, event.to].filter(Boolean).join(" → ");

            return `
              <div class="history-item">
                <div class="history-type">${escapeHtml(movementLabel(event.type))}</div>
                <div class="history-meta">
                  ${escapeHtml(formatDate(event.date, true))}
                  ${event.operationCode ? ` · ${escapeHtml(event.operationCode)}` : ""}
                </div>
                ${route ? `<div class="history-note">${escapeHtml(route)}</div>` : ""}
                ${event.note ? `<div class="history-note">${escapeHtml(event.note)}</div>` : ""}
              </div>
            `;
          })
          .join("")
      : `<div class="state-box slim">ไม่พบประวัติสำหรับอุปกรณ์นี้ใน Public Viewer</div>`;

    els.drawerBackdrop.classList.remove("hidden");
    els.detailDrawer.classList.add("open");
    els.detailDrawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    els.drawerBackdrop.classList.add("hidden");
    els.detailDrawer.classList.remove("open");
    els.detailDrawer.setAttribute("aria-hidden", "true");
  }

  async function loadAll() {
    els.loadingState.classList.remove("hidden");
    els.errorState.classList.add("hidden");
    els.refreshButton.disabled = true;
    els.refreshButton.textContent = "กำลังรีเฟรช…";

    try {
      const [summaryPayload, assetsPayload, historyPayload, recentPayload] =
        await Promise.all([
          getJson("/api/public/summary"),
          getJson("/api/public/assets"),
          getJson("/api/public/history"),
          getJson("/api/public/recent"),
        ]);

      const assetRows = unwrap(assetsPayload, ["assets", "items", "results", "rows"]);
      const historyRows = unwrap(historyPayload, ["history", "movements", "items", "results", "rows"]);
      const recentRows = unwrap(recentPayload, ["recent", "history", "movements", "items", "results", "rows"]);
      const summary = unwrap(summaryPayload, ["summary"]);

      state.assets = (Array.isArray(assetRows) ? assetRows : []).map(normalizeAsset);
      state.history = (Array.isArray(historyRows) ? historyRows : []).map(normalizeMovement);
      state.recent = (Array.isArray(recentRows) ? recentRows : []).map(normalizeMovement);
      state.summary = summary && typeof summary === "object" ? summary : {};

      renderKpis();
      buildFilters();
      renderTable();
      renderRecent();

      els.loadingState.classList.add("hidden");
      els.lastUpdated.textContent =
        `อัปเดตล่าสุด ${new Intl.DateTimeFormat("th-TH", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(new Date())}`;
    } catch (error) {
      els.loadingState.classList.add("hidden");
      els.tableWrap.classList.add("hidden");
      els.emptyState.classList.add("hidden");
      els.errorState.textContent =
        `โหลดข้อมูล Public Viewer ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`;
      els.errorState.classList.remove("hidden");
      els.lastUpdated.textContent = "เชื่อมต่อข้อมูลไม่สำเร็จ";
    } finally {
      els.refreshButton.disabled = false;
      els.refreshButton.textContent = "รีเฟรชข้อมูล";
    }
  }

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderTable();
  });

  els.statusFilter.addEventListener("change", (event) => {
    state.status = event.target.value;
    renderTable();
  });

  els.locationFilter.addEventListener("change", (event) => {
    state.location = event.target.value;
    renderTable();
  });

  els.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.status = "";
    state.location = "";
    els.searchInput.value = "";
    els.statusFilter.value = "";
    els.locationFilter.value = "";
    renderTable();
  });

  els.refreshButton.addEventListener("click", loadAll);
  els.closeDrawer.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  loadAll();
})();
