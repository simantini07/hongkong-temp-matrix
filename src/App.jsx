/**
 * TemperatureMatrix.jsx
 * 
 * Matrix View for Hong Kong Monthly Temperature Data
 * - X-axis: Year (last 10 years)
 * - Y-axis: Month (Jan–Dec)
 * - Cell background: encodes avg max or avg min temperature via color scale
 * - Mini line charts: green = daily max, light-blue = daily min
 * - Click anywhere to toggle between Max / Min mode
 * - Hover tooltip: shows date (year-month) and temperature value
 * - Legend: color scale from 0°C (blue) to 40°C (dark red)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const MARGIN = { top: 50, right: 130, bottom: 20, left: 90 };
const CELL_PAD = 3; // padding between cells in px

// Color scale matching the reference: blue (cold) → yellow → orange → dark red (hot)
// Reversed RdYlBu: low temp = blue/cool, high temp = red/hot
const COLOR_DOMAIN = [0, 40];
const COLOR_SCALE = d3.scaleSequential()
  .domain(COLOR_DOMAIN)
  .interpolator(t => d3.interpolateRdYlBu(1 - t)); // invert so hot=red, cold=blue

// ─── Data Helpers ──────────────────────────────────────────────────────────────

/** Parse raw CSV rows and return cleaned array of daily records */
function parseRows(raw) {
  const parseDate = d3.timeParse("%Y-%m-%d");
  return raw.map(d => {
    const date = parseDate(d.date);
    return {
      date,
      year:  date.getFullYear(),
      month: date.getMonth() + 1,   // 1–12
      day:   date.getDate(),
      max:   +d.max_temperature,
      min:   +d.min_temperature,
    };
  }).filter(d => !isNaN(d.max) && !isNaN(d.min));
}

/** Filter to last 10 years and group: Map<year, Map<month, day[]>> */
function buildGrouped(rows) {
  const maxYear = d3.max(rows, d => d.year);
  const filtered = rows.filter(d => d.year > maxYear - 10);

  const grouped = d3.group(filtered, d => d.year, d => d.month);

  const years = [...new Set(filtered.map(d => d.year))]
    .sort((a, b) => a - b);

  return { data: filtered, grouped, years, maxYear };
}

/** Build flat cell array from grouped data */
function buildCells(grouped, years) {
  const cells = [];
  years.forEach(year => {
    const monthMap = grouped.get(year);
    if (!monthMap) return;
    for (let m = 1; m <= 12; m++) {
      const days = monthMap.get(m) || [];
      cells.push({
        year,
        month: m,
        days,
        avgMax: days.length ? d3.mean(days, d => d.max) : null,
        avgMin: days.length ? d3.mean(days, d => d.min) : null,
        absMax: days.length ? d3.max(days, d => d.max)  : null,
        absMin: days.length ? d3.min(days, d => d.min)  : null,
      });
    }
  });
  return cells;
}

// ─── Drawing Functions ─────────────────────────────────────────────────────────

/**
 * Draw axis labels (year headers + month labels)
 */
function drawAxes(svg, years, xScale, yScale, margin) {
  // Year labels on top
  svg.selectAll(".year-label")
    .data(years)
    .join("text")
    .attr("class", "year-label")
    .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
    .attr("y", margin.top - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("font-family", "monospace")
    .attr("fill", "#333")
    .text(d => d);

  // Month labels on left
  svg.selectAll(".month-label")
    .data(d3.range(1, 13))
    .join("text")
    .attr("class", "month-label")
    .attr("x", margin.left - 8)
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 11)
    .attr("font-family", "monospace")
    .attr("fill", "#333")
    .text(d => MONTH_NAMES[d - 1]);
}

/**
 * Draw the color legend on the right side
 */
