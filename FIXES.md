# SoussFlow — Fixes & Improvements

> Applied on: 2026-06-12  
> Branch: `claude/awesome-feynman-mmtmat`

---

## 🔐 Security Fixes

### 1. Removed unauthenticated debug endpoint
**File:** `backend/app/routes/auth_routes.py`

The `GET /api/auth/debug-user/{username}` endpoint required **no authentication** and
returned the first 20 characters of a user's password hash along with their role and
active status. This was removed entirely.

### 2. Removed verbose password-verification log
**File:** `backend/app/routes/auth_routes.py`

`logger.info(f"Password verification result: {password_verified}")` logged a boolean
that, combined with timing information, could assist brute-force analysis. Line removed.

### 3. CORS — wildcard origin now disables credentials
**File:** `backend/main.py`

Adding `allow_credentials=True` together with `allow_origins=["*"]` violates the CORS
specification and is blocked by browsers anyway. The middleware now detects a wildcard
origin and automatically sets `allow_credentials=False`, logging a warning so operators
know to restrict `ALLOWED_ORIGINS` in production.

---

## ⚡ Performance & Storage Fixes

### 4. IoT data retention worker (new)
**File:** `backend/app/workers/retention_worker.py`

`IOT_DATA_RETENTION_DAYS` (default: 90) was already in `config.py` but never enforced.
A new background worker now runs every 24 hours and deletes rows older than the
configured retention period from all IoT reading tables:

- `iot_readings`
- `environment_readings`
- `infrastructure_readings`
- `branch_flow_readings`
- `soil_moisture_readings`
- `zone_health_readings`

The worker starts 60 seconds after application boot to avoid contention during startup,
and is registered in the FastAPI lifespan alongside the existing baseline and health workers.

### 5. Eliminated N+1 database queries in `get_farm_zones()`
**File:** `backend/main.py`

The SSE event loop called `get_farm_zones()` every 2 seconds. The previous
implementation issued **one query per zone** to fetch branches (N+1 pattern). It now
uses a single Supabase nested-select:

```python
supabase.table("zones").select(
    "id, zone_number, name, is_active, branches(id, branch_number, name)"
).eq("farm_id", farm_id).eq("is_active", True).execute()
```

This reduces database round-trips from `1 + N` to `1` per SSE tick.

### 6. SSE reconnect uses exponential backoff
**File:** `frontend/src/lib/hooks/useSSE.ts`

The previous implementation reconnected with a fixed 5-second delay regardless of how
many failures had occurred, risking rapid-fire connections if the backend is unavailable.
Reconnect delay now starts at 2 seconds and doubles on each failure, capped at 60 seconds.
A successful connection resets the counter.

---

## 🐛 Bug Fixes

### 7. StatsRow — stats now use correct SSE data fields
**File:** `frontend/src/components/StatsRow.tsx`

The component previously read from `state.iot.readings` (the legacy flat array), which
was derived indirectly from zone data. It now reads directly from:

- `state.iot.zones` — for zone count and health score
- `state.iot.environment` — for air temperature
- `state.iot.infrastructure` — for reservoir level

### 8. StatsRow — misleading icons and labels corrected
**File:** `frontend/src/components/StatsRow.tsx`  
**Files:** `frontend/messages/fr.json`, `frontend/messages/ar.json`

| Before | After |
|--------|-------|
| `Battery` icon + "Énergie solaire" | `Heart` icon + "Santé du système" |
| "Eau économisée" (water saved) | "Niveau réservoir" (reservoir level) |
| "Température sol" | "Température air" (actual data source) |

The health-score card previously displayed a `Battery` icon and was labelled "Solar
Energy" in French and "الطاقة الشمسية" in Arabic — none of which relates to the actual
metric being shown (system health score derived from zone readings).

### 9. StatsRow — removed hardcoded fake trends
**File:** `frontend/src/components/StatsRow.tsx`

`getTrend()` returned hardcoded strings (`"+2.1%"`, `"-5%"`, `"+1"`) regardless of
actual historical data. These were unconditionally displayed as real comparisons vs.
yesterday, which was misleading. The trend badges have been replaced by live status
dots (green / amber pulsing / red pulsing) derived from actual thresholds.

