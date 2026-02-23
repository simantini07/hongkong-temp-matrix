/**
 * App.jsx
 *
 * Assignment 1 — Matrix View: Hong Kong Monthly Temperature
 * ─────────────────────────────────────────────────────────
 * This component visualizes daily temperature data from Hong Kong
 * as an interactive matrix, where:
 *   - Each ROW is a month (January → December)
 *   - Each COLUMN is a year (last 10 years in the dataset)
 *   - Each CELL shows the monthly max OR min temperature via background color
 *   - A mini line chart inside every cell shows day-by-day temperature changes
 *   - Clicking the toggle button switches between Max and Min temperature views
 *   - Hovering a cell shows a tooltip with the date and temperature value
 *   - A color legend on the right maps colors to Celsius values
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const MONTH_NAMES = [
  "January", "February", "March",     "April",
  "May",     "June",     "July",      "August",
  "September","October", "November",  "December"
];

// Outer spacing around the matrix so axes and legend have room to breathe
const MARGIN = { top: 50, right: 130, bottom: 20, left: 90 };

// Padding inside each mini chart so lines don't touch cell borders
const MINI_CHART_PADDING = 4;

// The temperature range the color scale covers (°C)
const TEMP_MIN_C = 0;
const TEMP_MAX_C = 40;

// D3 sequential color scale: cold temperatures → blue, hot temperatures → red
// We invert the built-in RdYlBu palette so that:
//   low values  → blue  (cool)
//   mid values  → yellow/orange
//   high values → dark red (hot)
const COLOR_SCALE = d3.scaleSequential()
  .domain([TEMP_MIN_C, TEMP_MAX_C])
  .interpolator(t => d3.interpolateRdYlBu(1 - t));

// ─────────────────────────────────────────────────────────────────────────────
// DATA HELPERS
// These pure functions handle all CSV parsing and data transformation.
// Keeping them separate from the drawing code makes both easier to maintain.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseRows — converts raw CSV strings into typed JavaScript objects.
 *
 * Each row in the CSV becomes an object with:
 *   { date, year, month, day, max, min }
 *
 * Rows with missing or non-numeric temperature values are filtered out
 * to prevent NaN values from breaking the color scale or line charts.
 *
 * @param {object[]} raw - raw rows from d3.csv()
 * @returns {object[]} cleaned array of daily temperature records
 */
function parseRows(raw) {
  const parseDate = d3.timeParse("%Y-%m-%d");

  return raw
    .map(d => {
      const date = parseDate(d.date);
      return {
        date,
        year:  date.getFullYear(),
        month: date.getMonth() + 1, // convert 0-indexed JS month to 1–12
        day:   date.getDate(),
        max:   +d.max_temperature,
        min:   +d.min_temperature,
      };
    })
    .filter(d => !isNaN(d.max) && !isNaN(d.min)); // drop rows with bad data
}

/**
 * buildGrouped — filters to the last 10 years and groups daily records
 * into a nested Map structure: year → month → day[].

 *
 * @param {object[]} rows - output of parseRows()
 * @returns {{ grouped, years, maxYear }}
 */
function buildGrouped(rows) {
  const maxYear  = d3.max(rows, d => d.year);

  // Keep only rows within the 10-year window
  const filtered = rows.filter(d => d.year > maxYear - 10);

  // d3.group creates a nested Map: Map<year, Map<month, day[]>>
  const grouped = d3.group(filtered, d => d.year, d => d.month);

  // Sorted year list drives the x-axis column order
  const years = [...new Set(filtered.map(d => d.year))].sort((a, b) => a - b);

  return { grouped, years, maxYear };
}

/**
 * buildCells — flattens the nested Map into a plain array of cell objects,
 * one per (year, month) pair. Each cell pre-computes the statistics needed
 * for coloring and tooltips so the drawing functions stay simple.
 *
 * Each cell contains:
 *   { year, month, days, absMax, absMin }
 *
 *   absMax — the single hottest day in that month (used for "Max" mode color)
 *   absMin — the single coldest day in that month (used for "Min" mode color)
 *
 * @param {Map}      grouped - nested Map from buildGrouped()
 * @param {number[]} years   - sorted array of years
 * @returns {object[]} flat array of cell data objects
 */
