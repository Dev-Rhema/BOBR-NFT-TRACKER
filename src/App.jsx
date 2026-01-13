import React, { useState, useEffect, useRef } from "react";
import qr from "./assets/qr.png";

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

  const [coinId, setCoinId] = useState(null);
  const [coinPriceUSD, setCoinPriceUSD] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

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
    } catch (e) {}
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

  const updateRow = (id, field, value) => {
    setRows((r) =>
      r.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeRow = (id) => {
    setRows((r) => r.filter((row) => row.id !== id));
  };

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

  const portfolioTotalMon = rows.reduce((sum, row) => {
    const sellVal = row.sell;
    if (sellVal !== "" && Number.isFinite(parseFloat(sellVal))) return sum;
    const buy = parseFloat(row.buy);
    if (!Number.isFinite(buy) || buy <= 0) return sum;
    let qty = parseFloat(row.amount);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    return sum + buy * qty;
  }, 0);

  const portfolioTotalUsd = Number.isFinite(coinPriceUSD)
    ? portfolioTotalMon * coinPriceUSD
    : NaN;

  const buyTotalMon = rows.reduce((s, row) => {
    const buy = parseFloat(row.buy);
    if (!Number.isFinite(buy) || buy <= 0) return s;
    let qty = parseFloat(row.amount);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    return s + buy * qty;
  }, 0);

  const sellTotalMon = rows.reduce((s, row) => {
    const sell = parseFloat(row.sell);
    if (!Number.isFinite(sell)) return s;
    let qty = parseFloat(row.amount);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    return s + sell * qty;
  }, 0);

  const amountTotal = rows.reduce((s, row) => {
    let qty = parseFloat(row.amount);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    return s + qty;
  }, 0);

  const pnlTotalMon = rows.reduce((s, row) => {
    const buy = parseFloat(row.buy);
    const sell = parseFloat(row.sell);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) return s;
    let qty = parseFloat(row.amount);
    if (!Number.isFinite(qty) || qty === 0) qty = 1;
    return s + (sell - buy) * qty;
  }, 0);

  const buyTotalUsd = Number.isFinite(coinPriceUSD)
    ? buyTotalMon * coinPriceUSD
    : NaN;
  const sellTotalUsd = Number.isFinite(coinPriceUSD)
    ? sellTotalMon * coinPriceUSD
    : NaN;
  const pnlTotalUsd = Number.isFinite(coinPriceUSD)
    ? pnlTotalMon * coinPriceUSD
    : NaN;

  async function fetchCoinPriceUSD() {
    const symbol = "mon";
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

  useEffect(() => {
    fetchCoinPriceUSD();
    const iv = setInterval(fetchCoinPriceUSD, 30000);
    return () => clearInterval(iv);
  }, []);

  function formatUSD(n) {
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 4,
    }).format(n);
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      } catch (e) {}
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [rows]);

  const SUPPORT_ADDRESS = "0xe3095e6A987DE1F7cC6f207e3215A215bb16a75F";
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(SUPPORT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  }

  const downloadCSV = () => {
    try {
      const headers = [
        "Name",
        "Buy (MON)",
        "Sell (MON)",
        "Amount",
        "PnL (MON)",
        "PnL %",
      ];
      const lines = [headers.join(",")];
      rows.forEach((row) => {
        const pnlObj = computePnl(row.buy, row.sell, row.amount);
        const pnlTotal =
          pnlObj && Number.isFinite(pnlObj.total) ? pnlObj.total : "";
        const pnlPercent =
          pnlObj && Number.isFinite(pnlObj.percent)
            ? pnlObj.percent.toFixed(2)
            : "";
        const safeName = (row.name || "").replace(/"/g, '""');
        const fields = [
          `"${safeName}"`,
          row.buy,
          row.sell,
          row.amount,
          pnlTotal,
          pnlPercent,
        ];
        lines.push(fields.join(","));
      });
      lines.push(
        [
          "Totals",
          buyTotalMon || "",
          sellTotalMon || "",
          amountTotal || "",
          pnlTotalMon || "",
          "",
        ].join(",")
      );

      const csv = lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nft-trades.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("CSV download failed", e);
    }
  };

  const downloadPDF = async () => {
    try {
      const buildRowHtml = (r) => {
        const pnlObj = computePnl(r.buy, r.sell, r.amount);
        const pnlTotal =
          pnlObj && Number.isFinite(pnlObj.total) ? pnlObj.total : "";
        const pnlPercent =
          pnlObj && Number.isFinite(pnlObj.percent)
            ? `${pnlObj.percent.toFixed(2)}%`
            : "";
        return `<tr><td>${(r.name || "").replace(/</g, "&lt;")}</td><td>${
          r.buy || ""
        }</td><td>${r.sell || ""}</td><td>${
          r.amount || ""
        }</td><td>${pnlTotal}</td><td>${pnlPercent}</td></tr>`;
      };

      const rowsHtml = rows.map(buildRowHtml).join("");
      const totalsHtml = `<tr style="font-weight:700"><td>Totals</td><td>${
        buyTotalMon || ""
      }</td><td>${sellTotalMon || ""}</td><td>${amountTotal || ""}</td><td>${
        pnlTotalMon || ""
      }</td><td></td></tr>`;
      const html = `<!doctype html><html><head><title>NFT Trades</title><meta charset="utf-8"><style>table{width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h2>NFT Trades</h2><table><thead><tr><th>Name</th><th>Buy (MON)</th><th>Sell (MON)</th><th>Amount</th><th>PnL (MON)</th><th>PnL %</th></tr></thead><tbody>${rowsHtml}${totalsHtml}</tbody></table></body></html>`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      if ("srcdoc" in iframe) {
        iframe.srcdoc = html;
      } else {
        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.open();
        idoc.write(html);
        idoc.close();
      }

      await new Promise((res) => {
        const t = setTimeout(res, 800);
        iframe.onload = () => {
          clearTimeout(t);
          res();
        };
      });

      const win = iframe.contentWindow || iframe;
      try {
        win.focus && win.focus();
        win.print && win.print();
      } catch (err) {}

      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
      }, 600);
    } catch (e) {
      console.error("PDF export failed", e);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center pt-10 pb-10 px-4 sm:px-12"
      style={{ background: "linear-gradient(180deg, #0b0720 0%, #0b0720 60%)" }}
    >
      <div className="w-full max-w-7xl">
        <div
          className="rounded-2xl p-5 border"
          style={{
            background:
              "linear-gradient(180deg, rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.03))",
            borderColor: "rgba(139, 92, 246, 0.12)",
            boxShadow: "0 10px 30px rgba(11, 6, 30, 0.6)",
            backdropFilter: "blur(6px) saturate(120%)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                NFT PnL Tracker
              </h1>
              <p className="text-[13px] sm:text-sm text-slate-400">
                Add trades and see % profit / loss per item
              </p>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 mt-3 sm:mt-0 items-stretch sm:items-center sm:justify-end">
              <button
                onClick={addRow}
                className="w-full sm:w-auto px-4 py-2 rounded-lg font-semibold text-white transition-all active:translate-y-px"
                style={{
                  background: "linear-gradient(90deg, #6d28d9, #8b5cf6)",
                  boxShadow: "0 6px 20px rgba(139, 92, 246, 0.14)",
                }}
              >
                Add Item
              </button>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg font-semibold text-slate-300 border transition-all active:translate-y-px flex items-center justify-center"
                  style={{
                    background: "transparent",
                    borderColor: "rgba(255, 255, 255, 0.04)",
                  }}
                >
                  Export
                </button>
                {exportOpen && (
                  <div className="sm:absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-lg z-40 flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
                    <button
                      onClick={() => {
                        downloadCSV();
                        setExportOpen(false);
                      }}
                      className="w-full sm:w-auto px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] sm:text-sm"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => {
                        downloadPDF();
                        setExportOpen(false);
                      }}
                      className="w-full sm:w-auto px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] sm:text-sm"
                    >
                      PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-black" style={{ color: "#8b5cf6" }}>
              MON:{" "}
              {priceLoading
                ? "Loading..."
                : coinPriceUSD
                ? formatUSD(coinPriceUSD)
                : "Price unavailable"}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">
              {priceError
                ? `Error: ${priceError}`
                : priceLoading
                ? ""
                : "Updated"}
            </div>
          </div>

          <div className="mb-3 flex items-baseline gap-3 flex-wrap">
            <div className="text-[13px] sm:text-sm font-semibold text-slate-400">
              Portfolio Total (unsold):
            </div>
            <div className="text-lg sm:text-2xl font-bold sm:font-black text-slate-100">
              {formatCurrency(portfolioTotalMon)} MON
            </div>
            {Number.isFinite(portfolioTotalUsd) && (
              <div className="text-sm sm:text-lg font-normal sm:font-bold text-slate-400">
                {formatUSD(portfolioTotalUsd)}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] sm:text-sm">
              <thead>
                <tr
                  className="border-b-2"
                  style={{
                    background: "rgba(17, 8, 40, 0.6)",
                    borderColor: "rgba(255, 255, 255, 0.02)",
                  }}
                >
                  <th className="text-left p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    Name
                  </th>
                  <th className="p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    Buy Price (MON)
                  </th>
                  <th className="p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    Sell Price (MON)
                  </th>
                  <th className="p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    Amount
                  </th>
                  <th className="p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    PnL
                  </th>
                  <th className="p-3 text-slate-400 font-bold text-[11px] sm:text-xs">
                    Actions
                  </th>
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
                    <tr
                      key={row.id}
                      className="border-b hover:bg-purple-900/10"
                      style={{ borderColor: "rgba(255, 255, 255, 0.02)" }}
                    >
                      <td className="p-3">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updateRow(row.id, "name", e.target.value)
                          }
                          placeholder="NFT name"
                          className="w-full min-w-[160px] sm:min-w-0 px-1.5 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border outline-none focus:border-purple-500 placeholder:text-[11px] sm:placeholder:text-sm text-[13px] sm:text-sm text-slate-100"
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            borderColor: "rgba(255, 255, 255, 0.04)",
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <div
                            className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg min-w-[86px] text-center hidden sm:inline-block"
                            style={{
                              color: "rgba(230, 238, 248, 0.7)",
                              background: "rgba(139, 92, 246, 0.08)",
                            }}
                          >
                            {formatUSD(buyUsd)}
                          </div>
                          <input
                            type="number"
                            step="any"
                            value={row.buy}
                            onChange={(e) =>
                              updateRow(row.id, "buy", e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full sm:w-32 px-1.5 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border outline-none focus:border-purple-500 placeholder:text-[11px] sm:placeholder:text-sm text-[13px] sm:text-sm text-slate-100"
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              borderColor: "rgba(255, 255, 255, 0.04)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <div
                            className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg min-w-[86px] text-center hidden sm:inline-block"
                            style={{
                              color: "rgba(230, 238, 248, 0.7)",
                              background: "rgba(139, 92, 246, 0.08)",
                            }}
                          >
                            {formatUSD(sellUsd)}
                          </div>
                          <input
                            type="number"
                            step="any"
                            value={row.sell}
                            onChange={(e) =>
                              updateRow(row.id, "sell", e.target.value)
                            }
                            placeholder="leave empty if unsold"
                            className="w-full sm:w-36 px-1.5 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border outline-none focus:border-purple-500 placeholder:text-[11px] sm:placeholder:text-sm text-[13px] sm:text-sm text-slate-100"
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              borderColor: "rgba(255, 255, 255, 0.04)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="any"
                          value={row.amount}
                          onChange={(e) =>
                            updateRow(row.id, "amount", e.target.value)
                          }
                          placeholder="qty"
                          className="w-full sm:w-24 px-1.5 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border outline-none focus:border-purple-500 placeholder:text-[11px] sm:placeholder:text-sm text-[13px] sm:text-sm text-slate-100"
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            borderColor: "rgba(255, 255, 255, 0.04)",
                          }}
                        />
                      </td>
                      <td className="p-3 text-center">
                        {pnlObj === null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div
                            className={
                              pnlObj.total >= 0
                                ? "text-green-500 font-bold"
                                : "text-red-500 font-bold"
                            }
                          >
                            <div>
                              {formatCurrency(pnlObj.total)}
                              {Number.isFinite(pnlUsd) && (
                                <span
                                  className="ml-2 text-[11px] sm:text-xs"
                                  style={{ color: "rgba(230, 238, 248, 0.7)" }}
                                >
                                  {formatUSD(pnlUsd)}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-400">
                              {formatPercent(pnlObj.percent)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => removeRow(row.id)}
                          className="w-full sm:w-auto px-3 py-1.5 rounded text-[13px] sm:text-sm transition-all active:translate-y-px"
                          style={{
                            background: "transparent",
                            color: "#bfc3d8",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr
                  className="font-bold border-t-2"
                  style={{
                    background: "rgba(17, 8, 40, 0.3)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <td className="p-3 text-white">Totals</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-extrabold text-slate-100">
                        {formatCurrency(buyTotalMon)} MON
                      </div>
                      {Number.isFinite(buyTotalUsd) && (
                        <div className="text-[11px] sm:text-xs text-slate-400">
                          {formatUSD(buyTotalUsd)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-extrabold text-slate-100">
                        {formatCurrency(sellTotalMon)} MON
                      </div>
                      {Number.isFinite(sellTotalUsd) && (
                        <div className="text-[11px] sm:text-xs text-slate-400">
                          {formatUSD(sellTotalUsd)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {Number.isFinite(amountTotal) ? amountTotal : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-center">
                      <div
                        className={`font-extrabold ${
                          pnlTotalMon === 0
                            ? "text-slate-400"
                            : pnlTotalMon > 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {formatCurrency(pnlTotalMon)}
                      </div>
                      {Number.isFinite(pnlTotalUsd) && (
                        <div className="text-[11px] sm:text-xs text-slate-400">
                          {formatUSD(pnlTotalUsd)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center mt-5 pb-6">
          <div
            className="inline-flex items-center gap-3 rounded-xl px-3 py-2 border"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderColor: "rgba(255, 255, 255, 0.04)",
            }}
          >
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center text-[11px] sm:text-xs text-slate-500"
              style={{ background: "rgba(0, 0, 0, 0.12)" }}
            >
              <img src={qr} alt="" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-[13px] sm:text-sm font-bold text-slate-100">
                Support Us
              </div>
              <div className="text-[11px] sm:text-xs font-mono text-slate-300 break-all">
                {SUPPORT_ADDRESS}
                <button
                  onClick={copyAddress}
                  className="ml-2 text-purple-400 font-bold hover:underline"
                >
                  {copied ? "Copied!" : "(click to copy)"}
                </button>
              </div>
              {!copied && (
                <div className="text-[11px] sm:text-xs text-slate-500">
                  Scan the QR or copy the address to support development
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
