// Dependency-free CSV parser for the import wizard.
// Handles quoted fields, embedded commas/newlines, escaped quotes ("")
// CRLF line endings and a UTF-8 BOM.

export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let closedQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; closedQuote = true; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (field !== '' || closedQuote) throw new Error('Invalid CSV: unexpected quote. Export the file as CSV again.');
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      closedQuote = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      closedQuote = false;
      rows.push(row);
      row = [];
    } else {
      if (closedQuote && ch.trim()) throw new Error('Invalid CSV: text after a closing quote.');
      field += ch;
    }
  }
  if (inQuotes) throw new Error('Invalid CSV: a quoted field was not closed. Export the file as CSV again.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully empty trailing rows.
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map(h => h.trim());
  if (headers.some(h => !h)) throw new Error('Every CSV column needs a header.');
  if (new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Error('CSV column names must be unique. Rename duplicate columns before importing.');
  const dataRows = rows.slice(1).map(r => {
    if (r.length !== headers.length && !r.every(c => !c.trim())) throw new Error('A CSV row has a different number of columns. Check the export before importing.');
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, rows: dataRows };
}
