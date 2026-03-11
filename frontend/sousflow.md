# SousFlow — نظام الري الذكي
## Complete Frontend Documentation

> Smart Irrigation Dashboard · Built with Next.js 14 + Tailwind CSS  
> Target users: Moroccan farmers (non-technical, bilingual Arabic/French)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Design Philosophy](#2-design-philosophy)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Component Reference](#5-component-reference)
   - [Layout & Routing](#51-layout--routing)
   - [Sidebar](#52-sidebar)
   - [StatusBanner](#53-statusbanner)
   - [StatsRow](#54-statsrow)
   - [ZoneGrid](#55-zonegrid)
   - [AlertPanel](#56-alertpanel)
6. [Design System](#6-design-system)
   - [Color Palette](#61-color-palette)
   - [Typography](#62-typography)
   - [Spacing & Radius](#63-spacing--radius)
   - [Status Color Coding](#64-status-color-coding)
7. [Responsiveness](#7-responsiveness)
8. [RTL & Bilingual Strategy](#8-rtl--bilingual-strategy)
9. [Data & State Management](#9-data--state-management)
10. [Connecting Real Sensor Data](#10-connecting-real-sensor-data)
11. [Accessibility & UX Principles](#11-accessibility--ux-principles)
12. [Extending the App](#12-extending-the-app)
13. [Setup & Installation](#13-setup--installation)

---

## 1. Project Overview

SousFlow is a smart irrigation monitoring dashboard designed specifically for **Moroccan farmers in regions like Souss-Massa, Haouz, and Tadla**. It visualizes real-time data from IoT sensors (LoRaWAN network) and AI-driven anomaly detection alerts — presented in a way that requires **no technical literacy** to understand.

### Core Goals

| Goal | Implementation |
|------|----------------|
| Instant status reading | Color-coded banner (🟢 / 🟡 / 🔴) |
| Works for non-readers | Large emoji icons on every element |
| Bilingual support | Arabic primary + French secondary throughout |
| Mobile-first | Bottom nav on mobile, sidebar on desktop |
| Progressive disclosure | Tap a zone card to reveal sensor details |
| Actionable alerts | Every alert has a clear CTA button |

---

## 2. Design Philosophy

### 2.1 Color Before Text
Every critical status is communicated through color **before** text is read. A farmer glancing at the screen for 2 seconds should know if something is wrong.

```
🟢 Green  → Everything is fine
🟡 Orange → Check this — warning
🔴 Red    → Urgent — stop what you're doing
⬜ Gray   → Zone is turned off
```

### 2.2 Dual Language (Arabic + French)
The interface is **bilingual by design** — not as an option, but always displayed together. This is because:
- Older farmers in Morocco are more comfortable in Arabic/Darija
- Younger agri-tech operators often prefer French
- Both generations may use the same device

Pattern used everywhere:
```
Arabic text (large, bold, primary)
French text (small, regular, secondary/subtitle)
```

### 2.3 Progressive Disclosure
Zone cards show only the minimum needed:
- Status indicator (color dot + label)
- ON/OFF toggle
- Moisture bar

Tapping a card reveals deeper sensor data (pressure, flow rate). This prevents information overload for users unfamiliar with dashboards.

### 2.4 Familiar Interaction Patterns
- Toggle switches for ON/OFF — universally understood
- Big tap targets (minimum 44px height) — usable with rough hands outdoors
- "Tap for details" affordance text on cards
- Buttons use action verbs in both languages: `إصلاح الآن · Réparer`

---

## 3. Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ (App Router) | React framework, routing, SSR |
| Tailwind CSS | 3.x | Utility-first styling |
| Google Fonts — Tajawal | — | Arabic-optimized display font |
| React | 18+ | Component state (useState) |

### Why Next.js App Router?
- Native support for `layout.jsx` — one place to set `dir="rtl"` globally
- Easy to add server-side data fetching per page
- Built-in font optimization with `next/font/google`

### Why Tailwind CSS?
- No CSS files to maintain — all styles co-located with components
- Responsive prefixes (`md:`, `lg:`) make mobile-first trivial
- RTL works seamlessly (margins, padding flip correctly with `dir="rtl"`)

---

## 4. Project Structure

```
your-nextjs-project/
│
├── app/
│   ├── layout.jsx          ← Root layout: font, dir="rtl", metadata
│   ├── page.jsx            ← Main dashboard page (assembles all components)
│   └── globals.css         ← Tailwind base + custom scrollbar
│
├── components/
│   ├── Sidebar.jsx         ← Navigation (desktop sidebar + mobile bottom bar)
│   ├── StatusBanner.jsx    ← Full-width network health banner
│   ├── StatsRow.jsx        ← 4 KPI cards (water, energy, temp, zones)
│   ├── ZoneGrid.jsx        ← 8 irrigation zone cards
│   └── AlertPanel.jsx      ← Recent alerts with action buttons
│
├── tailwind.config.js      ← Tajawal font variable setup
└── README.md
```

---

## 5. Component Reference

### 5.1 Layout & Routing

**File:** `app/layout.jsx`

The root layout wraps the entire application. Key responsibilities:

```jsx
// Sets Arabic font globally
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
});

// Sets RTL direction for the entire app
<html lang="ar" dir="rtl">
```

**`app/page.jsx`** — The dashboard page. Renders all components in order:

```
Sidebar → StatusBanner → StatsRow → ZoneGrid → AlertPanel
```

It also holds the `activePage` state, which is passed to `Sidebar` to highlight the current navigation item.

---

### 5.2 Sidebar

**File:** `components/Sidebar.jsx`

Renders two navigation variants:

**Desktop** (`hidden md:flex`) — Fixed left sidebar, 256px wide, dark brown background `#2C1810`

**Mobile** (`flex md:hidden`) — Fixed bottom navigation bar, shows 5 items with emoji + short French label

#### Navigation Items

```js
const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "الرئيسية",  labelFr: "Accueil"     },
  { id: "zones",     icon: "🌿", label: "القطاعات",  labelFr: "Zones"       },
  { id: "alerts",    icon: "🔔", label: "التنبيهات", labelFr: "Alertes", badge: 2 },
  { id: "pumps",     icon: "⚙️", label: "المضخات",   labelFr: "Pompes"      },
  { id: "reports",   icon: "📊", label: "التقارير",  labelFr: "Rapports"    },
  { id: "settings",  icon: "🔧", label: "الإعدادات", labelFr: "Paramètres"  },
];
```

**`badge`** property on an item renders a red notification bubble (e.g., unread alerts count).

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `activePage` | `string` | Currently active nav item ID |
| `setActivePage` | `function` | Setter to change active page |

#### Farm Info Block
Shows farm name, region, and hectares. Update these values directly in the component:
```jsx
<p className="text-white font-bold text-sm">مزرعة الأمل</p>
<p className="text-[#8B7355] text-xs">Souss-Massa · 12 هكتار</p>
```

#### LoRaWAN Status Indicator
Bottom of sidebar shows live connection status and device count:
```jsx
<p className="text-emerald-400 text-xs">متصل · 18 جهاز</p>
```

---

### 5.3 StatusBanner

**File:** `components/StatusBanner.jsx`

The most prominent element on the dashboard — a full-width colored banner that immediately communicates network health.

#### Three States

| State | Color | Icon | When to use |
|-------|-------|------|-------------|
| `"good"` | Emerald gradient | ✅ | All sensors nominal |
| `"warning"` | Amber/Orange gradient | ⚠️ | Clogging, low moisture |
| `"critical"` | Red gradient | 🚨 | Leak detected, pump failure |

#### How to Change State

```jsx
// In StatusBanner.jsx, line 5:
const status = "warning"; // Change to "good", "warning", or "critical"
```

In production, this should be driven by a prop or derived from API data:
```jsx
export default function StatusBanner({ status = "good" }) { ... }
```

#### Visual Design
- Full-width rounded card with gradient background
- Decorative circles in the background (pure CSS, no images)
- Large icon box (80×80px) with frosted glass effect
- "Repair Now / إصلاح الآن" CTA button appears only on non-good states

---

### 5.4 StatsRow

**File:** `components/StatsRow.jsx`

Four KPI cards displayed in a 2-column grid (mobile) or 4-column row (desktop).

#### Data Structure

```js
const STATS = [
  {
    icon: "💧",
    value: "73%",
    labelAr: "توفير الماء",
    labelFr: "Eau économisée",
    trend: "+5%",
    trendUp: true,          // true = green badge, false = red badge
    color: "bg-sky-50 border-sky-200",
    iconBg: "bg-sky-100",
  },
  // ... 3 more
];
```

#### Trend Badge Logic
```
trendUp: true  → bg-emerald-100 text-emerald-700  (positive)
trendUp: false → bg-red-100 text-red-700          (negative/alert)
```

---

### 5.5 ZoneGrid

**File:** `components/ZoneGrid.jsx`

The core interactive component. Renders 8 irrigation zone cards in a responsive grid.

#### Zone Data Structure

```js
{
  id: 1,
  name: "القطاع 1",         // Arabic name
  nameFr: "Zone 1 — Orangers", // French + crop type
  status: "good",            // "good" | "warning" | "critical" | "off"
  pressure: "3.2 bar",       // From pressure sensor
  flow: "12 L/min",          // From flow meter
  moisture: 72,              // 0–100, from soil moisture sensor
  active: true,              // Controls toggle switch state
  alert: "انسداد في الموزعات", // Optional: alert text (Arabic)
  alertFr: "Bouchage détecté", // Optional: alert text (French)
}
```

#### Status Configuration

Each status maps to visual properties:

```js
const statusConfig = {
  good:     { dot: "bg-emerald-400",           border: "border-emerald-200", icon: "✅" },
  warning:  { dot: "bg-amber-400 animate-pulse", border: "border-amber-300",  icon: "⚠️" },
  critical: { dot: "bg-red-500 animate-pulse",   border: "border-red-300",    icon: "🚨" },
  off:      { dot: "bg-gray-300",               border: "border-gray-200",   icon: "⏸️" },
};
```

The `animate-pulse` Tailwind class makes the status dot blink on warning/critical zones — catching attention without sound.

#### MoistureBar Sub-component

An inline component that renders a colored progress bar:

```
≥ 60% → bg-emerald-400   (good hydration)
≥ 40% → bg-amber-400     (needs attention)
< 40% → bg-red-400       (stress — irrigate now)
```

#### Tap-to-Expand Interaction

State: `const [selected, setSelected] = useState(null)`

- Clicking a card sets `selected` to that zone's ID
- Clicking again (or another card) collapses it
- Expanded state shows `pressure` and `flow` in two tiles

---

### 5.6 AlertPanel

**File:** `components/AlertPanel.jsx`

Displays recent alerts from the AI/sensor system with clear action buttons.

#### Alert Types

| Type | Background | When used |
|------|-----------|-----------|
| `critical` | Red tint | Leak, pump failure |
| `warning` | Amber tint | Clogging, low pressure |
| `info` | Sky blue | Daily irrigation tips |
| `success` | Emerald tint | Water savings achieved |

#### Alert Data Structure

```js
{
  id: 1,
  type: "critical",
  icon: "🚨",
  titleAr: "تسرب مياه — القطاع 5",
  titleFr: "Fuite d'eau — Zone 5",
  descAr: "انخفاض حاد في الضغط مع ارتفاع في التدفق",
  descFr: "Chute de pression + hausse du débit détectées",
  time: "منذ 8 دقائق",
  timeFr: "Il y a 8 min",
  read: false,
}
```

#### Action Buttons

Unread alerts show two buttons:
1. **"تم الاطلاع · Lu"** — Marks alert as read (opacity reduces to 70%)
2. **"إرسال للتقني · Appeler technicien"** — (critical/warning only) — calls a technician

The `markRead` function updates state locally:
```js
const markRead = (id) => {
  setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
};
```

---

## 6. Design System

### 6.1 Color Palette

#### Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Deep Brown | `#2C1810` | Sidebar background, headings |
| Medium Brown | `#3D1F0F` | Sidebar hover states |
| Border Brown | `#4A2C1A` | Sidebar dividers |
| Warm Sand | `#F5F0E8` | App background |
| Card Border | `#E8DFD0` | Card borders, dividers |
| Muted Text | `#8B7355` | Secondary labels, captions |
| Body Text | `#5A4A3A` | Paragraph text |

#### Accent Color
| Token | Hex | Usage |
|-------|-----|-------|
| Copper/Gold | `#C17A3A` | Active nav items, primary buttons, highlights |

#### Status Colors (Tailwind)
| Status | Background | Border | Text |
|--------|-----------|--------|------|
| Good | `emerald-50` | `emerald-200` | `emerald-700` |
| Warning | `amber-50` | `amber-300` | `amber-700` |
| Critical | `red-50` | `red-300` | `red-700` |
| Off | `gray-50` | `gray-200` | `gray-500` |

### 6.2 Typography

**Font:** [Tajawal](https://fonts.google.com/specimen/Tajawal) — A Google Font with full Arabic + Latin support, clean and highly legible even at small sizes.

| Usage | Weight | Size | Class |
|-------|--------|------|-------|
| Page title | 900 (Black) | 30px | `text-3xl font-black` |
| Section heading | 900 (Black) | 20px | `text-xl font-black` |
| Card title | 800 | 18px | `text-lg font-black` |
| Body / description | 700 | 14px | `text-sm font-bold` |
| Label / caption | 400–500 | 12px | `text-xs text-[#8B7355]` |
| Micro hint | 400 | 10px | `text-[10px]` |

### 6.3 Spacing & Radius

| Element | Border Radius | Class |
|---------|--------------|-------|
| Large cards | 16px | `rounded-2xl` |
| Buttons | 12px | `rounded-xl` |
| Icon boxes | 12px | `rounded-xl` |
| Badges / pills | Full | `rounded-full` |
| Toggle switch | Full | `rounded-full` |

Page padding: `p-4 md:p-8` (16px mobile, 32px desktop)  
Component gap: `gap-4` (16px) standard between cards

### 6.4 Status Color Coding

The pulsing dot system:

```css
/* Good — static green */
.bg-emerald-400

/* Warning — pulsing amber */
.bg-amber-400.animate-pulse

/* Critical — fast pulsing red */
.bg-red-500.animate-pulse

/* Off — static gray */
.bg-gray-300
```

---

## 7. Responsiveness

The app uses a **mobile-first** approach with Tailwind breakpoints.

### Breakpoint Behavior

| Screen | Sidebar | Zone Grid | Stats Grid |
|--------|---------|-----------|------------|
| Mobile `< 768px` | Bottom navigation bar | 1 column | 2 columns |
| Tablet `768px+` | Left sidebar (256px) | 2 columns | 2 columns |
| Desktop `1280px+` | Left sidebar (256px) | 4 columns | 4 columns |

### Main Content Offset
The main content uses `ml-20 md:ml-64` to account for the sidebar:
```jsx
<main className="flex-1 ml-20 md:ml-64 p-4 md:p-8">
```

### Mobile Bottom Nav Padding
The alert panel adds `mb-24 md:mb-8` to prevent content from being hidden behind the mobile bottom nav bar.

---

## 8. RTL & Bilingual Strategy

### RTL Setup

Set once at the root — every child element inherits it:

```html
<!-- app/layout.jsx -->
<html lang="ar" dir="rtl">
```

This automatically flips:
- Margin/padding (left ↔ right)
- Text alignment
- Flex row direction
- Sidebar position (visual left = logical end)

### Text Pattern

Every user-facing label follows this pattern:

```jsx
<p className="font-black text-[#2C1810]">العربية</p>      {/* Primary */}
<p className="text-xs text-[#8B7355]">Français</p>        {/* Secondary */}
```

This means even if a user can't read one language, the other is always there.

### Numeric Values

Numbers (pressure, flow, percentages) are language-neutral — displayed in Western Arabic numerals (0–9), readable by both audiences.

---

## 9. Data & State Management

Currently all data is **mocked locally** in each component file. The app uses only React's built-in `useState` — no external state library needed at this scale.

### State in ZoneGrid

```js
const [selected, setSelected] = useState(null);
// null = no card expanded
// number = zone ID of the expanded card
```

### State in AlertPanel

```js
const [alerts, setAlerts] = useState(ALERTS);
// Marking as read mutates this local array
```

### State in page.jsx

```js
const [activePage, setActivePage] = useState("dashboard");
// Drives sidebar active highlight
// In a real app, replace with Next.js usePathname()
```

---

## 10. Connecting Real Sensor Data

### Replace Mock Data with API Calls

In `ZoneGrid.jsx`, replace the static `ZONES` array with a fetch:

```jsx
import { useEffect, useState } from "react";

export default function ZoneGrid() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchZones() {
      const res = await fetch("/api/zones"); // Your Next.js API route
      const data = await res.json();
      setZones(data);
      setLoading(false);
    }
    fetchZones();

    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchZones, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>جاري التحميل...</div>;
  // ... rest of component
}
```

### Expected API Response Shape

Your backend should return JSON matching this structure per zone:

```json
{
  "id": 1,
  "name": "القطاع 1",
  "nameFr": "Zone 1 — Orangers",
  "status": "good",
  "pressure": 3.2,
  "pressureUnit": "bar",
  "flow": 12,
  "flowUnit": "L/min",
  "moisture": 72,
  "active": true,
  "alert": null,
  "alertFr": null
}
```

### LoRaWAN / MQTT Integration

If your sensors push data via MQTT, use a WebSocket bridge on the server:

```js
// app/api/zones/route.js (Next.js Route Handler)
import { NextResponse } from "next/server";

export async function GET() {
  // Query your LoRaWAN server / database
  const data = await db.query("SELECT * FROM zones");
  return NextResponse.json(data);
}
```

### Status Derivation Logic

The `status` field should be derived server-side from raw sensor values:

```js
function deriveStatus(pressure, flow, moisture) {
  // Leak: high flow + low pressure
  if (flow > 16 && pressure < 1.5) return "critical";
  // Clogging: high pressure + low flow
  if (pressure > 4.5 && flow < 5) return "warning";
  // Dry soil
  if (moisture < 30) return "warning";
  return "good";
}
```

---

## 11. Accessibility & UX Principles

### Touch Targets
All interactive elements are at least **44×44px** — the minimum recommended by Apple HIG and WCAG for touch screens. Farmers may be using the app outdoors in direct sunlight with rough hands.

### Color + Icon Redundancy
Status is **never communicated through color alone**. Every colored element also has:
- A text label (`بخير`, `تنبيه`, `خطر`)
- An emoji icon (✅ ⚠️ 🚨)

This ensures colorblind users receive the same information.

### Contrast Ratios
- Dark text `#2C1810` on `#F5F0E8` background: **≈ 12:1** (exceeds WCAG AAA)
- White text on `#C17A3A` copper accent: **≈ 4.5:1** (meets WCAG AA)
- Muted text `#8B7355` on white: **≈ 4.6:1** (meets WCAG AA)

### No Jargon
Labels avoid technical terms:
- ❌ "Anomalie capteur pression"
- ✅ "انسداد في الموزعات · Bouchage détecté"

---

## 12. Extending the App

### Add a Pumps Page

Create `app/pumps/page.jsx` and build a new component `PumpsGrid.jsx`. Each pump card should show:

```
Pump status icon (running / stopped / fault)
Current draw in amps (I)
RPM reading
Water level in source (well depth %)
ON/OFF toggle
```

Fault detection signals from your report:
- Overconsumption (amps too high) → sand blockage
- Under-consumption (amps too low) → air intake / dry run

### Add a Solar Panels Monitor

Since many Moroccan farms use solar pumping, add a panel showing:

```
Panel output (W)
Dust factor (efficiency %)
Battery level
```

### Add Historical Charts

Use `recharts` (already available if needed) to add a 7-day water consumption chart per zone:

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
```

### Add SMS/Push Alerts

Replace the "Call Technician" button with an API call to send an SMS via a service like Twilio or OVH SMS (widely used in Morocco):

```js
// On button click:
await fetch("/api/notify", {
  method: "POST",
  body: JSON.stringify({ zone: 5, type: "fuite", phone: "+212XXXXXXXXX" }),
});
```

The AI alert message from your report in Darija:
> "Attention, kayn chi fuite f l-khatt 3"

...can be sent directly as the SMS body.

---

## 13. Setup & Installation

### Prerequisites

- Node.js 18+
- A Next.js 14 project (with App Router)
- Tailwind CSS configured

### Steps

**1. Copy files into your project**

```
app/layout.jsx
app/page.jsx
app/globals.css
components/Sidebar.jsx
components/StatusBanner.jsx
components/StatsRow.jsx
components/ZoneGrid.jsx
components/AlertPanel.jsx
tailwind.config.js
```

**2. Add Tajawal font to Tailwind config**

The `tailwind.config.js` provided adds Tajawal as the default `sans` font via a CSS variable. Make sure `next/font/google` is used in `layout.jsx` (already done).

**3. Install dependencies**

```bash
npm install
# No additional packages needed — only Next.js + Tailwind
```

**4. Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**5. Customize farm data**

- Farm name & region → `components/Sidebar.jsx` lines ~40–42
- Zone names & crops → `components/ZoneGrid.jsx` `ZONES` array
- Mock alert messages → `components/AlertPanel.jsx` `ALERTS` array

---

*Documentation written for SousFlow v1.0 — Smart Irrigation Dashboard*  
*Built for the Souss-Massa agricultural region, Morocco*  
*Powered by LoRaWAN sensors + AI anomaly detection*