import React, { useState, useEffect } from "react";
import "./App.css";

function formatPercent(v) {
  if (!Number.isFinite(v)) return "-";
  return `${v.toFixed(2)}%`;
}

export default function App() {
  const STORAGE_KEY = "nft_trades_v1";

  const [rows, setRows] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((r) => ({
            id: r.id || Date.now() + Math.random(),
            name: r.name || "",
            buy: r.buy || "",
            sell: r.sell || "",
            amount: r.amount || "",
          }));
        }
      }
    } catch (e) {
      // ignore and use default
    }
    return [{ id: Date.now(), name: "", buy: "", sell: "", amount: "" }];
  });

  const addRow = () =>
    setRows((r) => [
      ...r,
      {
        id: Date.now() + Math.random(),
        name: "",
        buy: "",
        sell: "",
        amount: "",
      },
    ]);

  const updateRow = (id, field, value) =>
    setRows((r) =>
      r.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );

  const removeRow = (id) => setRows((r) => r.filter((row) => row.id !== id));

  const computePnLPercent = (buyRaw, sellRaw) => {
    const buy = parseFloat(buyRaw);
    const sell = parseFloat(sellRaw);
    if (!Number.isFinite(buy) || buy <= 0) return null;
    if (!Number.isFinite(sell)) return null;
    return ((sell - buy) / buy) * 100;
  };

  // persist rows to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (e) {
      // ignore storage errors
    }
  }, [rows]);

  return (
    <div className="app-bg">
      <div className="mft-container">
        <div className="mft-card">
          <div className="mft-header" style={{ marginBottom: 12 }}>
            <div>
              <div className="mft-title">NFT PnL Tracker</div>
              <div className="mft-subtitle">
                Add trades and see % profit / loss per item
              </div>
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={addRow}
                style={{ marginLeft: 8 }}
              >
                Add Item
              </button>
            </div>
          </div>

          <table
            className="mft-table"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Name</th>
                <th>Buy Price</th>
                <th>Sell Price</th>
                <th>Amount</th>
                <th>% PnL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pnl = computePnLPercent(row.buy, row.sell);
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.id, "name", e.target.value)
                        }
                        placeholder="NFT name"
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={row.buy}
                        onChange={(e) =>
                          updateRow(row.id, "buy", e.target.value)
                        }
                        placeholder="0.00"
                        style={{ width: 120 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={row.sell}
                        onChange={(e) =>
                          updateRow(row.id, "sell", e.target.value)
                        }
                        placeholder="leave empty if unsold"
                        style={{ width: 140 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(row.id, "amount", e.target.value)
                        }
                        placeholder="qty"
                        style={{ width: 90 }}
                      />
                    </td>
                    <td
                      className={
                        pnl === null
                          ? "pnl-empty"
                          : pnl >= 0
                          ? "pnl-positive"
                          : "pnl-negative"
                      }
                    >
                      {pnl === null ? "-" : formatPercent(pnl)}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={() => removeRow(row.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
