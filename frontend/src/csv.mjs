// Parse quoted fields, escaped quotes, CRLF, and embedded newlines.
export function parseProductCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const input = String(text).replace(/^\uFEFF/, '');
  const pushField = () => { row.push(field.trim()); field = ''; closed = false; };
  const pushRow = () => { pushField(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') pushField();
    else if (char === '\n' || char === '\r') { pushRow(); if (char === '\r' && input[i + 1] === '\n') i += 1; }
    else if (char === '"' && !field.trim() && !closed) { field = ''; quoted = true; }
    else if (char === '"' || (closed && char.trim())) throw new Error('Invalid CSV quoting.');
    else if (!closed) field += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  pushRow();
  if (!rows.length) throw new Error('CSV is empty.');
  const headers = rows.shift().map((value) => value.toLowerCase());
  if (!headers.includes('name') || !headers.includes('price')) throw new Error('CSV must include name and price columns.');
  if (new Set(headers).size !== headers.length || headers.some((value) => !value)) throw new Error('CSV headers must be unique and nonempty.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has an incorrect number of columns.`);
    const product = Object.fromEntries(headers.map((header, i) => [header, values[i]]));
    if (!product.name || !product.price || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) throw new Error(`Row ${index + 2} needs a product name and valid price.`);
    return product;
  });
}
