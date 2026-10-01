(() => {
  "use strict";

  const app = document.getElementById("app");
  const overlay = document.getElementById("overlay");
  const detail = document.getElementById("detail");
  const closeDrawerButton = document.getElementById("closeDrawer");
  const refreshButton = document.getElementById("refreshButton");
  const lastUpdated = document.getElementById("lastUpdated");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const connectionText = document.getElementById("connectionText");

  const STATUS = {
    IN_STOCK: "พร้อมใช้งาน",
    IN_USE: "กำลังใช้งาน",
    CLAIM: "อยู่ระหว่างเคลม",
    REPLACED: "เปลี่ยนทดแทนแล้ว",
    RETIRED: "ปลดระวาง",
  };

  const MOVEMENT = {
    RECEIVE: "รับเข้าระบบ",
    ISSUE: "เบิกไปใช้งาน",
    RETURN: "รับคืนเข้าคลัง",
    MOVE: "ย้ายตำแหน่ง",
    CLAIM: "ส่งเคลม",
    CLAIM_RETURN: "รับกลับจากเคลม",
    REPLACED: "เปลี่ยนทดแทน",
    RETIRE: "ปลดระวาง",
  };

  const state = {
    assets: {
      search: "",
      status: "",
      page: 1,
      limit: 20,
    },
    history: {
      page: 1,
      limit: 30,
    },
    routeRun: 0,
    lastFocused: null,
  };

  function el(tag, className = "", text = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = String(text);
    return node;
  }

  function fmt(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" } : {}),
    }).format(date);
  }

  function badge(status) {
    const value = STATUS[status] ? status : "UNKNOWN";
    return el("span", `status ${value}`, STATUS[status] || status || "ไม่ทราบสถานะ");
  }

  function setUpdated() {
    lastUpdated.textContent = `อัปเดตล่าสุด ${new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date())}`;
  }

  function setConnection(ok) {
    connectionText.textContent = ok ? "PUBLIC API ONLINE" : "PUBLIC API ERROR";
    connectionText.parentElement.classList.toggle("error", !ok);
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api/public${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.message || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.code = body?.code || "";
      throw error;
    }
    return body;
  }

  function setHeader(title, subtitle) {
    pageTitle.textContent = title;
    pageSubtitle.textContent = subtitle;
  }

  function loading(message = "กำลังโหลดข้อมูล…") {
    app.replaceChildren();
    const box = el("div", "state-box loading");
    const spinner = el("span", "spinner");
    box.append(spinner, el("span", "", message));
    app.append(box);
  }

  function errorView(error, retry) {
    setConnection(false);
    app.replaceChildren();
    const box = el("section", "state-box error");
    box.append(
      el("strong", "", "โหลดข้อมูลไม่สำเร็จ"),
      el("p", "", error?.message || "ไม่สามารถเชื่อมต่อ Public API ได้"),
    );
    if (retry) {
      const button = el("button", "button secondary", "ลองอีกครั้ง");
      button.type = "button";
      button.addEventListener("click", retry);
      box.append(button);
    }
    app.append(box);
  }

  function emptyState(message) {
    const box = el("div", "state-box empty");
    box.append(el("strong", "", message));
    return box;
  }

  function route() {
    const value = location.hash.replace(/^#/, "").split("?")[0];
    return ["overview", "assets", "history"].includes(value) ? value : "overview";
  }

  function syncNav() {
    const current = route();
    for (const link of document.querySelectorAll("[data-route]")) {
      const active = link.dataset.route === current;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function pager(meta, onPage) {
    const page = Number(meta?.page || 1);
    const totalPages = Math.max(1, Number(meta?.totalPages || 1));
    const total = Number(meta?.total || 0);

    const box = el("div", "pager");
    const info = el("span", "pager-info", `หน้า ${page} จาก ${totalPages} · ${total.toLocaleString("th-TH")} รายการ`);
    const actions = el("div", "pager-actions");

    const prev = el("button", "button secondary", "← ก่อนหน้า");
    prev.type = "button";
    prev.disabled = page <= 1;
    prev.addEventListener("click", () => onPage(page - 1));

    const next = el("button", "button secondary", "ถัดไป →");
    next.type = "button";
    next.disabled = page >= totalPages;
    next.addEventListener("click", () => onPage(page + 1));

    actions.append(prev, next);
    box.append(info, actions);
    return box;
  }

  function makeAssetRow(item, compact = false) {
    const row = el("tr", "clickable");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `เปิดรายละเอียด ${item.public_code || "อุปกรณ์"}`);

    const codeCell = el("td");
    codeCell.append(
      el("strong", "public-code", item.public_code || "—"),
      el("span", "sub", item.masked_serial || ""),
    );

    const productCell = el("td");
    productCell.append(el("strong", "", item.product_name || "—"));
    const meta = [item.brand, item.part_number, item.category].filter(Boolean).join(" · ");
    if (meta) productCell.append(el("span", "sub", meta));

    const statusCell = el("td");
    statusCell.append(badge(item.current_status));

    row.append(codeCell, productCell, statusCell);

    if (!compact) {
      row.append(el("td", "", fmt(item.received_date)));
    }

    row.append(el("td", "", fmt(item.last_activity_at, true)));

    const open = () => openDetail(item.asset_id, row);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    return row;
  }

  function assetTable(items, compact = false) {
    const wrap = el("div", "table-wrap");
    const table = el("table", "data-table");
    const head = el("thead");
    const hr = el("tr");

    const labels = compact
      ? ["รหัสสาธารณะ", "อุปกรณ์", "สถานะ", "ล่าสุด"]
      : ["รหัสสาธารณะ", "อุปกรณ์", "สถานะ", "วันที่รับเข้า", "ล่าสุด"];

    for (const label of labels) hr.append(el("th", "", label));
    head.append(hr);

    const body = el("tbody");
    for (const item of items) body.append(makeAssetRow(item, compact));

    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  function summaryCard(label, value, className, statusFilter = "") {
    const card = el("button", `summary-card ${className || ""}`.trim());
    card.type = "button";
    card.append(
      el("span", "summary-label", label),
      el("strong", "", Number(value || 0).toLocaleString("th-TH")),
      el("span", "summary-foot", statusFilter || "ทั้งหมด"),
    );
    card.addEventListener("click", () => {
      state.assets.status = statusFilter;
      state.assets.page = 1;
      location.hash = "assets";
    });
    return card;
  }

  async function renderOverview() {
    const run = ++state.routeRun;
    setHeader("ภาพรวมอุปกรณ์", "สถานะล่าสุดจาก Public API แบบอ่านอย่างเดียว");
    loading("กำลังโหลดภาพรวม…");

    try {
      const [summaryPayload, recentPayload] = await Promise.all([
        api("/summary"),
        api("/recent?limit=8"),
      ]);
      if (run !== state.routeRun || route() !== "overview") return;

      const summary = summaryPayload.data || {};
      const recent = Array.isArray(recentPayload.data) ? recentPayload.data : [];

      const content = document.createDocumentFragment();

      const intro = el("section", "hero-panel");
      const introText = el("div");
      introText.append(
        el("span", "section-kicker", "PUBLIC READ MODEL"),
        el("h2", "", "ตรวจสอบสถานะอุปกรณ์ได้โดยไม่เปิดสิทธิ์แก้ไข"),
        el("p", "", "ข้อมูลในหน้านี้ถูกจำกัดเฉพาะข้อมูลที่อนุญาตให้เปิดเผย และเชื่อมผ่าน Public API แบบ Read-only"),
      );
      intro.append(introText);
      content.append(intro);

      const grid = el("section", "summary-grid");
      grid.append(
        summaryCard("อุปกรณ์ทั้งหมด", summary.total, "total", ""),
        summaryCard("พร้อมใช้งาน", summary.in_stock, "stock", "IN_STOCK"),
        summaryCard("กำลังใช้งาน", summary.in_use, "use", "IN_USE"),
        summaryCard("อยู่ระหว่างเคลม", summary.claim, "claim", "CLAIM"),
        summaryCard("เปลี่ยนทดแทน", summary.replaced, "terminal", "REPLACED"),
        summaryCard("ปลดระวาง", summary.retired, "terminal", "RETIRED"),
      );
      content.append(grid);

      const panel = el("section", "panel");
      const heading = el("div", "panel-heading");
      const left = el("div");
      left.append(
        el("span", "section-kicker", "RECENTLY UPDATED"),
        el("h2", "", "อุปกรณ์ที่มีความเคลื่อนไหวล่าสุด"),
      );
      const all = el("a", "text-link", "ดูอุปกรณ์ทั้งหมด →");
      all.href = "#assets";
      heading.append(left, all);
      panel.append(heading);

      if (recent.length) panel.append(assetTable(recent, true));
      else panel.append(emptyState("ยังไม่มีข้อมูลอุปกรณ์"));

      content.append(panel);
      app.replaceChildren(content);
      setConnection(true);
      setUpdated();
    } catch (error) {
      if (run !== state.routeRun) return;
      errorView(error, renderOverview);
    }
  }

  async function renderAssets({ focusSearch = false } = {}) {
    const run = ++state.routeRun;
    setHeader("รายการอุปกรณ์", "ค้นหา กรองสถานะ และเปิดรายละเอียดอุปกรณ์แบบ Read-only");
    loading("กำลังโหลดรายการอุปกรณ์…");

    const params = new URLSearchParams({
      page: String(state.assets.page),
      limit: String(state.assets.limit),
    });
    if (state.assets.search) params.set("search", state.assets.search);
    if (state.assets.status) params.set("status", state.assets.status);

    try {
      const payload = await api(`/assets?${params.toString()}`);
      if (run !== state.routeRun || route() !== "assets") return;

      const items = Array.isArray(payload.data) ? payload.data : [];
      const meta = payload.meta || { page: 1, totalPages: 1, total: items.length };

      const toolbar = el("section", "filter-panel");

      const searchWrap = el("label", "filter-field search");
      searchWrap.append(el("span", "", "ค้นหา"));
      const search = el("input", "input");
      search.type = "search";
      search.placeholder = "รหัสสาธารณะ / Serial ที่ปิดบัง / รุ่น / Brand / Part Number";
      search.autocomplete = "off";
      search.value = state.assets.search;
      searchWrap.append(search);

      const statusWrap = el("label", "filter-field");
      statusWrap.append(el("span", "", "สถานะ"));
      const select = el("select", "select");
      [
        ["", "ทุกสถานะ"],
        ["IN_STOCK", "พร้อมใช้งาน"],
        ["IN_USE", "กำลังใช้งาน"],
        ["CLAIM", "อยู่ระหว่างเคลม"],
        ["REPLACED", "เปลี่ยนทดแทนแล้ว"],
        ["RETIRED", "ปลดระวาง"],
      ].forEach(([value, label]) => {
        const option = el("option", "", label);
        option.value = value;
        option.selected = value === state.assets.status;
        select.append(option);
      });
      statusWrap.append(select);

      const clear = el("button", "button secondary", "ล้างตัวกรอง");
      clear.type = "button";
      clear.disabled = !state.assets.search && !state.assets.status;

      const count = el("div", "filter-count", `${Number(meta.total || 0).toLocaleString("th-TH")} รายการ`);

      toolbar.append(searchWrap, statusWrap, clear, count);

      let timer = null;
      search.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.assets.search = search.value.trim();
          state.assets.page = 1;
          renderAssets({ focusSearch: true });
        }, 350);
      });

      select.addEventListener("change", () => {
        state.assets.status = select.value;
        state.assets.page = 1;
        renderAssets();
      });

      clear.addEventListener("click", () => {
        state.assets.search = "";
        state.assets.status = "";
        state.assets.page = 1;
        renderAssets({ focusSearch: true });
      });

      const panel = el("section", "panel");
      if (items.length) {
        panel.append(
          assetTable(items),
          pager(meta, (page) => {
            state.assets.page = page;
            renderAssets();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }),
        );
      } else {
        panel.append(emptyState("ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข"));
      }

      app.replaceChildren(toolbar, panel);
      setConnection(true);
      setUpdated();

      if (focusSearch) {
        requestAnimationFrame(() => {
          search.focus();
          const length = search.value.length;
          search.setSelectionRange(length, length);
        });
      }
    } catch (error) {
      if (run !== state.routeRun) return;
      errorView(error, () => renderAssets());
    }
  }

  function historyTable(items) {
    const wrap = el("div", "table-wrap");
    const table = el("table", "data-table");
    const head = el("thead");
    const hr = el("tr");
    ["วันเวลา", "รายการ", "รหัสสาธารณะ", "อุปกรณ์"].forEach((label) => hr.append(el("th", "", label)));
    head.append(hr);

    const body = el("tbody");
    for (const item of items) {
      const row = el("tr", item.asset_id ? "clickable" : "");
      if (item.asset_id) {
        row.tabIndex = 0;
        row.setAttribute("role", "button");
      }
      row.append(
        el("td", "", fmt(item.movement_date, true)),
        el("td", "", MOVEMENT[item.movement_type] || item.movement_type || "—"),
      );

      const code = el("td");
      code.append(
        el("strong", "public-code", item.public_code || "—"),
        el("span", "sub", item.masked_serial || ""),
      );
      row.append(code, el("td", "", item.product_name || "—"));

      if (item.asset_id) {
        const open = () => openDetail(item.asset_id, row);
        row.addEventListener("click", open);
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      }
      body.append(row);
    }

    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  async function renderHistory() {
    const run = ++state.routeRun;
    setHeader("ประวัติการเคลื่อนไหว", "เหตุการณ์ย้อนหลังที่อนุญาตให้แสดงใน Public Viewer");
    loading("กำลังโหลดประวัติ…");

    try {
      const payload = await api(`/history?page=${state.history.page}&limit=${state.history.limit}`);
      if (run !== state.routeRun || route() !== "history") return;

      const items = Array.isArray(payload.data) ? payload.data : [];
      const meta = payload.meta || { page: 1, totalPages: 1, total: items.length };
      const panel = el("section", "panel");

      const heading = el("div", "panel-heading");
      const left = el("div");
      left.append(
        el("span", "section-kicker", "PUBLIC HISTORY"),
        el("h2", "", "ประวัติอุปกรณ์"),
        el("p", "muted", "ไม่เปิดเผยผู้ปฏิบัติงาน โครงการ หรือข้อมูลภายใน"),
      );
      heading.append(left);
      panel.append(heading);

      if (items.length) {
        panel.append(
          historyTable(items),
          pager(meta, (page) => {
            state.history.page = page;
            renderHistory();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }),
        );
      } else {
        panel.append(emptyState("ยังไม่มีประวัติการเคลื่อนไหว"));
      }

      app.replaceChildren(panel);
      setConnection(true);
      setUpdated();
    } catch (error) {
      if (run !== state.routeRun) return;
      errorView(error, renderHistory);
    }
  }

  function field(label, value) {
    const box = el("div", "detail-field");
    box.append(el("span", "detail-label", label));
    if (value instanceof Node) box.append(value);
    else box.append(el("strong", "", value || "—"));
    return box;
  }

  async function openDetail(id, sourceElement = null) {
    if (!id) return;
    state.lastFocused = sourceElement || document.activeElement;

    overlay.hidden = false;
    document.body.classList.add("drawer-open");
    detail.replaceChildren(loadingNode("กำลังโหลดรายละเอียด…"));
    closeDrawerButton.focus();

    try {
      const [assetPayload, historyPayload] = await Promise.all([
        api(`/assets/${encodeURIComponent(id)}`),
        api(`/assets/${encodeURIComponent(id)}/history`),
      ]);

      const asset = assetPayload.data || {};
      const history = Array.isArray(historyPayload.data) ? historyPayload.data : [];

      const header = el("section", "detail-summary");
      header.append(
        el("div", "public-code large", asset.public_code || "—"),
        el("h3", "", asset.product_name || "ไม่ระบุอุปกรณ์"),
        el("p", "muted", [asset.brand, asset.part_number, asset.category].filter(Boolean).join(" · ") || "—"),
      );

      const grid = el("section", "detail-grid");
      grid.append(
        field("สถานะ", badge(asset.current_status)),
        field("Serial", asset.masked_serial),
        field("วันที่รับเข้า", fmt(asset.received_date)),
        field("ความเคลื่อนไหวล่าสุด", fmt(asset.last_activity_at, true)),
      );

      const historySection = el("section", "detail-history");
      historySection.append(el("h3", "", "ประวัติการเคลื่อนไหว"));
      const timeline = el("ol", "timeline");

      for (const movement of history) {
        const item = el("li");
        item.append(
          el("strong", "", MOVEMENT[movement.movement_type] || movement.movement_type || "เหตุการณ์"),
          el("span", "", fmt(movement.movement_date, true)),
        );
        timeline.append(item);
      }
      if (!history.length) timeline.append(el("li", "empty-timeline", "ยังไม่มีประวัติ"));
      historySection.append(timeline);

      detail.replaceChildren(header, grid, historySection);
    } catch (error) {
      detail.replaceChildren();
      const box = el("div", "state-box error");
      box.append(
        el("strong", "", "โหลดรายละเอียดไม่สำเร็จ"),
        el("p", "", error?.message || "ไม่สามารถโหลดรายละเอียดได้"),
      );
      detail.append(box);
    }
  }

  function loadingNode(message) {
    const box = el("div", "state-box loading");
    box.append(el("span", "spinner"), el("span", "", message));
    return box;
  }

  function closeDetail() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("drawer-open");
    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
    }
    state.lastFocused = null;
  }

  function renderRoute() {
    syncNav();
    window.scrollTo({ top: 0, behavior: "auto" });
    const current = route();

    if (current === "assets") return renderAssets();
    if (current === "history") return renderHistory();
    return renderOverview();
  }

  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    const old = refreshButton.textContent;
    refreshButton.textContent = "กำลังรีเฟรช…";
    try {
      await renderRoute();
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = old;
    }
  });

  closeDrawerButton.addEventListener("click", closeDetail);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDetail();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeDetail();
  });

  window.addEventListener("hashchange", renderRoute);

  if (!location.hash || !["#overview", "#assets", "#history"].includes(location.hash)) {
    location.hash = "overview";
  } else {
    renderRoute();
  }
})();