### 10. StatusBanner — uses zone data, not legacy readings
**File:** `frontend/src/components/StatusBanner.tsx`

The banner previously derived status from `state.iot.readings` (legacy). It now uses:

- `state.iot.zones` — to detect leaks and dry zones
- `state.iot.anomalyCount` — unacknowledged anomaly count from SSE payload

### 11. AlertPanel — uses zone data, not legacy readings
**File:** `frontend/src/components/AlertPanel.tsx`

Alert generation now iterates over `state.iot.zones` (the authoritative live data)
instead of the legacy derived readings array. Leak detection is based on
`zone.leak_count > 0`; moisture thresholds use `zone.avg_moisture_pct`.

### 12. Sidebar — alert badge now shows real anomaly count
**File:** `frontend/src/components/Sidebar.tsx`

The badge on the Alerts nav item was hardcoded to `2`. It now reads
`state.iot.anomalyCount` (populated every SSE tick from the backend query) and only
renders when the count is greater than zero.

### 13. System Health page enabled in navigation
**File:** `frontend/src/components/Sidebar.tsx`

The System Health menu entry was commented out. It is now visible in both the desktop
sidebar and the mobile "more" sheet.

### 14. ZoneGrid — no-data message uses i18n translations
**File:** `frontend/src/components/ZoneGrid.tsx`  
**Files:** `frontend/messages/fr.json`, `frontend/messages/ar.json`

The "No zone data available. Make sure the simulator is running." message was
hardcoded in English. It now uses the `ZoneGrid.no_data` translation key with proper
French and Arabic translations.

### 15. SSE generator — errors are now logged
**File:** `backend/main.py`

The `event_generator()` caught all exceptions with `except Exception: pass`, making
runtime errors in the SSE loop completely invisible. Errors are now logged at WARNING
level via Loguru.

### 16. ML anomaly service — uses settings instead of `os.getenv`
**File:** `backend/app/services/ml_anomaly_service.py`  
**File:** `backend/app/config.py`

`detect_ml_anomalies()` used `os.getenv("ML_ANOMALY_ENABLED", "false")` in isolation
from the rest of the configuration system. It now reads from `get_settings()`, and
`ML_ANOMALY_ENABLED: bool = False` has been added to the `Settings` model so the flag
is properly typed, validated, and documented.

### 17. Sidebar — unused `Globe` import removed
**File:** `frontend/src/components/Sidebar.tsx`

`Globe` was imported from `lucide-react` but never used in the component, adding
unnecessary bundle weight.

---

## Summary Table

| # | Category | File(s) | Impact |
|---|----------|---------|--------|
| 1 | Security | `auth_routes.py` | Removes unauthenticated hash exposure |
| 2 | Security | `auth_routes.py` | Removes sensitive logging |
| 3 | Security | `main.py` | CORS wildcard + credentials guard |
| 4 | Storage | `workers/retention_worker.py`, `main.py` | Enforces 90-day data retention |
| 5 | Performance | `main.py` | N+1 → 1 DB query per SSE tick |
| 6 | Reliability | `useSSE.ts` | Exponential backoff on reconnect |
| 7 | Bug | `StatsRow.tsx` | Reads correct Redux state fields |
| 8 | UI | `StatsRow.tsx`, messages | Correct icons & labels |
| 9 | UI | `StatsRow.tsx` | Removes fake trend data |
| 10 | Bug | `StatusBanner.tsx` | Uses zone data for status |
| 11 | Bug | `AlertPanel.tsx` | Uses zone data for alerts |
| 12 | UI | `Sidebar.tsx` | Live anomaly badge |
| 13 | UI | `Sidebar.tsx` | System Health page accessible |
| 14 | i18n | `ZoneGrid.tsx`, messages | No-data message translated |
| 15 | Observability | `main.py` | SSE errors now logged |
| 16 | Code Quality | `ml_anomaly_service.py`, `config.py` | Consistent config usage |
| 17 | Code Quality | `Sidebar.tsx` | Remove dead import |
