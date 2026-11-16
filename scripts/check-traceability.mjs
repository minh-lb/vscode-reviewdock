import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ID = String.raw`[A-Z][A-Z0-9]{1,5}(?:-[A-Z][A-Z0-9]{1,5})*-\d{3}`;

function tableRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*\|/.test(lines[index])) continue;
    const cells = lines[index]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells[0] === 'ID' || cells[0] === 'Mã') {
      for (let row = index + 2; row < lines.length && /^\s*\|/.test(lines[row]); row += 1) {
        const values = lines[row]
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (values[0]) rows.push(values[0]);
      }
    }
  }
  return rows;
}

export function extractSourceIds(srs, decisions) {
  const requirements = new Set();
  const requirementPattern = new RegExp(`^\\s*\\*\\*(${ID}) \\(P[012]\\):`, 'gm');
  for (const match of srs.matchAll(requirementPattern)) requirements.add(match[1]);
  for (const row of tableRows(srs)) {
    if (new RegExp(`^${ID}$`).test(row) && !row.startsWith('DEC-')) requirements.add(row);
  }

  const decisionIds = new Set();
  for (const row of tableRows(decisions)) {
    if (new RegExp(`^${ID}$`).test(row)) decisionIds.add(row);
  }
  for (const match of decisions.matchAll(new RegExp(`^###\\s+(${ID})\\s+—`, 'gm')))
    decisionIds.add(match[1]);
  return new Set([...requirements, ...decisionIds]);
}

export function extractMatrixIds(matrix) {
  return tableRows(matrix);
}

export function validateTraceability(sourceIds, matrixIds) {
  const counts = new Map();
  for (const id of matrixIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const missing = [...sourceIds].filter((id) => !counts.has(id)).sort();
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const extra = [...counts.keys()].filter((id) => !sourceIds.has(id)).sort();
  return { missing, duplicates, extra };
}

export async function checkTraceability(root = new URL('../', import.meta.url)) {
  const docs = new URL('docs/', root);
  const [srs, decisions, matrix] = await Promise.all([
    readFile(new URL('SRS.md', docs), 'utf8'),
    readFile(new URL('DECISIONS.md', docs), 'utf8'),
    readFile(new URL('REQUIREMENT-TRACEABILITY.md', docs), 'utf8'),
  ]);
  return validateTraceability(extractSourceIds(srs, decisions), extractMatrixIds(matrix));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { missing, duplicates, extra } = await checkTraceability();
    if (missing.length + duplicates.length + extra.length) {
      console.error('Traceability validation failed.');
      if (missing.length) console.error(`Missing matrix rows: ${missing.join(', ')}`);
      if (duplicates.length) console.error(`Duplicate matrix rows: ${duplicates.join(', ')}`);
      if (extra.length) console.error(`Unknown matrix rows: ${extra.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('Traceability validation passed.');
    }
  } catch (error) {
    console.error(`Traceability validation could not read its documents: ${error.message}`);
    process.exitCode = 1;
  }
}