function drawLegend(svg, totalWidth, totalHeight, margin) {
  const legendX = totalWidth - margin.right + 20;
  const legendH = 220;
  const legendY = margin.top + 20;
  const barW = 18;

  const legendScale = d3.scaleLinear()
    .domain(COLOR_DOMAIN)
    .range([legendH, 0]);

  const legendAxis = d3.axisRight(legendScale)
    .tickValues([0, 10, 20, 30, 40])
    .tickFormat(d => `${d}`);

  // Gradient definition
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient")
    .attr("id", "legend-grad")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  d3.range(0, 41, 5).forEach(v => {
    grad.append("stop")
      .attr("offset", `${(v / 40) * 100}%`)
      .attr("stop-color", COLOR_SCALE(v));
  });

  const lg = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  // Colored bar
  lg.append("rect")
    .attr("width", barW)
    .attr("height", legendH)
    .style("fill", "url(#legend-grad)");

  // Axis ticks on right of bar
  lg.append("g")
    .attr("transform", `translate(${barW}, 0)`)
    .call(legendAxis)
    .call(g => {
      g.select(".domain").remove();
      g.selectAll("text")
        .attr("font-size", 10)
        .attr("font-family", "monospace");
    });

  // Top/bottom labels
  lg.append("text")
    .attr("x", barW / 2).attr("y", -14)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "monospace")
    .attr("fill", COLOR_SCALE(0))
    .text("0 Celsius");

  lg.append("text")
    .attr("x", barW / 2).attr("y", legendH + 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "monospace")
    .attr("fill", COLOR_SCALE(40))
    .text("40 Celsius");
}

/**
 * Draw mini line chart inside a cell group element
 * @param {d3.Selection} g - the <g> element for the cell
 * @param {object} cellData - { days, ... }
 * @param {number} bw - cell bandwidth width
 * @param {number} bh - cell bandwidth height
 */
function drawMiniChart(g, cellData, bw, bh) {
  if (!cellData.days.length) return;

  const pad = 4;
  const xMini = d3.scaleLinear()
    .domain([1, cellData.days.length])
    .range([pad, bw - pad]);

  const yMini = d3.scaleLinear()
    .domain([0, 40])
    .range([bh - pad, pad]);

  // Line generators
  const lineMax = d3.line()
    .x((d, i) => xMini(i + 1))
    .y(d => yMini(d.max))
    .curve(d3.curveCatmullRom);

  const lineMin = d3.line()
    .x((d, i) => xMini(i + 1))
    .y(d => yMini(d.min))
    .curve(d3.curveCatmullRom);

  // Max temperature line (green)
  g.append("path")
    .datum(cellData.days)
    .attr("d", lineMax)
    .attr("stroke", "rgba(80,180,80,0.85)")
    .attr("stroke-width", 1.2)
    .attr("fill", "none");

  // Min temperature line (light blue/white)
  g.append("path")
    .datum(cellData.days)
    .attr("d", lineMin)
    .attr("stroke", "rgba(200,220,255,0.85)")
    .attr("stroke-width", 1.2)
    .attr("fill", "none");
}

/**
 * Main draw function: renders the entire matrix
 */
function drawMatrix({ svg, cells, years, mode, onCellHover, onCellLeave, totalWidth, totalHeight }) {
  svg.selectAll("*").remove();

  const cw = totalWidth  - MARGIN.left - MARGIN.right;
  const ch = totalHeight - MARGIN.top  - MARGIN.bottom;

  // Scales for cell positions
  const xScale = d3.scaleBand()
    .domain(years)
    .range([MARGIN.left, MARGIN.left + cw])
    .padding(0.04);

  const yScale = d3.scaleBand()
    .domain(d3.range(1, 13))
    .range([MARGIN.top, MARGIN.top + ch])
    .padding(0.04);

  drawAxes(svg, years, xScale, yScale, MARGIN);
  drawLegend(svg, totalWidth, totalHeight, MARGIN);

  // ── Cell groups — only render cells that have data ──
  const cellGroups = svg.selectAll(".cell")
    .data(cells.filter(d => d.days.length > 0), d => `${d.year}-${d.month}`)
    .join("g")
    .attr("class", "cell")
    .attr("transform", d => `translate(${xScale(d.year)}, ${yScale(d.month)})`);

  const bw = xScale.bandwidth();
  const bh = yScale.bandwidth();

  // Background rect colored by temperature
  cellGroups.append("rect")
    .attr("width", bw)
    .attr("height", bh)
    .attr("rx", 2)
    .attr("fill", d => {
      const val = mode === "max" ? d.avgMax : d.avgMin;
      return val !== null ? COLOR_SCALE(val) : "#eee";
    })
    .attr("stroke", "rgba(255,255,255,0.3)")
    .attr("stroke-width", 0.5);

  // Mini line charts
  cellGroups.each(function(d) {
    drawMiniChart(d3.select(this), d, bw, bh);
  });

  // Transparent hover overlay (on top of everything in cell)
  cellGroups.append("rect")
    .attr("width", bw)
    .attr("height", bh)
    .attr("fill", "transparent")
    .attr("cursor", "crosshair")
    .on("mousemove", (event, d) => onCellHover(event, d, mode))
    .on("mouseleave", onCellLeave);
}

// ─── React Component ───────────────────────────────────────────────────────────

