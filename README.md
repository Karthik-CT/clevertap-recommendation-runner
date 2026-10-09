# CleverTap recommendation runner

React (Vite) UI that calls the CleverTap Recommendation API for one identity or a CSV of identities, in timed batches, and shows the results in a table.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Why there's a proxy

The CleverTap API can't be called directly from a browser (CORS), and the passcode shouldn't live in front-end code you ship. In dev, `vite.config.js` forwards `/ct/<region>/...` to `https://<region>.recommendation.clevertap.com/...` server-side, exactly like your cURL. `npm run build && npm run preview` uses the same proxy.

If you deploy this beyond your own machine, put the same forwarding rule in your server (Nginx, Express, a serverless function) and ideally keep the passcode on the server instead of typing it into the page.

To add a region, add it to `REGIONS` in both `vite.config.js` and `src/lib/api.js`.

## How the request is built

| UI | Payload |
|---|---|
| Strategy ID | `id` (sent as a number when it's all digits) |
| Name (optional) | `name` |
| Columns to return | `responseColumns` (comma-separated) |
| Items | `count` and `page.limit` |
| Filter rows | `filters.clauses`, joined with `logic: "AND"`. Incomplete rows are skipped; no rows means no `filters` key. |
| Identities | one request per identity, `identity` field |

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
# clevertap-recommendation-runner
