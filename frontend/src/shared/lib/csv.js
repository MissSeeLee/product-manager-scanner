export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  if (quoted) {
    throw new Error("CSV_UNCLOSED_QUOTE");
  }

  row.push(cell);

  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((value) => value.trim().replace(/^\uFEFF/, ""));

  if (headers.some((header) => !header)) {
    throw new Error("CSV_EMPTY_HEADER");
  }

  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase());

  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new Error("CSV_DUPLICATE_HEADER");
  }

  const dataRows = rows.slice(1).map((values, rowIndex) => {
    if (values.length > headers.length) {
      throw new Error(`CSV_TOO_MANY_COLUMNS:${rowIndex + 2}`);
    }

    const record = {};

    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });

    return record;
  });

  return { headers, rows: dataRows };
}

function protectSpreadsheetFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function toCsvText(rows) {
  function escapeValue(value) {
    let text = protectSpreadsheetFormula(value);

    if (/[",\r\n]/.test(text)) {
      text = `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  }

  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);

  return [
    headers.map(escapeValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeValue(row[header])).join(","),
    ),
  ].join("\r\n");
}

export function downloadCsv(filename, rows) {
  const csv = toCsvText(rows);

  if (!csv) {
    return;
  }

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
