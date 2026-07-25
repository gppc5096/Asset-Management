function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map((h) => escapeCsvField(String(h))).join(",")];
  for (const row of rows) {
    lines.push(row.map((v) => escapeCsvField(String(v))).join(","));
  }
  // BOM: 엑셀에서 한글 깨짐 방지
  return "﻿" + lines.join("\n");
}

/** 따옴표로 묶인 필드(콤마·줄바꿈 포함) 지원하는 최소 CSV 파서 */
export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** 헤더 행을 기준으로 각 데이터 행을 {헤더명: 값} 객체로 변환 */
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key.trim()] = row[i] ?? "";
    });
    return record;
  });
}
