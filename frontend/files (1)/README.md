# AQUA — نظام الري الذكي
## Smart Irrigation Dashboard

### Setup

1. Copy all files into your Next.js project root
2. Install dependencies:
```bash
npm install
```
3. Make sure Tailwind CSS is set up (Next.js default includes it)
4. Run the dev server:
```bash
npm run dev
```

### File Structure
```
app/
  layout.jsx        ← Root layout with Arabic font (Tajawal) + RTL
  page.jsx          ← Main dashboard page
  globals.css       ← Base styles + Tailwind imports

components/
  Sidebar.jsx       ← Left sidebar (desktop) + bottom nav (mobile)
  StatusBanner.jsx  ← Big status banner (green/orange/red)
  StatsRow.jsx      ← 4 KPI cards (water saved, energy, temp, zones)
  ZoneGrid.jsx      ← 8 zone cards with tap-to-expand details
  AlertPanel.jsx    ← Recent alerts with mark-as-read actions

tailwind.config.js  ← Tajawal font config
```

### Design Decisions for Non-Educated Users
- 🟢🟡🔴 color coding — no text needed to understand status
- Big emoji icons on every card — visual scanning not reading
- Arabic primary, French secondary — bilingual for all generations
- Toggle switches for ON/OFF — familiar interaction
- "Tap for details" pattern — progressive disclosure, not overwhelming
- Alert panel with clear action buttons — farmer knows exactly what to do

### Customization
- Change farm name in `Sidebar.jsx` line 40
- Update zone names/crops in `ZoneGrid.jsx` ZONES array
- Connect real sensor data by replacing mock values with API calls
- Add `next-intl` for proper i18n if needed
