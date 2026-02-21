# 🌡️ Hong Kong Monthly Temperature Matrix

A Matrix View visualization of Hong Kong's daily temperature data built with **React** and **D3.js**, created for CSCE679 Assignment 1.

---

## 📸 Preview
.src/assets/preview.png
.src/assets/preview1.png
---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| [React](https://react.dev/) | UI framework |
| [D3.js](https://d3js.org/) | Data visualization |
| [Vite](https://vitejs.dev/) | Build tool & dev server |

---

## 📁 Project Structure

```
hongkong-temp-matrix/
├── public/
│   └── temperature_daily.csv     # Raw temperature dataset
├── src/
│   ├── App.jsx                   # Root component — imports TemperatureMatrix
│   ├── TemperatureMatrix.jsx     # Main visualization component
│   └── main.jsx                  # React entry point
├── index.css                     # Global CSS reset (no scrollbars)
├── index.html
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)

Check your versions:
```bash
node -v
npm -v
```

---

### Installation & Setup

**1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/hongkong-temp-matrix.git
cd hongkong-temp-matrix
```

**2. Install dependencies**
```bash
npm install
```

**3. Install D3.js** (if not already in package.json)
```bash
npm install d3
```

**4. Run the development server**
```bash
npm run dev
```

**5. Open in browser**
```
http://localhost:5173
```

---

## 📊 Dataset

- **File:** `public/temperature_daily.csv`
- **Source:** Hong Kong Observatory daily temperature records
- **Range:** 1997–2017 (visualization focuses on last 10 years)
- **Columns:**
  | Column | Description |
  |--------|-------------|
  | `date` | Date in `YYYY-MM-DD` format |
  | `max_temperature` | Daily maximum temperature (°C) |
  | `min_temperature` | Daily minimum temperature (°C) |

> **Note:** Data ends on 2017-10-28, so November and December 2017 are intentionally empty — this matches the original dataset.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Matrix Layout** | X-axis = Year, Y-axis = Month (last 10 years) |
| **Color Encoding** | Blue (0°C) → Yellow → Orange → Dark Red (40°C) |
| **Toggle Max/Min** | Click the button in the header to switch views |
| **Tooltip** | Hover over any cell to see date and temperature |
| **Mini Line Charts** | Green line = daily max, Light blue = daily min |
| **Color Legend** | Gradient bar on the right maps colors to °C values |
| **Responsive** | SVG auto-resizes to fill the browser window |

---

## 🧱 Code Architecture

The code is split into clearly named, modular functions:

```
parseRows()       → Parses raw CSV into clean daily records
buildGrouped()    → Filters last 10 years, groups by year → month
buildCells()      → Builds flat array of cell data for D3

drawAxes()        → Renders year (top) and month (left) labels
drawLegend()      → Renders the color gradient legend on the right
drawMiniChart()   → Draws the daily max/min line chart inside each cell
drawMatrix()      → Orchestrates the full SVG render
```