function buildCells(grouped, years) {
  const cells = [];

  years.forEach(year => {
    const monthMap = grouped.get(year);
    if (!monthMap) return;

    for (let month = 1; month <= 12; month++) {
      const days = monthMap.get(month) || [];

      cells.push({
        year,
        month,
        days,
        // absMax: the peak daily maximum in this month → drives "Max" cell color
        absMax: days.length ? d3.max(days, d => d.max) : null,
        // absMin: the lowest daily minimum in this month → drives "Min" cell color
        absMin: days.length ? d3.min(days, d => d.min) : null,
      });
    }
  });

  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING FUNCTIONS
// Each function has exactly one job. This makes it easy to change one aspect
// (e.g. legend style) without touching unrelated code.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * drawAxes — renders the year labels across the top and month labels
 * down the left side of the matrix.
 *
 * @param {d3.Selection} svg     - the root SVG element
 * @param {number[]}     years   - list of years for column headers
 * @param {d3.ScaleBand} xScale  - band scale mapping year → x position
 * @param {d3.ScaleBand} yScale  - band scale mapping month number → y position
 * @param {object}       margin  - { top, right, bottom, left } in px
 */
function drawAxes(svg, years, xScale, yScale, margin) {
  // ── Year labels along the top edge ──
  svg.selectAll(".year-label")
    .data(years)
    .join("text")
    .attr("class", "year-label")
    .attr("x", d => xScale(d) + xScale.bandwidth() / 2) // center over each column
    .attr("y", margin.top - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("font-family", "monospace")
    .attr("fill", "#333")
    .text(d => d);

  // ── Month labels along the left edge ──
  svg.selectAll(".month-label")
    .data(d3.range(1, 13)) // [1, 2, ..., 12]
    .join("text")
    .attr("class", "month-label")
    .attr("x", margin.left - 8) // a little to the left of the first column
    .attr("y", d => yScale(d) + yScale.bandwidth() / 2) // vertically centered in each row
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 11)
    .attr("font-family", "monospace")
    .attr("fill", "#333")
    .text(d => MONTH_NAMES[d - 1]); // convert 1-based month to name
}

/**
 * drawLegend — draws a vertical color gradient bar on the right side
 * of the chart, with tick marks showing the temperature values it represents.
 *
 * The legend helps readers decode what each cell color means in °C.
 *
 * @param {d3.Selection} svg         - the root SVG element
 * @param {number}       totalWidth  - full SVG width in px
 * @param {number}       totalHeight - full SVG height in px
 * @param {object}       margin      - { top, right, bottom, left } in px
 */
function drawLegend(svg, totalWidth, totalHeight, margin) {
  const legendX  = totalWidth - margin.right + 20; // position just inside right margin
  const legendY  = margin.top + 20;
  const barWidth = 18;   // width of the colored rectangle
  const barHeight = 220; // height of the colored rectangle

  // Scale that maps temperature values to pixel positions along the bar
  const legendScale = d3.scaleLinear()
    .domain([TEMP_MIN_C, TEMP_MAX_C])
    .range([barHeight, 0]); // top of bar = hot, bottom = cold

  const legendAxis = d3.axisRight(legendScale)
    .tickValues([0, 10, 20, 30, 40])
    .tickFormat(d => `${d}`);

  // ── Define the vertical gradient in the SVG <defs> section ──
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("y1", "100%") // gradient runs bottom → top
    .attr("x2", "0%").attr("y2", "0%");

  // Add a color stop every 5°C so the gradient closely matches the cell colors
  d3.range(TEMP_MIN_C, TEMP_MAX_C + 1, 5).forEach(temp => {
    gradient.append("stop")
      .attr("offset", `${((temp - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C)) * 100}%`)
      .attr("stop-color", COLOR_SCALE(temp));
  });

  // ── Group to hold all legend elements, positioned at legendX, legendY ──
  const legendGroup = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  // The colored gradient bar itself
  legendGroup.append("rect")
    .attr("width", barWidth)
    .attr("height", barHeight)
    .style("fill", "url(#legend-gradient)");

  // Tick marks and numbers to the right of the bar
  legendGroup.append("g")
    .attr("transform", `translate(${barWidth}, 0)`)
    .call(legendAxis)
    .call(g => {
      g.select(".domain").remove(); // remove the vertical axis line
      g.selectAll("text")
        .attr("font-size", 10)
        .attr("font-family", "monospace");
    });

  // Label at the cool (top) end of the bar
  legendGroup.append("text")
    .attr("x", barWidth / 2).attr("y", -14)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "monospace")
    .attr("fill", COLOR_SCALE(TEMP_MIN_C))
    .text(`${TEMP_MIN_C} Celsius`);

  // Label at the hot (bottom) end of the bar
  legendGroup.append("text")
    .attr("x", barWidth / 2).attr("y", barHeight + 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "monospace")
    .attr("fill", COLOR_SCALE(TEMP_MAX_C))
    .text(`${TEMP_MAX_C} Celsius`);
}