export default function App() {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);   // measures available space for SVG
  const tooltipRef   = useRef(null);
  const [mode, setMode]       = useState("max");   // "max" | "min"
  const [cells, setCells]     = useState([]);
  const [years, setYears]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Load & parse CSV once ──
  useEffect(() => {
    d3.csv("/temperature_daily.csv")
      .then(raw => {
        const rows   = parseRows(raw);
        const { grouped, years } = buildGrouped(rows);
        const cells  = buildCells(grouped, years);
        setCells(cells);
        setYears(years);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // ── Tooltip handlers ──
  const handleCellHover = useCallback((event, d, currentMode) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const val = currentMode === "max" ? d.avgMax : d.avgMin;
    const label = currentMode === "max" ? "max" : "min";
    tip.style.visibility = "visible";
    tip.style.left = (event.pageX + 14) + "px";
    tip.style.top  = (event.pageY - 10) + "px";
    tip.innerHTML  = `<strong>Date:</strong> ${d.year}-${String(d.month).padStart(2,"0")}<br/>`
                   + `<strong>${label}:</strong> ${val !== null ? val.toFixed(1) : "N/A"} °C`;
  }, []);

  const handleCellLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.visibility = "hidden";
  }, []);

  // ── Draw / redraw whenever data or mode changes ──
  useEffect(() => {
    if (!cells.length || !svgRef.current || !containerRef.current) return;

    const render = () => {
      if (!containerRef.current) return;
      // Measure the flex container to fit SVG exactly — no scrollbar
      const { width: totalWidth, height: totalHeight } =
        containerRef.current.getBoundingClientRect();

      const svg = d3.select(svgRef.current)
        .attr("width",  totalWidth)
        .attr("height", totalHeight);

      drawMatrix({
        svg,
        cells,
        years,
        mode,
        onCellHover:  handleCellHover,
        onCellLeave:  handleCellLeave,
        totalWidth,
        totalHeight,
      });
    };

    render();

    // Redraw if the container is resized (e.g. window resize)
    const ro = new ResizeObserver(render);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [cells, years, mode, handleCellHover, handleCellLeave]);

  // ── Click to toggle mode ──
  const toggleMode = () => setMode(m => m === "max" ? "min" : "max");

  // ── Render ──
  return (
    // Outermost wrapper: full viewport, background color
    <div
      style={{
        fontFamily: "monospace",
        background: "#f7f4ef",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Inner content wrapper — takes full width with padding */}
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding: "16px 32px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header row — centered */}
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#222", letterSpacing: 1 }}>
            Hong Kong Monthly Temperature
          </h2>

          {/* Toggle button — ONLY this triggers the mode switch */}
          <button
            onClick={toggleMode}
            title="Click to switch between Max and Min temperature"
            style={{
              padding: "6px 18px",
              background: mode === "max" ? "#c0392b" : "#2980b9",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: "bold",
              letterSpacing: 0.5,
              transition: "background 0.3s",
            }}
          >
            Showing: {mode === "max" ? "Max Temperature ▲" : "Min Temperature ▼"}
          </button>

          <span style={{ fontSize: 12, color: "#666" }}>
            (Click button to toggle Max / Min)
          </span>
        </div>

        {/* Status messages */}
        {loading && <p style={{ color: "#888" }}>Loading data…</p>}
        {error   && <p style={{ color: "red"  }}>Error: {error}</p>}

        {/* SVG container — fills all remaining space */}
        {!loading && !error && (
          <div
            ref={containerRef}
            style={{
              flex: 1,
              minHeight: 0,    // essential: lets flex child shrink properly
              width: "100%",
            }}
          >
            <svg
              ref={svgRef}
              style={{
                background: "transparent",
                display: "block",
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        )}

        {/* Line legend at bottom */}
        <div style={{ marginTop: 8, fontSize: 11, color: "#555", display: "flex", gap: 18, flexShrink: 0 }}>
          <span>
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="rgba(80,180,80,0.9)" strokeWidth="2"/></svg>
            {" "} Daily Max
          </span>
          <span>
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="rgba(200,220,255,0.9)" strokeWidth="2"/></svg>
            {" "} Daily Min
          </span>
        </div>
      </div>

      {/* Tooltip — fixed positioned, outside flow */}
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          visibility: "hidden",
          background: "rgba(255,255,255,0.97)",
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: "6px 10px",
          fontSize: 12,
          fontFamily: "monospace",
          color: "#222",
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          zIndex: 9999,
          lineHeight: 1.6,
        }}
      />
    </div>
  );
}