export const REGIONS = ['eu1', 'in1', 'us1', 'sg1', 'aps3', 'mec1'];

export const OPERATORS = [
  { value: 'EQ', label: 'EQ (equals)' },
  { value: 'NE', label: 'NE (not equals)' },
  { value: 'GT', label: 'GT (greater than)' },
  { value: 'GTE', label: 'GTE (greater or equal)' },
  { value: 'LT', label: 'LT (less than)' },
  { value: 'LTE', label: 'LTE (less or equal)' },
  { value: 'CNT', label: 'CNT (in list)' },
  { value: 'DNCNT', label: 'DNCNT (not in list)' },
  { value: 'BET', label: 'BET (between)' },
  { value: 'INL', label: 'INL (is null)' },
  { value: 'SWITH', label: 'SWITH (starts with)' },
  { value: 'EWITH', label: 'EWITH (ends with)' },
];

const NUMERIC_OPS = new Set(['GT', 'GTE', 'LT', 'LTE', 'BET']);
const isNumeric = (s) => /^-?\d+(\.\d+)?$/.test(String(s).trim());
const coerce = (s, op) => {
  const v = String(s ?? '').trim();
  return NUMERIC_OPS.has(op) && isNumeric(v) ? Number(v) : v;
};

/** Turns one UI clause row into the API clause shape. Returns null if incomplete. */
export function toApiClause(c) {
  const attr = c.attr.trim();
  if (!attr) return null;
  switch (c.op) {
    case 'BET':
      if (String(c.min).trim() === '' || String(c.max).trim() === '') return null;
      return { attr, op: 'BET', value: [coerce(c.min, 'BET'), coerce(c.max, 'BET')] };
    case 'CNT':
    case 'DNCNT': {
      const list = String(c.value).split(',').map((v) => v.trim()).filter(Boolean);
      return list.length ? { attr, op: c.op, value: list } : null;
    }
    case 'INL':
      return { attr, op: 'INL', value: c.nullVal === 'true' };
    default:
      return String(c.value).trim() === '' ? null : { attr, op: c.op, value: coerce(c.value, c.op) };
  }
}

export function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const v = String(raw ?? '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export const parseIdentityText = (text) => dedupe(text.split(/[\n,]/));

export function buildPayload({ strategyId, strategyName, clauses, columns, count, identity }) {
  const apiClauses = clauses.map(toApiClause).filter(Boolean);
  const sid = strategyId.trim();
  const responseColumns = columns.split(',').map((c) => c.trim()).filter(Boolean);
  const n = Math.min(50, Math.max(1, Number(count) || 10));

  const payload = { id: /^\d+$/.test(sid) ? Number(sid) : sid };
  if (strategyName.trim()) payload.name = strategyName.trim();
  payload.scope = {};
  if (apiClauses.length) payload.filters = { logic: 'AND', clauses: apiClauses };
  payload.identity = identity;
  payload.responseColumns = responseColumns;
  payload.sort = [];
  payload.count = n;
  payload.page = { pageNumber: 1, limit: n };
  payload.includeMetadata = true;
  return payload;
}

export const apiUrl = (region) =>
  `https://${region}.recommendation.clevertap.com/api/v1/recommendations`;

export function toCurl({ region, accountId, passcode, payload }) {
  return [
    `curl --location '${apiUrl(region)}' \\`,
    `--header 'X-CleverTap-Account-Id: ${accountId}' \\`,
    `--header 'X-CleverTap-Passcode: ${passcode}' \\`,
    `--header 'Content-Type: application/json; charset=utf-8' \\`,
    `--data '${JSON.stringify(payload, null, 4).replace(/'/g, "'\\''")}'`,
  ].join('\n');
}

/** Calls the API through the local proxy defined in vite.config.js. */
export async function fetchRecommendations({ region, accountId, passcode, payload, signal }) {
  const res = await fetch(`/ct/${region}/api/v1/recommendations`, {
    method: 'POST',
    headers: {
      'X-CleverTap-Account-Id': accountId.trim(),
      'X-CleverTap-Passcode': passcode.trim(),
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
    signal,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  if (!data) throw new Error('The API answered with something that is not JSON.');
  return data;
}
