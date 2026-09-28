const app = document.querySelector("#app");
const overlay = document.querySelector("#overlay");
const detail = document.querySelector("#detail");
const closeButton = document.querySelector("#close");

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
  CLAIM_RETURN: "รับคืนจากเคลม",
  REPLACED: "เปลี่ยนทดแทน",
  RETIRE: "ปลดระวาง",
};

const state = {
  assets: { search: "", status: "", page: 1 },
  history: { page: 1 },
};

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function fmt(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function badge(status) {
  return el("span", `status ${status}`, STATUS[status] || status || "-");
}

async function api(path) {
  const response = await fetch(`/api/public${path}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "ไม่สามารถโหลดข้อมูลได้");
  return body;
}

function heading(title, subtitle) {
  const box = el("div", "heading");
  const left = el("div");
  left.append(el("h1", "", title), el("p", "", subtitle));
  box.append(
    left,
    el("span", "updated", `อัปเดตเมื่อ ${fmt(new Date(), true)}`),
  );
  return box;
}

function loading() {
  app.replaceChildren(el("div", "loading", "กำลังโหลดข้อมูล..."));
}

function errorView(error) {
  app.replaceChildren(el("div", "error", error.message));
}

function td(text) {
  return el("td", "", text);
}

function assetTable(items) {
  const wrap = el("div", "tablewrap");
  const table = el("table", "table");
  const head = el("thead");
  const hr = el("tr");
  ["รหัส", "อุปกรณ์", "สถานะ", "ล่าสุด"].forEach((x) => hr.append(el("th", "", x)));
  head.append(hr);

  const body = el("tbody");
  if (!items.length) {
    const row = el("tr");
    const cell = el("td", "empty", "ไม่พบอุปกรณ์");
    cell.colSpan = 4;
    row.append(cell);
    body.append(row);
  }

  for (const item of items) {
    const row = el("tr", "clickable");
    row.tabIndex = 0;

    const code = el("td");
    code.append(
      el("span", "code", item.public_code),
      el("span", "sub", item.masked_serial || ""),
    );

    const product = el("td");
    product.append(el("strong", "", item.product_name || "-"));
    const meta = [item.brand, item.part_number].filter(Boolean).join(" · ");
    if (meta) product.append(el("span", "sub", meta));

    const status = el("td");
    status.append(badge(item.current_status));

    row.append(code, product, status, td(fmt(item.last_activity_at, true)));

    const open = () => openDetail(item.asset_id);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function pager(page, totalPages, onPage) {
  const box = el("div", "pager");
  const prev = el("button", "", "←");
  const next = el("button", "", "→");
  prev.type = next.type = "button";
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
  prev.addEventListener("click", () => onPage(page - 1));
  next.addEventListener("click", () => onPage(page + 1));
  box.append(prev, el("span", "", `หน้า ${page} จาก ${totalPages}`), next);
  return box;
}

async function renderOverview() {
  loading();
  try {
    const [summary, recent] = await Promise.all([
      api("/summary"),
      api("/recent?limit=8"),
    ]);

    app.replaceChildren(
      heading("ภาพรวมอุปกรณ์", "สถานะปัจจุบันของอุปกรณ์ที่เปิดเผยสำหรับการตรวจสอบ"),
    );

    const grid = el("section", "grid");
    [
      ["ทั้งหมด", summary.data.total, "primary"],
      ["พร้อมใช้งาน", summary.data.in_stock, ""],
      ["กำลังใช้งาน", summary.data.in_use, ""],
      ["อยู่ระหว่างเคลม", summary.data.claim, ""],
    ].forEach(([label, value, kind]) => {
      const card = el("article", `card ${kind}`.trim());
      card.append(el("small", "", label), el("strong", "", value ?? 0));
      grid.append(card);
    });
    app.append(grid);

    const panel = el("section", "panel");
    const ph = el("div", "panelhead");
    const link = el("a", "", "ดูอุปกรณ์ทั้งหมด");
    link.href = "#assets";
    ph.append(el("h2", "", "ความเคลื่อนไหวล่าสุด"), link);
    panel.append(ph, assetTable(recent.data));
    app.append(panel);
  } catch (error) {
    errorView(error);
  }
}

async function renderAssets() {
  loading();
  const params = new URLSearchParams({
    page: state.assets.page,
    limit: 20,
  });
  if (state.assets.search) params.set("search", state.assets.search);
  if (state.assets.status) params.set("status", state.assets.status);

  try {
    const payload = await api(`/assets?${params}`);
    app.replaceChildren(
      heading("อุปกรณ์ทั้งหมด", "ค้นหาและดูสถานะอุปกรณ์แบบอ่านอย่างเดียว"),
    );

    const toolbar = el("div", "toolbar");
    const search = el("input", "input");
    search.type = "search";
    search.placeholder = "ค้นหารหัสอุปกรณ์ รุ่น ยี่ห้อ หรือ Part Number";
    search.value = state.assets.search;

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

    let timer = null;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.assets.search = search.value.trim();
        state.assets.page = 1;
        renderAssets();
      }, 300);
    });

    select.addEventListener("change", () => {
      state.assets.status = select.value;
      state.assets.page = 1;
      renderAssets();
    });

    toolbar.append(
      search,
      select,
      el("span", "count", `${payload.meta.total} รายการ`),
    );
    app.append(toolbar);

    const panel = el("section", "panel");
    panel.append(
      assetTable(payload.data),
      pager(payload.meta.page, payload.meta.totalPages, (page) => {
        state.assets.page = page;
        renderAssets();
      }),
    );
    app.append(panel);
  } catch (error) {
    errorView(error);
  }
}

function historyTable(items) {
  const wrap = el("div", "tablewrap");
  const table = el("table", "table");
  const head = el("thead");
  const hr = el("tr");
  ["วันเวลา", "รายการ", "อุปกรณ์", "รุ่น"].forEach((x) => hr.append(el("th", "", x)));
  head.append(hr);

  const body = el("tbody");
  if (!items.length) {
    const row = el("tr");
    const cell = el("td", "empty", "ยังไม่มีประวัติ");
    cell.colSpan = 4;
    row.append(cell);
    body.append(row);
  }

  for (const item of items) {
    const row = el("tr", item.asset_id ? "clickable" : "");
    row.append(
      td(fmt(item.movement_date, true)),
      td(MOVEMENT[item.movement_type] || item.movement_type || "-"),
    );

    const asset = el("td");
    asset.append(
      el("span", "code", item.public_code || "-"),
      el("span", "sub", item.masked_serial || ""),
    );
    row.append(asset, td(item.product_name || "-"));

    if (item.asset_id) {
      const open = () => openDetail(item.asset_id);
      row.tabIndex = 0;
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
  loading();
  try {
    const payload = await api(`/history?page=${state.history.page}&limit=30`);
    app.replaceChildren(
      heading(
        "ประวัติอุปกรณ์",
        "ดูเหตุการณ์ย้อนหลังโดยไม่เปิดเผยผู้ปฏิบัติงาน โครงการ หรือข้อมูลภายใน",
      ),
    );

    const panel = el("section", "panel");
    panel.append(
      historyTable(payload.data),
      pager(payload.meta.page, payload.meta.totalPages, (page) => {
        state.history.page = page;
        renderHistory();
      }),
    );
    app.append(panel);
  } catch (error) {
    errorView(error);
  }
}

function field(label, value) {
  const box = el("div", "field");
  box.append(el("small", "", label));
  if (value instanceof Node) box.append(value);
  else box.append(el("strong", "", value || "-"));
  return box;
}

async function openDetail(id) {
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  detail.replaceChildren(el("div", "loading", "กำลังโหลดรายละเอียด..."));

  try {
    const [assetPayload, historyPayload] = await Promise.all([
      api(`/assets/${id}`),
      api(`/assets/${id}/history`),
    ]);
    const asset = assetPayload.data;

    const title = el("div", "detailtitle");
    const h2 = el("h2", "", asset.public_code);
    h2.id = "drawer-title";
    title.append(
      h2,
      el(
        "p",
        "",
        [asset.product_name, asset.brand, asset.part_number].filter(Boolean).join(" · "),
      ),
    );

    const grid = el("div", "detailgrid");
    grid.append(
      field("สถานะ", badge(asset.current_status)),
      field("Serial", asset.masked_serial),
      field("วันที่รับเข้า", fmt(asset.received_date)),
      field("ความเคลื่อนไหวล่าสุด", fmt(asset.last_activity_at, true)),
    );

    const timeline = el("ol", "timeline");
    for (const movement of historyPayload.data) {
      const item = el("li");
      item.append(
        el("strong", "", MOVEMENT[movement.movement_type] || movement.movement_type),
        el("small", "", fmt(movement.movement_date, true)),
      );
      timeline.append(item);
    }
    if (!historyPayload.data.length) timeline.append(el("li", "", "ยังไม่มีประวัติ"));

    detail.replaceChildren(title, grid, el("h3", "", "ประวัติ"), timeline);
    closeButton.focus();
  } catch (error) {
    detail.replaceChildren(el("div", "error", error.message));
  }
}

function closeDetail() {
  overlay.hidden = true;
  document.body.style.overflow = "";
}

function route() {
  const value = location.hash.replace(/^#/, "");
  return ["overview", "assets", "history"].includes(value) ? value : "overview";
}

function renderRoute() {
  const current = route();
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === current);
  });

  if (current === "assets") renderAssets();
  else if (current === "history") renderHistory();
  else renderOverview();
}

closeButton.addEventListener("click", closeDetail);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !overlay.hidden) closeDetail();
});
window.addEventListener("hashchange", renderRoute);

if (!location.hash) location.hash = "overview";
else renderRoute();
