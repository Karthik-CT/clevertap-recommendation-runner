import { useRef, useState } from "react";
import Papa from "papaparse";
import { dedupe } from "../lib/api";

const GUESS =
  /^(identity|identities|user_?id|userid|customer_?id|phone|mobile|id)$/i;

function parseFile(file, hasHeader) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: hasHeader,
      skipEmptyLines: "greedy",
      complete: (res) => {
        let fields;
        if (hasHeader) {
          fields = (res.meta.fields || []).filter((f) => f !== "");
        } else {
          const width = res.data.reduce((m, r) => Math.max(m, r.length), 0);
          fields = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
        }
        const column =
          fields.find((f) => GUESS.test(f.trim())) ?? fields[0] ?? "";
        resolve({
          fileName: file.name,
          file,
          hasHeader,
          fields,
          rows: res.data,
          column,
        });
      },
      error: reject,
    });
  });
}

export function csvIdentities(csv) {
  if (!csv || !csv.column) return [];
  const idx = csv.fields.indexOf(csv.column);
  return dedupe(csv.rows.map((r) => (csv.hasHeader ? r[csv.column] : r[idx])));
}

export default function AudienceInput({
  text,
  setText,
  csv,
  setCsv,
  idType,
  setIdType,
  disabled,
}) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const noType = !idType;
  const label = idType === "objectId" ? "CleverTap ID" : "identity";
  const textLocked = disabled || noType || !!csv;
  const csvLocked = disabled || noType || text.trim() !== "";
  const ids = csvIdentities(csv);

  const load = async (file, hasHeader = true) => {
    setError("");
    try {
      const parsed = await parseFile(file, hasHeader);
      if (!parsed.fields.length) throw new Error("The file has no columns.");
      setCsv(parsed);
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e.message || e}`);
    }
  };

  const clear = () => {
    setCsv(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="audience">
      <div className="id-type" role="radiogroup" aria-label="Identifier type">
        <label className="check">
          <input
            type="radio"
            name="id-type"
            value="identity"
            checked={idType === "identity"}
            disabled={disabled}
            onChange={() => setIdType("identity")}
          />
          Identity
        </label>
        <label className="check">
          <input
            type="radio"
            name="id-type"
            value="objectId"
            checked={idType === "objectId"}
            disabled={disabled}
            onChange={() => setIdType("objectId")}
          />
          CleverTap ID
        </label>
      </div>

      <div className={`aud-option ${textLocked ? "locked" : ""}`}>
        <label htmlFor="identity-text">Type {noType ? "values" : `${label}s`}</label>
        <input
          id="identity-text"
          value={text}
          disabled={textLocked}
          placeholder={noType ? "Select Identity or CleverTap ID first" : `${label}1, ${label}2`}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="hint">
          {noType
            ? "Choose Identity or CleverTap ID above."
            : csv
              ? `Remove the CSV to type ${label}s instead.`
              : `One ${label}, or several separated by commas.`}
        </p>
      </div>

      <div className="aud-or" aria-hidden="true">
        or
      </div>

      <div className={`aud-option ${csvLocked ? "locked" : ""}`}>
        <label htmlFor="identity-csv">Upload a CSV</label>
        {!csv ? (
          <>
            <input
              id="identity-csv"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={csvLocked}
              onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
            />
            <p className="hint">
              {noType
                ? "Choose Identity or CleverTap ID above."
                : csvLocked && !disabled
                  ? `Clear the ${label}s above to upload a CSV instead.`
                  : `Pick the ${label} column after uploading.`}
            </p>
          </>
        ) : (
          <div className="csv-loaded">
            <div className="csv-file">
              <span className="mono">{csv.fileName}</span>
              <button
                type="button"
                className="link-btn"
                onClick={clear}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
            <div className="csv-controls">
              <select
                aria-label="Identity column"
                value={csv.column}
                disabled={disabled}
                onChange={(e) => setCsv({ ...csv, column: e.target.value })}
              >
                {csv.fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={csv.hasHeader}
                  disabled={disabled}
                  onChange={(e) => load(csv.file, e.target.checked)}
                />
                First row is a header
              </label>
            </div>
            <p className="hint">
              {ids.length.toLocaleString()} unique{" "}
              {ids.length === 1 ? "identity" : "identities"}
              {ids.length > 0 && (
                <>
                  , starting with{" "}
                  <span className="mono">{ids.slice(0, 3).join(", ")}</span>
                </>
              )}
            </p>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
