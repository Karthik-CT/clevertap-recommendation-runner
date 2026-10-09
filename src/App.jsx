import { useEffect, useMemo, useRef, useState } from "react";
import FilterBuilder from "./components/FilterBuilder";
import AudienceInput, { csvIdentities } from "./components/AudienceInput";
import ResultsTable from "./components/ResultsTable";
import {
  REGIONS,
  buildPayload,
  fetchRecommendations,
  parseIdentityText,
  toCurl,
} from "./lib/api";
import { runInBatches } from "./lib/runner";

const MAX_ITEMS = 50;

function Countdown({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, (until - now) / 1000).toFixed(1)} s</>;
}

export default function App() {
  const [region, setRegion] = useState("eu1");
  const [accountId, setAccountId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [strategyId, setStrategyId] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [columns, setColumns] = useState("");
  const [count, setCount] = useState(10);

  const [clauses, setClauses] = useState([]);

  const [identityText, setIdentityText] = useState("");
  const [csv, setCsv] = useState(null);

  const [batchSize, setBatchSize] = useState(1);
  const [intervalSec, setIntervalSec] = useState(3);

  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [nextAt, setNextAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  const identities = useMemo(
    () => (csv ? csvIdentities(csv) : parseIdentityText(identityText)),
    [csv, identityText],
  );

  const config = { strategyId, strategyName, clauses, columns, count: Math.min(MAX_ITEMS, Math.max(1, parseInt(count, 10) || 1)) };
  const preview = buildPayload({
    ...config,
    identity: identities[0] ?? "<identity>",
  });

  const missing = [];
  if (!accountId.trim()) missing.push("account ID");
  if (!passcode.trim()) missing.push("passcode");
  if (!strategyId.trim()) missing.push("strategy ID");
  if (!identities.length) missing.push("at least one identity");

  const done = results.length;
  const ok = results.filter((r) => r.status !== "error").length;
  const failed = done - ok;
  const etaSec =
    Math.ceil((total - done) / Math.max(1, batchSize)) * intervalSec;

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    const list = identities;
    const snapshot = { ...config };
    const creds = { region, accountId, passcode };
    setResults([]);
    setTotal(list.length);
    setRunning(true);

    await runInBatches({
      items: list,
      batchSize: Number(batchSize) || 1,
      intervalMs: Math.max(0, Number(intervalSec) || 0) * 1000,
      signal: controller.signal,
      onWait: setNextAt,
      onResult: (r) => setResults((prev) => [...prev, r]),
      worker: async (identity) => {
        const t0 = performance.now();
        const ms = () => Math.round(performance.now() - t0);
        try {
          const data = await fetchRecommendations({
            ...creds,
            payload: buildPayload({ ...snapshot, identity }),
            signal: controller.signal,
          });
          if (data.status && data.status !== "success") {
            return {
              identity,
              status: "error",
              items: [],
              error: data.error || data.message || JSON.stringify(data),
              ms: ms(),
            };
          }
          const items = data.items || [];
          return {
            identity,
            status: items.length ? "ok" : "empty",
            items,
            ms: ms(),
          };
        } catch (e) {
          return {
            identity,
            status: "error",
            items: [],
            error: e.name === "AbortError" ? "Stopped" : e.message,
            ms: ms(),
          };
        }
      },
    });

    setNextAt(null);
    setRunning(false);
  };

  const stop = () => abortRef.current?.abort();

  const copyCurl = async () => {
    await navigator.clipboard.writeText(
      toCurl({ region, accountId, passcode, payload: preview }),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="page">
      <header className="masthead">
        <h1>Recommendation runner</h1>
        <p>
          Pull CleverTap recommendations for one identity or a whole list, one
          batch at a time.
        </p>
      </header>

      <div className="layout">
        <form className="config" onSubmit={(e) => e.preventDefault()}>
          <fieldset disabled={running}>
            <legend>Account</legend>
            <div className="grid three">
              <div className="field">
                <label htmlFor="region">Region</label>
                <select
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="acc">Account ID</label>
                <input
                  id="acc"
                  className="mono"
                  placeholder="XXX-XXX-XXXX"
                  autoComplete="off"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pass">Passcode</label>
                <div className="with-btn">
                  <input
                    id="pass"
                    className="mono"
                    type={showPass ? "text" : "password"}
                    autoComplete="off"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Passcode"
                  />
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setShowPass((s) => !s)}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset disabled={running}>
            <legend>Strategy</legend>
            <div className="grid strategy">
              <div className="field">
                <label htmlFor="sid">Strategy ID</label>
                <input
                  id="sid"
                  className="mono"
                  inputMode="numeric"
                  placeholder="Strategy ID"
                  value={strategyId}
                  onChange={(e) => setStrategyId(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sname">
                  Name <span className="opt">optional</span>
                </label>
                <input
                  id="sname"
                  placeholder="Strategy name"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cols">Columns to return</label>
                <input
                  id="cols"
                  value={columns}
                  placeholder="Column Names"
                  onChange={(e) => setColumns(e.target.value)}
                />
              </div>
              <div className="field narrow">
                <label htmlFor="count">Items</label>
                <input
                  id="count"
                  type="number"
                  min="1"
                  max={MAX_ITEMS}
                  value={count}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCount(v === "" ? v : String(Math.min(MAX_ITEMS, Math.max(1, parseInt(v, 10) || 1))));
                  }}
                />
              </div>
            </div>
          </fieldset>

          <fieldset disabled={running}>
            <legend>
              Filters{" "}
              <span className="legend-note">All conditions must match</span>
            </legend>
            <FilterBuilder
              clauses={clauses}
              setClauses={setClauses}
              disabled={running}
            />
          </fieldset>

          <fieldset disabled={running}>
            <legend>Identities</legend>
            <AudienceInput
              text={identityText}
              setText={setIdentityText}
              csv={csv}
              setCsv={setCsv}
              disabled={running}
            />
          </fieldset>
        </form>

        <aside className="side">
          <div className="run-card">
            <div className="pace">
              <div className="field">
                <label htmlFor="bs">Requests per batch</label>
                <input
                  id="bs"
                  type="number"
                  min="1"
                  max="50"
                  value={batchSize}
                  disabled={running}
                  onChange={(e) => setBatchSize(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="iv">Gap (seconds)</label>
                <input
                  id="iv"
                  type="number"
                  min="0"
                  step="0.5"
                  value={intervalSec}
                  disabled={running}
                  onChange={(e) => setIntervalSec(e.target.value)}
                />
              </div>
            </div>

            {!running ? (
              <button
                type="button"
                className="primary"
                disabled={missing.length > 0}
                onClick={start}
              >
                {identities.length > 1
                  ? `Run for ${identities.length.toLocaleString()} identities`
                  : "Run"}
              </button>
            ) : (
              <button type="button" className="primary stop" onClick={stop}>
                Stop
              </button>
            )}
            {!running && missing.length > 0 && (
              <p className="hint">Add {missing.join(", ")} to run.</p>
            )}

            {total > 0 && (
              <div className="progress" aria-live="polite">
                <div className="bar">
                  <span style={{ width: `${(done / total) * 100}%` }} />
                </div>
                <p>
                  <strong>{done}</strong> of {total} done
                  {failed > 0 && (
                    <span className="fail-count">, {failed} failed</span>
                  )}
                  {running && nextAt && (
                    <span className="soft">
                      . Next batch in <Countdown until={nextAt} />
                    </span>
                  )}
                  {running && !nextAt && (
                    <span className="soft">. Waiting for responses</span>
                  )}
                  {running && etaSec > 0 && (
                    <span className="soft"> (about {etaSec}s left)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <details className="preview">
            <summary>
              Request body for{" "}
              {identities[0] ? (
                <span className="mono">{identities[0]}</span>
              ) : (
                "the first identity"
              )}
            </summary>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
            <button type="button" className="ghost-btn" onClick={copyCurl}>
              {copied ? "Copied" : "Copy as cURL"}
            </button>
          </details>
        </aside>
      </div>

      {results.length === 0 && !running && (
        <p className="empty-state">
          Results appear here as each identity comes back.
        </p>
      )}
      <ResultsTable results={results} />
    </div>
  );
}
