/**
 * DemandLineChart
 *
 * Displays estimated weekly distribution volume per category.
 * Data comes from GET /forecasts/category (pre-computed on the backend).
 *
 * Chart anatomy:
 *   — Solid blue line   : historical actuals (OUTBOUND movements, aggregated weekly)
 *   — Dashed blue line  : model forecast (ETS or Croston TSB)
 *   — Shaded blue band  : 80 % prediction interval (ETS only; absent for Croston)
 *
 * Data status tiers (from backend):
 *   insufficient  → no forecast; show informational message
 *   limited       → forecast shown with a "early estimate" disclaimer
 *   adequate/good → full forecast with confidence intervals
 *
 * Model health badge (from backend):
 *   good / degraded / poor / no_data
 */

import React, { useCallback, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { getForecastAggregate, getForecastCategory, triggerForecastRun } from "../../services/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUE = "#3b82f6";
const BLUE_FADED = "rgba(59, 130, 246, 0.12)";

const HEALTH_LABEL = {
  good: "Model healthy",
  degraded: "Model degraded",
  poor: "Model accuracy poor",
  no_data: "No forecast data",
};
const HEALTH_CLASS = {
  good: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
  no_data: "bg-slate-100 text-slate-500",
};

// Human-readable week label: "2024-06-03" → "3 Jun"
function fmtWeek(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Build Chart.js dataset structure from one CategoryForecast object
// ---------------------------------------------------------------------------
function buildChartData(cat) {
  const hist = cat.historical ?? [];
  const fcast = cat.forecast ?? [];
  const ci80 = cat.ci_80 ?? [];

  // Combine all dates into a single label array
  const allLabels = [
    ...hist.map((p) => p.week_start),
    ...fcast.map((p) => p.week_start),
  ];
  const displayLabels = allLabels.map(fmtWeek);

  const histLen = hist.length;

  // Historical actuals: real values for past weeks, null for future weeks
  const historicalData = [
    ...hist.map((p) => p.value),
    ...Array(fcast.length).fill(null),
  ];

  // Forecast: include one overlap point at the boundary (last historical value)
  // so the solid and dashed lines connect visually.
  const lastHistValue = hist.length > 0 ? hist[hist.length - 1].value : null;
  const forecastData = [
    ...Array(Math.max(0, histLen - 1)).fill(null),
    lastHistValue,
    ...fcast.map((p) => p.value),
  ];

  // CI bands — null for all historical positions
  const ciHasBands = ci80.some((b) => b.lower !== null || b.upper !== null);
  const ciLowerData = [
    ...Array(histLen).fill(null),
    ...ci80.map((b) => b.lower ?? null),
  ];
  const ciUpperData = [
    ...Array(histLen).fill(null),
    ...ci80.map((b) => b.upper ?? null),
  ];

  const datasets = [];

  if (ciHasBands) {
    // Invisible lower bound anchor — upper dataset fills back to this
    datasets.push({
      label: "_ci_lower",
      data: ciLowerData,
      borderColor: "transparent",
      backgroundColor: "transparent",
      pointRadius: 0,
      borderWidth: 0,
      fill: false,
      order: 10,
    });
    // Shaded CI band fills between lower and upper
    datasets.push({
      label: "80% confidence interval",
      data: ciUpperData,
      borderColor: "transparent",
      backgroundColor: BLUE_FADED,
      pointRadius: 0,
      borderWidth: 0,
      fill: "-1",
      order: 10,
    });
  }

  // Historical actuals (solid line)
  datasets.push({
    label: "Estimated Distribution Volume",
    data: historicalData,
    borderColor: BLUE,
    backgroundColor: "transparent",
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    fill: false,
    spanGaps: false,
    order: 1,
  });

  // Forecast (dashed line)
  datasets.push({
    label: "Forecast",
    data: forecastData,
    borderColor: BLUE,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderDash: [6, 3],
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false,
    spanGaps: false,
    order: 1,
  });

  return { labels: displayLabels, datasets };
}

// ---------------------------------------------------------------------------
// Build Chart.js dataset structure from the aggregate response
// ---------------------------------------------------------------------------
function buildAggregateChartData(aggregateResponse) {
  const hist = (aggregateResponse.points ?? []).filter((p) => p.is_historical);
  const fcast = (aggregateResponse.points ?? []).filter((p) => !p.is_historical);

  const allLabels = [
    ...hist.map((p) => p.week_start),
    ...fcast.map((p) => p.week_start),
  ];
  const displayLabels = allLabels.map(fmtWeek);
  const histLen = hist.length;

  const historicalData = [
    ...hist.map((p) => p.value),
    ...Array(fcast.length).fill(null),
  ];

  const lastHistValue = hist.length > 0 ? hist[hist.length - 1].value : null;
  const forecastData = [
    ...Array(Math.max(0, histLen - 1)).fill(null),
    lastHistValue,
    ...fcast.map((p) => p.value),
  ];

  const ciHasBands = fcast.some(
    (p) => p.ci_lower_80 !== null || p.ci_upper_80 !== null
  );
  const ciLowerData = [
    ...Array(histLen).fill(null),
    ...fcast.map((p) => p.ci_lower_80 ?? null),
  ];
  const ciUpperData = [
    ...Array(histLen).fill(null),
    ...fcast.map((p) => p.ci_upper_80 ?? null),
  ];

  const datasets = [];
  if (ciHasBands) {
    datasets.push({
      label: "_ci_lower",
      data: ciLowerData,
      borderColor: "transparent",
      backgroundColor: "transparent",
      pointRadius: 0,
      borderWidth: 0,
      fill: false,
      order: 10,
    });
    datasets.push({
      label: "80% confidence interval",
      data: ciUpperData,
      borderColor: "transparent",
      backgroundColor: BLUE_FADED,
      pointRadius: 0,
      borderWidth: 0,
      fill: "-1",
      order: 10,
    });
  }
  datasets.push({
    label: "Total Distribution Volume",
    data: historicalData,
    borderColor: BLUE,
    backgroundColor: "transparent",
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    fill: false,
    spanGaps: false,
    order: 1,
  });
  datasets.push({
    label: "Forecast",
    data: forecastData,
    borderColor: BLUE,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderDash: [6, 3],
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false,
    spanGaps: false,
    order: 1,
  });

  return { labels: displayLabels, datasets };
}

// ---------------------------------------------------------------------------
// Chart.js options
// ---------------------------------------------------------------------------
const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      display: true,
      position: "top",
      labels: {
        filter: (item) => !item.text.startsWith("_"),
        font: { size: 12 },
        boxWidth: 20,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          if (ctx.dataset.label.startsWith("_")) return null;
          const v = ctx.parsed.y;
          if (v === null || v === undefined) return null;
          return `${ctx.dataset.label}: ${Math.round(v)}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, maxTicksLimit: 12, maxRotation: 0 },
    },
    y: {
      grid: { color: "#f3f4f6" },
      ticks: { font: { size: 11 } },
      title: { display: true, text: "Units distributed", font: { size: 11 } },
      beginAtZero: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DemandLineChart() {
  const [forecastResponse, setForecastResponse] = useState(null);
  const [aggregateResponse, setAggregateResponse] = useState(null);
  const [viewMode, setViewMode] = useState("category"); // "category" | "aggregate"
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState(null);
  const [error, setError] = useState(null);

  const fetchForecasts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [catData, aggData] = await Promise.all([
        getForecastCategory(8),
        getForecastAggregate(),
      ]);
      setForecastResponse(catData);
      setAggregateResponse(aggData);
      setSelectedCategory((prev) => {
        if (prev) return prev;
        const first =
          catData.categories.find((c) => c.data_status !== "insufficient") ??
          catData.categories[0];
        return first?.category ?? null;
      });
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You do not have permission to view forecasts.");
      } else {
        setError("Failed to load forecast data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  const handleTriggerRun = async () => {
    setTriggering(true);
    setTriggerError(null);
    try {
      await triggerForecastRun(8);
      await fetchForecasts();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setTriggerError(detail ?? "Failed to trigger forecast run.");
    } finally {
      setTriggering(false);
    }
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Distribution Forecast
        </h3>
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          Loading forecast data…
        </div>
      </div>
    );
  }

  // ---- Permission / network error ----
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Distribution Forecast
        </h3>
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // ---- No forecast run exists yet ----
  const noData =
    !forecastResponse ||
    forecastResponse.model_health === "no_data" ||
    forecastResponse.categories.length === 0;

  if (noData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Distribution Forecast
        </h3>
        <div className="flex flex-col items-center justify-center gap-4 h-64 text-center px-6">
          <p className="text-slate-500 text-sm max-w-sm">
            No forecast has been generated yet. Click below to analyse your
            distribution history and generate the first forecast.
          </p>
          {triggerError && (
            <p className="text-red-500 text-xs">{triggerError}</p>
          )}
          <button
            onClick={handleTriggerRun}
            disabled={triggering}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? "Generating…" : "Generate Forecast"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Normal render ----
  const { categories, model_health, is_stale, run_timestamp } = forecastResponse;
  const activeCat =
    categories.find((c) => c.category === selectedCategory) ?? categories[0];

  const isInsufficient = activeCat.data_status === "insufficient";
  const isLimited = activeCat.data_status === "limited";
  const catChartData = isInsufficient ? null : buildChartData(activeCat);

  const aggInsufficient =
    !aggregateResponse ||
    aggregateResponse.data_status === "insufficient" ||
    aggregateResponse.points.length === 0;
  const aggChartData = aggInsufficient ? null : buildAggregateChartData(aggregateResponse);

  const runDate = run_timestamp
    ? new Date(run_timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-700">
            Distribution Forecast
          </h3>
          {runDate && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last updated {runDate}
              {is_stale && (
                <span className="ml-2 text-amber-500">· Refreshing in background…</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              HEALTH_CLASS[model_health] ?? HEALTH_CLASS.no_data
            }`}
          >
            {HEALTH_LABEL[model_health] ?? "Unknown"}
          </span>
          <button
            onClick={handleTriggerRun}
            disabled={triggering}
            title="Manually retrain the forecast model"
            className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 hover:border-blue-300"
          >
            {triggering ? "Running…" : "Refresh"}
          </button>
        </div>
      </div>

      {triggerError && (
        <p className="text-red-500 text-xs mb-3">{triggerError}</p>
      )}

      {/* ---- View mode toggle ---- */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setViewMode("aggregate")}
          className={`text-xs px-3 py-1 rounded-l-md border ${
            viewMode === "aggregate"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          All Categories
        </button>
        <button
          onClick={() => setViewMode("category")}
          className={`text-xs px-3 py-1 rounded-r-md border-t border-b border-r ${
            viewMode === "category"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          By Category
        </button>
      </div>

      {/* ---- Aggregate view ---- */}
      {viewMode === "aggregate" && (
        <>
          {aggInsufficient ? (
            <div className="flex flex-col items-center justify-center h-56 text-center gap-2 px-4">
              <p className="text-slate-500 text-sm max-w-sm">
                Not enough distribution history yet to generate an aggregate forecast.
              </p>
              <p className="text-slate-400 text-xs max-w-sm">
                Forecasting becomes available after at least 8 weeks of outbound
                activity is recorded.
              </p>
            </div>
          ) : (
            <>
              {aggregateResponse?.data_status === "limited" && (
                <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                  Early estimate — confidence intervals are wide due to limited history.
                </div>
              )}
              <div className="relative h-72">
                <Line data={aggChartData} options={CHART_OPTIONS} />
              </div>
              <p className="text-xs text-slate-400 mt-3 text-right">
                Total items distributed per week across all categories.
                Shows fulfilled outflow only.
              </p>
            </>
          )}
        </>
      )}

      {/* ---- Category view ---- */}
      {viewMode === "category" && (
        <>
          {/* Category selector */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <label className="text-sm text-slate-500 whitespace-nowrap">
              Category:
            </label>
            <select
              value={selectedCategory ?? ""}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-blue-400"
            >
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                  {c.data_status === "insufficient" ? " (no data)" : ""}
                </option>
              ))}
            </select>
            {activeCat.model_type && !isInsufficient && (
              <span className="text-xs text-slate-400">
                {/* {activeCat.model_type} */}
                {activeCat.weeks_of_history > 0
                  ? `${activeCat.weeks_of_history} wks history`
                  : ""}
              </span>
            )}
          </div>

          {/* Insufficient data */}
          {isInsufficient && (
            <div className="flex flex-col items-center justify-center h-56 text-center gap-2 px-4">
              <p className="text-slate-500 text-sm max-w-sm">
                Not enough distribution history yet for{" "}
                <strong>{activeCat.category}</strong>.
              </p>
              <p className="text-slate-400 text-xs max-w-sm">
                Forecasting becomes available after at least 8 weeks of outbound
                activity is recorded.
              </p>
            </div>
          )}

          {/* Limited data disclaimer */}
          {!isInsufficient && isLimited && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
              Early estimate — confidence intervals are wide due to limited history.
              Accuracy improves as more weeks of data accumulate.
            </div>
          )}

          {/* Chart */}
          {catChartData && (
            <div className="relative h-72">
              <Line data={catChartData} options={CHART_OPTIONS} />
            </div>
          )}

          {/* Footer note */}
          {!isInsufficient && (
            <p className="text-xs text-slate-400 mt-3 text-right">
              Shows fulfilled outflow only — stockout periods may cause
              underestimates.
            </p>
          )}
        </>
      )}
    </div>
  );
}
