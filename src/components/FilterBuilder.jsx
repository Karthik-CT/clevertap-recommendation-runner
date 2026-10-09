import { OPERATORS } from "../lib/api";

let nextId = 1;
export const newClause = (attr = "", op = "NE", value = "") => ({
  id: nextId++,
  attr,
  op,
  value,
  min: "",
  max: "",
  nullVal: "true",
});

function ValueInput({ clause, onChange, disabled }) {
  const set = (patch) => onChange({ ...clause, ...patch });

  if (clause.op === "BET") {
    return (
      <div className="bet">
        <input
          aria-label="Minimum"
          placeholder="min"
          value={clause.min}
          disabled={disabled}
          onChange={(e) => set({ min: e.target.value })}
        />
        <span className="bet-and">to</span>
        <input
          aria-label="Maximum"
          placeholder="max"
          value={clause.max}
          disabled={disabled}
          onChange={(e) => set({ max: e.target.value })}
        />
      </div>
    );
  }
  if (clause.op === "INL") {
    return (
      <select
        aria-label="Null check"
        value={clause.nullVal}
        disabled={disabled}
        onChange={(e) => set({ nullVal: e.target.value })}
      >
        <option value="true">is null (true)</option>
        <option value="false">is not null (false)</option>
      </select>
    );
  }
  const list = clause.op === "CNT" || clause.op === "DNCNT";
  return (
    <input
      aria-label="Value"
      value={clause.value}
      disabled={disabled}
      placeholder={list ? "value1, value2" : "Value"}
      onChange={(e) => set({ value: e.target.value })}
    />
  );
}

export default function FilterBuilder({ clauses, setClauses, disabled }) {
  const update = (c) =>
    setClauses((all) => all.map((x) => (x.id === c.id ? c : x)));
  const remove = (id) => setClauses((all) => all.filter((x) => x.id !== id));
  const add = () => setClauses((all) => [...all, newClause()]);

  return (
    <div className="filters">
      {clauses.length === 0 && (
        <p className="empty-note">
          No filters. Every item in the strategy can be recommended.
        </p>
      )}
      {clauses.map((c, i) => (
        <div key={c.id}>
          {i > 0 && (
            <div className="and-joint" aria-hidden="true">
              <span>AND</span>
            </div>
          )}
          <div className="clause">
            <input
              aria-label="Attribute"
              className="attr"
              placeholder="Attribute name"
              value={c.attr}
              disabled={disabled}
              onChange={(e) => update({ ...c, attr: e.target.value })}
            />
            <select
              aria-label="Operator"
              className="op"
              value={c.op}
              disabled={disabled}
              onChange={(e) => update({ ...c, op: e.target.value })}
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="val">
              <ValueInput clause={c} onChange={update} disabled={disabled} />
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Remove condition"
              aria-label="Remove condition"
              disabled={disabled}
              onClick={() => remove(c.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="add-btn"
        onClick={add}
        disabled={disabled}
      >
        + Add condition
      </button>
    </div>
  );
}