/**
 * drawMiniChart — draws two small line charts inside a single matrix cell:
 *   - Green line  → daily maximum temperature
 *   - Light blue  → daily minimum temperature
 *
 * The x-axis maps to each day of the month (1 → last day).
 * The y-axis maps to the fixed temperature range (TEMP_MIN_C → TEMP_MAX_C),
 * keeping y scales consistent across all cells for fair visual comparison.
 *
 * @param {d3.Selection} g        - the <g> element for this cell
 * @param {object}       cellData - contains the days[] array for this month
 * @param {number}       bw       - cell width in px (from xScale.bandwidth())
 * @param {number}       bh       - cell height in px (from yScale.bandwidth())
 */
function drawMiniChart(g, cellData, bw, bh) {
  // Skip cells with no data (e.g. future months or missing data at end of dataset)
  if (!cellData.days.length) return;

  const p = MINI_CHART_PADDING;

  // X: maps day index (1-based) to horizontal pixel position within the cell
  const xScale = d3.scaleLinear()
    .domain([1, cellData.days.length])
    .range([p, bw - p]);

  // Y: maps temperature value to vertical pixel position
  // Range is inverted so that higher temperatures appear higher in the cell
  const yScale = d3.scaleLinear()
    .domain([TEMP_MIN_C, TEMP_MAX_C])
    .range([bh - p, p]);

  // Line generator for the daily maximum temperatures (green)
  const maxLine = d3.line()
    .x((d, i) => xScale(i + 1))
    .y(d => yScale(d.max))
    .curve(d3.curveCatmullRom); // smooth curve between data points

  // Line generator for the daily minimum temperatures (light blue)
  const minLine = d3.line()
    .x((d, i) => xScale(i + 1))
    .y(d => yScale(d.min))
    .curve(d3.curveCatmullRom);

  // Draw the max line in green
  g.append("path")
    .datum(cellData.days)
    .attr("d", maxLine)
    .attr("stroke", "rgba(80,180,80,0.85)")
    .attr("stroke-width", 1.2)
    .attr("fill", "none");

  // Draw the min line in light blue/white
  g.append("path")
    .datum(cellData.days)
    .attr("d", minLine)
    .attr("stroke", "rgba(200,220,255,0.85)")
    .attr("stroke-width", 1.2)
    .attr("fill", "none");
}

/**
 * drawMatrix — the main orchestration function that builds the entire
 * matrix visualization inside the given SVG element.
 *
 * It clears any previous render, computes scales, then calls the
 * specialized draw functions for axes, legend, cell backgrounds,
 * mini charts, and hover overlays.
 *
 * @param {object} params
 * @param {d3.Selection} params.svg         - root SVG element
 * @param {object[]}     params.cells       - flat array from buildCells()
 * @param {number[]}     params.years       - sorted year list
 * @param {string}       params.mode        - "max" or "min"
 * @param {Function}     params.onCellHover - mousemove handler for tooltip
 * @param {Function}     params.onCellLeave - mouseleave handler for tooltip
 * @param {number}       params.totalWidth  - SVG width in px
 * @param {number}       params.totalHeight - SVG height in px
 */
