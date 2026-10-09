# CleverTap recommendation runner

React (Vite) UI that calls the CleverTap Recommendation API for one identity or a CSV of identities, in timed batches, and shows the results in a table.

## How the request is built

| UI                | Payload                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Strategy ID       | `id` (sent as a number when it's all digits)                                                                |
| Name (optional)   | `name`                                                                                                      |
| Columns to return | `responseColumns` (comma-separated)                                                                         |
| Items             | `count` and `page.limit`                                                                                    |
| Filter rows       | `filters.clauses`, joined with `logic: "AND"`. Incomplete rows are skipped; no rows means no `filters` key. |
| Identities        | one request per identity, `identity` field                                                                  |

Value handling per operator:

- `GT`, `GTE`, `LT`, `LTE`: numeric text is sent as a number.
- `BET`: two inputs, sent as `[min, max]`.
- `CNT`, `DNCNT`: comma-separated text, sent as an array.
- `INL`: sent as `true` (is null) or `false` (is not null). Check this matches your strategy's expectation.
- Everything else: sent as a string.

## Batching

"Requests per batch" requests fire in parallel; the next batch starts "Gap (seconds)" after the previous one started (default: 1 request every 3 s). Stop cancels in-flight requests and the queue.

## Files

- `src/App.jsx` – form, run controls, progress
- `src/components/FilterBuilder.jsx` – AND filter rows
- `src/components/AudienceInput.jsx` – textbox / CSV (mutually exclusive)
- `src/components/ResultsTable.jsx` – grouped results, search, CSV export
- `src/lib/api.js` – payload builder and fetch
- `src/lib/runner.js` – timed batch runner
