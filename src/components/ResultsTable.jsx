import { useMemo, useState } from 'react';

const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function dataColumns(results) {
  const cols = [];
  const seen = new Set();
  for (const r of results) {
    for (const item of r.items || []) {
      for (const k of Object.keys(item.data || {})) {
        if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
    }
  }
  return cols;
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(results, cols) {
  const header = ['user_identity', 'status', 'rank', 'item_identity', ...cols, 'image_url', 'error'];
  const lines = [header.join(',')];
  for (const r of results) {
    if (!r.items?.length) {
      lines.push([r.identity, r.status, '', '', ...cols.map(() => ''), '', r.error || ''].map(csvCell).join(','));
      continue;
    }
    r.items.forEach((it, i) => {
      lines.push([r.identity, r.status, i + 1, it.identity, ...cols.map((c) => it.data?.[c]), it.metaData?.image_url, '']
        .map(csvCell).join(','));
    });
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `recommendations-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ResultsTable({ results }) {
  const [query, setQuery] = useState('');
  const cols = useMemo(() => dataColumns(results), [results]);
  const hasImages = useMemo(() => results.some((r) => r.items?.some((i) => i.metaData?.image_url)), [results]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) =>
      r.identity.toLowerCase().includes(q) ||
      r.items?.some((it) => Object.values(it.data || {}).some((v) => String(v ?? '').toLowerCase().includes(q)))
    );
  }, [results, query]);

  if (!results.length) return null;
  const span = 3 + cols.length + (hasImages ? 1 : 0);

  return (
    <section className="results" aria-label="Results">
      <div className="results-bar">
        <h2>Results</h2>
        <input className="search" type="search" placeholder="Find an identity or item"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find in results" />
        <button type="button" className="ghost-btn" onClick={() => exportCsv(results, cols)}>Export CSV</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User identity</th>
              <th className="num">#</th>
              {hasImages && <th>Image</th>}
              <th>Item ID</th>
              {cols.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          {visible.map((r) => {
            const rows = r.items?.length ? r.items : [null];
            return (
              <tbody key={r.identity} className={`group ${r.status}`}>
                {rows.map((it, i) => (
                  <tr key={i}>
                    {i === 0 && (
                      <th scope="rowgroup" rowSpan={rows.length} className="who">
                        <span className="mono">{r.identity}</span>
                        <span className="meta">
                          <span className={`badge ${r.status}`}>
                            {r.status === 'ok' ? `${r.items.length} items` : r.status === 'empty' ? 'No items' : 'Failed'}
                          </span>
                          <span className="ms">{r.ms} ms</span>
                        </span>
                      </th>
                    )}
                    {it ? (
                      <>
                        <td className="num">{i + 1}</td>
                        {hasImages && (
                          <td className="img">
                            {it.metaData?.image_url ? (
                              <img src={it.metaData.image_url} alt="" loading="lazy"
                                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                            ) : null}
                          </td>
                        )}
                        <td className="mono">{show(it.identity)}</td>
                        {cols.map((c) => (
                          <td key={c} className={it.data?.[c] == null ? 'nil' : ''}>{show(it.data?.[c])}</td>
                        ))}
                      </>
                    ) : (
                      <td colSpan={span} className={r.status === 'error' ? 'err-cell' : 'empty-cell'}>
                        {r.status === 'error' ? r.error : 'The strategy returned no recommendations for this identity.'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
        {visible.length === 0 && <p className="empty-note pad">Nothing matches “{query}”.</p>}
      </div>
    </section>
  );
}