function drawMatrix({ svg, cells, years, mode, onCellHover, onCellLeave, totalWidth, totalHeight }) {
  // Clear previous render before drawing fresh (avoids element duplication)
  svg.selectAll("*").remove();

  // Usable drawing area after subtracting margins for axes and legend
  const chartWidth  = totalWidth  - MARGIN.left - MARGIN.right;
  const chartHeight = totalHeight - MARGIN.top  - MARGIN.bottom;

  // X scale: each year gets an equal-width column band
  const xScale = d3.scaleBand()
    .domain(years)
    .range([MARGIN.left, MARGIN.left + chartWidth])
    .padding(0.04); // small gap between columns

  // Y scale: each month (1–12) gets an equal-height row band
  const yScale = d3.scaleBand()
    .domain(d3.range(1, 13))
    .range([MARGIN.top, MARGIN.top + chartHeight])
    .padding(0.04); // small gap between rows

  // Draw supporting elements first (behind cells)
  drawAxes(svg, years, xScale, yScale, MARGIN);
  drawLegend(svg, totalWidth, totalHeight, MARGIN);

  // ── Build one <g> group per cell (year × month pair) ──
  // Only cells that have actual data are rendered; empty months are skipped.
  const cellGroups = svg.selectAll(".cell")
    .data(cells.filter(d => d.days.length > 0), d => `${d.year}-${d.month}`)
    .join("g")
    .attr("class", "cell")
    .attr("transform", d => `translate(${xScale(d.year)}, ${yScale(d.month)})`);

  const cellWidth  = xScale.bandwidth();
  const cellHeight = yScale.bandwidth();

  // ── Background rectangle ──
  // Color encodes the monthly peak max OR coldest min depending on current mode.
  // absMax / absMin represent the single extreme day, matching the reference tooltip.
  cellGroups.append("rect")
    .attr("width",  cellWidth)
    .attr("height", cellHeight)
    .attr("rx", 2) // slightly rounded corners
    .attr("fill", d => {
      const temp = mode === "max" ? d.absMax : d.absMin;
      return temp !== null ? COLOR_SCALE(temp) : "#eee"; // grey for missing data
    })
    .attr("stroke", "rgba(255,255,255,0.3)")
    .attr("stroke-width", 0.5);

  // ── Mini line chart inside each cell ──
  cellGroups.each(function(d) {
    drawMiniChart(d3.select(this), d, cellWidth, cellHeight);
  });

  // ── Transparent hover overlay ──
  // Sits on top of everything in the cell so it captures mouse events cleanly
  // without interfering with the visual elements underneath.
  cellGroups.append("rect")
    .attr("width",  cellWidth)
    .attr("height", cellHeight)
    .attr("fill", "transparent")
    .attr("cursor", "crosshair")
    .on("mousemove",  (event, d) => onCellHover(event, d, mode))
    .on("mouseleave", onCellLeave);
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT COMPONENT
// Manages state (mode, data, loading), wires up D3, and returns JSX.
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // DOM refs — give D3 direct access to the SVG and its container
  const svgRef       = useRef(null);
  const containerRef = useRef(null); // used to measure available pixel space
  const tooltipRef   = useRef(null);

  // "max" = show monthly peak max temperature; "min" = show coldest min
  const [mode,    setMode]    = useState("max");

  // Processed data from the CSV
  const [cells,   setCells]   = useState([]);
  const [years,   setYears]   = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Load and parse the CSV exactly once on mount ──
  useEffect(() => {
    d3.csv("/temperature_daily.csv")
      .then(raw => {
        const rows               = parseRows(raw);
        const { grouped, years } = buildGrouped(rows);
        const cells              = buildCells(grouped, years);
        setCells(cells);
        setYears(years);
        setLoading(false);
      })
      .catch(err => {
        // Show a human-readable error if the file is missing or malformed
        setError(err.message);
        setLoading(false);
      });
  }, []); // empty deps = run once

  // ── Tooltip: show on cell hover ──
  // useCallback prevents re-creating this function on every render,
  // which would cause the ResizeObserver draw loop to fire unnecessarily.
  const handleCellHover = useCallback((event, d, currentMode) => {
    const tip = tooltipRef.current;
    if (!tip) return;

    // Show the monthly extreme value that matches the current viewing mode
    const temp  = currentMode === "max" ? d.absMax : d.absMin;
    const label = currentMode === "max" ? "max" : "min";

    tip.style.visibility = "visible";
    tip.style.left = (event.pageX + 14) + "px";
    tip.style.top  = (event.pageY - 10) + "px";
    tip.innerHTML  =
      `<strong>Date:</strong> ${d.year}-${String(d.month).padStart(2, "0")}<br/>` +
      `<strong>${label}:</strong> ${temp !== null ? temp.toFixed(1) : "N/A"} °C`;
  }, []);

  // ── Tooltip: hide when mouse leaves a cell ──
  const handleCellLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.visibility = "hidden";
  }, []);

  // ── Draw / redraw when data or mode changes ──
  useEffect(() => {
    if (!cells.length || !svgRef.current || !containerRef.current) return;

    // Inner render function — also used by the ResizeObserver below
    const render = () => {
      if (!containerRef.current) return;

      // Measure the flex container so the SVG fills it exactly (no scrollbar)
      const { width: totalWidth, height: totalHeight } =
        containerRef.current.getBoundingClientRect();

      d3.select(svgRef.current)
        .attr("width",  totalWidth)
        .attr("height", totalHeight);

      drawMatrix({
        svg: d3.select(svgRef.current),
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

    // Re-draw automatically if the browser window is resized
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect(); // clean up on unmount
  }, [cells, years, mode, handleCellHover, handleCellLeave]);

  // Switches between "max" and "min" viewing modes
  const toggleMode = () => setMode(current => current === "max" ? "min" : "max");

  // ── JSX ──
  return (
    // Full-viewport wrapper, background matches the page color
    <div
      style={{
        fontFamily:     "monospace",
        background:     "#f7f4ef",
        width:          "100vw",
        height:         "100vh",
        overflow:       "hidden",   
        boxSizing:      "border-box",
        display:        "flex",
        flexDirection:  "column",
      }}
    >
      <div
        style={{
          width:         "100%",
          height:        "100%",
          boxSizing:     "border-box",
          padding:       "16px 32px",
          display:       "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            marginBottom:   10,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            20,
            flexShrink:     0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#222", letterSpacing: 1 }}>
            Hong Kong Monthly Temperature
          </h2>

          {/*
           * Toggle button — clicking this is the ONLY way to switch modes.
           * Background color changes to signal which mode is active:
           *   Red   = Max temperature view
           *   Blue  = Min temperature view
           */}
          <button
            onClick={toggleMode}
            title="Click to switch between Max and Min temperature"
            style={{
              padding:      "6px 18px",
              background:   mode === "max" ? "#c0392b" : "#2980b9",
              color:        "#fff",
              border:       "none",
              borderRadius: 4,
              cursor:       "pointer",
              fontFamily:   "monospace",
              fontSize:     13,
              fontWeight:   "bold",
              letterSpacing: 0.5,
              transition:   "background 0.3s",
            }}
          >
            Showing: {mode === "max" ? "Max Temperature ▲" : "Min Temperature ▼"}
          </button>

          <span style={{ fontSize: 12, color: "#666" }}>
            (Click button to toggle Max / Min)
          </span>
        </div>

        {/* Loading and error states */}
        {loading && <p style={{ color: "#888" }}>Loading data…</p>}
        {error   && <p style={{ color: "red"  }}>Error loading CSV: {error}</p>}

        {/* ── SVG container — flex:1 so it fills all remaining vertical space ── */}
        {!loading && !error && (
          <div
            ref={containerRef}
            style={{
              flex:      1,
              minHeight: 0,    
              width:     "100%",
            }}
          >
            <svg
              ref={svgRef}
              style={{
                background: "transparent", // page bg shows through for empty cells
                display:    "block",
                width:      "100%",
                height:     "100%",
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop:  8,
            fontSize:   11,
            color:      "#555",
            display:    "flex",
            gap:        18,
            flexShrink: 0,
          }}
        >
          <span>
            {/* Green line swatch */}
            <svg width="24" height="8">
              <line x1="0" y1="4" x2="24" y2="4"
                stroke="rgba(80,180,80,0.9)" strokeWidth="2" />
            </svg>
            {" "}Daily Max
          </span>
          <span>
            {/* Light blue line swatch */}
            <svg width="24" height="8">
              <line x1="0" y1="4" x2="24" y2="4"
                stroke="rgba(200,220,255,0.9)" strokeWidth="2" />
            </svg>
            {" "}Daily Min
          </span>
        </div>
      </div>

      {/*
       * Tooltip div — rendered outside the SVG so it can overlap any element.
       * Positioned with fixed coordinates based on mouse position.
       * pointerEvents: none prevents it from interfering with hover detection.
       */}
      <div
        ref={tooltipRef}
        style={{
          position:      "fixed",
          visibility:    "hidden",
          background:    "rgba(255,255,255,0.97)",
          border:        "1px solid #ccc",
          borderRadius:  4,
          padding:       "6px 10px",
          fontSize:      12,
          fontFamily:    "monospace",
          color:         "#222",
          pointerEvents: "none",
          boxShadow:     "0 2px 8px rgba(0,0,0,0.15)",
          zIndex:        9999,
          lineHeight:    1.6,
        }}
      />
    </div>
  );
}