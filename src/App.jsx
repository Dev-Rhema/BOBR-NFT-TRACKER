import React, { useState, useEffect } from "react";
import "./App.css";

function formatPercent(v) {
  if (!Number.isFinite(v)) return "-";
  return `${v.toFixed(2)}%`;
}

function formatCurrency(n) {
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(4)}`;
}

export default function App() {
  const STORAGE_KEY = "nft_trades_v1";

  // Coin price state
  const [coinId, setCoinId] = useState(null);
  const [coinPriceUSD, setCoinPriceUSD] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(null);

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

  const computePnl = (buyRaw, sellRaw, amountRaw) => {
    const buy = parseFloat(buyRaw);
    const sell = parseFloat(sellRaw);
    let qty = parseFloat(amountRaw);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    if (!Number.isFinite(buy) || buy <= 0) return null;
    if (!Number.isFinite(sell)) return null;
    const perUnit = sell - buy;
    const total = perUnit * qty;
    const percent = (perUnit / buy) * 100;
    return { total, percent };
  };

  // Helpers for fetching MON USD price from CoinGecko
  async function resolveCoinIdBySymbol(sym) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
          sym
        )}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.coins || !data.coins.length) return null;
      const found = data.coins.find(
        (c) => c.symbol.toLowerCase() === sym.toLowerCase()
      );
      return found ? found.id : data.coins[0].id;
    } catch (e) {
      return null;
    }
  }

  async function fetchCoinPriceUSD() {
    const symbol = "mon"; // token symbol to resolve
    setPriceLoading(true);
    setPriceError(null);
    try {
      let id = coinId;
      if (!id) {
        id = await resolveCoinIdBySymbol(symbol);
        setCoinId(id);
      }
      if (!id) throw new Error("coin id not found");
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
          id
        )}&vs_currencies=usd`
      );
      if (!r.ok) throw new Error("price fetch failed");
      const j = await r.json();
      const price = j[id] && j[id].usd ? Number(j[id].usd) : null;
      setCoinPriceUSD(price);
    } catch (e) {
      setPriceError(String(e.message || e));
      setCoinPriceUSD(null);
    } finally {
      setPriceLoading(false);
    }
  }

  // load price on mount and poll every 30s
  useEffect(() => {
    fetchCoinPriceUSD();
    const iv = setInterval(fetchCoinPriceUSD, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatUSD(n) {
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 4,
    }).format(n);
  }

  // persist rows to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (e) {
      // ignore storage errors
    }
  }, [rows]);

  // debug mount
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("App mounted");
  }, []);

  // Error boundary to show runtime errors instead of a blank page
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(err) {
      return { error: err };
    }
    componentDidCatch(err, info) {
      // eslint-disable-next-line no-console
      console.error(err, info);
    }
    render() {
      if (this.state.error) {
        return (
          <div style={{ padding: 24 }}>
            <h2>App error</h2>
            <pre style={{ whiteSpace: "pre-wrap", color: "#fca5a5" }}>
              {String(this.state.error)}
            </pre>
          </div>
        );
      }
      return this.props.children;
    }
  }
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

          <div
            style={{
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="mon-price">
              MON:{" "}
              {priceLoading
                ? "Loading..."
                : coinPriceUSD
                ? formatUSD(coinPriceUSD)
                : "Price unavailable"}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {priceError
                ? `Error: ${priceError}`
                : priceLoading
                ? ""
                : "Updated"}
            </div>
          </div>

          <div className="table-wrap">
            <table
              className="mft-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Name</th>
                  <th>Buy Price (MON)</th>
                  <th>Sell Price (MON)</th>
                  <th>Amount</th>
                  <th>PnL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pnlObj = computePnl(row.buy, row.sell, row.amount);
                  const buyVal = parseFloat(row.buy);
                  const sellVal = parseFloat(row.sell);
                  const buyUsd =
                    Number.isFinite(coinPriceUSD) && Number.isFinite(buyVal)
                      ? coinPriceUSD * buyVal
                      : NaN;
                  const sellUsd =
                    Number.isFinite(coinPriceUSD) && Number.isFinite(sellVal)
                      ? coinPriceUSD * sellVal
                      : NaN;
                  const pnlUsd =
                    pnlObj &&
                    Number.isFinite(coinPriceUSD) &&
                    Number.isFinite(pnlObj.total)
                      ? pnlObj.total * coinPriceUSD
                      : NaN;
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
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div className="usd-inline">{formatUSD(buyUsd)}</div>
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
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div className="usd-inline">{formatUSD(sellUsd)}</div>
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
                        </div>
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
                          pnlObj === null
                            ? "pnl-empty"
                            : pnlObj.total >= 0
                            ? "pnl-positive"
                            : "pnl-negative"
                        }
                      >
                        {pnlObj === null ? (
                          "-"
                        ) : (
                          <>
                            <span>
                              {formatCurrency(pnlObj.total)}
                              {Number.isFinite(pnlUsd) ? (
                                <span
                                  className="usd-inline"
                                  style={{ marginLeft: 8 }}
                                >
                                  {formatUSD(pnlUsd)}
                                </span>
                              ) : null}
                            </span>
                            <div
                              style={{ fontSize: 12, color: "var(--muted)" }}
                            >
                              {formatPercent(pnlObj.percent)}
                            </div>
                          </>
                        )}
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
    </div>
  );
}
