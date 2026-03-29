# SoussFlow — Anomaly Detection System: Extension Architecture

## Preface: What Already Exists vs What to Build

Before designing anything, here is the honest audit of the current codebase:

| Component | Status | Notes |
|-----------|--------|-------|
| `anomaly_events` table | ✅ Exists | Schema is good, needs taxonomy extension |
| `anomaly_service.py` | ✅ Exists | 5 algorithms: z_score, sudden_change, stuck_sensor, drift, correlation |
| `/api/anomalies/*` routes | ✅ Exists | Dashboard, list, acknowledge, inject |
| WhatsApp anomaly alerts | ✅ Exists | Fires on `auto_alert_sent = FALSE` |
| Branch-level `leak_detected` | ✅ Exists | Simple threshold: inlet > outlet by 0.5 LPM |
| `zone_health_readings.is_anomaly` | ✅ Exists | Boolean flag only, no type |
| Frontend anomaly UI | ⚠️ Partial | Only in `AlertsPage.tsx`, no dedicated health view |
| ML/statistical baselines | ❌ Missing | No persisted baselines, in-memory only |
| Anomaly type catalog | ❌ Missing | Free-text `anomaly_type` column, no standardization |
| Hydraulic correlation rules | ⚠️ Partial | 2 rules in correlation detector |
| Equipment anomaly detection | ❌ Missing | No pump degradation, no electrical analysis |
| System Health dashboard | ❌ Missing | No reliability score, no risk indicators |

> **Conclusion:** The scaffolding is real. The gaps are in depth of detection, data persistence, and product surface. We extend — we do not rewrite.

---

## 1. Irrigation Workflow Model

### Physical Layer → Data Layer → Decision Layer

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DRIP IRRIGATION WORKFLOW                         │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  BASIN / │    │   HEAD   │    │   MAIN   │    │  ZONE INLET  │  │
│  │RESERVOIR │───▶│ STATION  │───▶│PIPELINE  │───▶│  MANIFOLD   │  │
│  │          │    │          │    │          │    │              │  │
│  │tank_level│    │pump+valve│    │main_flow │    │branch_inlet  │  │
│  │          │    │+filter   │    │main_press│    │inlet_pressure│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────┬───────┘  │
│       │               │               │                  │          │
│  reservoir_level  pump_flow      main_pressure     inlet_flow      │
│  _pct             _lpm           _mpa              _lpm            │
│  [infrastructure] [infrastructure][infrastructure] [branch_flow]   │
│                                                          │          │
│                                              ┌──────────▼───────┐  │
│                                              │   DRIP LINES     │  │
│                                              │ (N per branch)   │  │
│                                              │outlet_flow_lpm   │  │
│                                              │outlet_pressure   │  │
│                                              │flow_delta_lpm    │  │
│                                              └──────────┬───────┘  │
│                                                         │          │
│                                              ┌──────────▼───────┐  │
│                                              │  SOIL / TREES    │  │
│                                              │moisture_start    │  │
│                                              │moisture_middle   │  │
│                                              │moisture_end      │  │
│                                              │uniformity_coef   │  │
│                                              └──────────┬───────┘  │
│                                                         │          │
│  ┌──────────────────────────────────────────────────────▼───────┐  │
│  │                    ZONE HEALTH AGGREGATE                      │  │
│  │  avg_soil_moisture │ water_efficiency_pct │ leak_count       │  │
│  │  stress_score      │ health_score         │ is_anomaly       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  ENVIRONMENT LAYER (shared)                   │  │
│  │  air_temp │ humidity │ solar_radiation │ wind │ precipitation  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  DECISION LAYER (ANOMALY DETECTION ONLY)            │
│                                                                     │
│  Rule-Based    Statistical    Correlation    Time-Series   ML       │
│  Detectors  ─▶ Baselines  ─▶ Engine      ─▶ Patterns  ─▶ Scoring  │
│                                                                     │
│  Output: anomaly_events rows with type, severity, confidence, zone  │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         WhatsApp         alert_history   SSE stream
         alerts           (existing)      /api/events
```

### Data Flow (grounded in actual tables)

| Stage | Table Written | Key Computed Fields |
|-------|--------------|---------------------|
| 1. Ingest | `environment_readings` | weather values |
| 2. Ingest | `infrastructure_readings` | `filter_status`, `main_pump_flow_lpm` |
| 3. Ingest | `branch_flow_readings` | `flow_delta_lpm`, `leak_detected` |
| 4. Ingest | `soil_moisture_readings` | `uniformity_coefficient`, `avg_moisture_pct` |
| 5. Aggregate | `zone_health_readings` | `water_efficiency_pct`, `stress_score`, `health_score`, `is_anomaly` |
| 6. Detect | `anomaly_events` | `anomaly_type`, `severity`, `details` JSONB |
| 7. Alert | `alert_history` | triggered rules |

### Where Anomaly Detection Lives

```
iot_service.ingest_batch()
    └── asyncio.create_task(anomaly_service.analyze_reading_batch())
                                    │
                    ┌───────────────┴───────────────┐
                    │     anomaly_service.py        │
                    │                               │
                    │  1. z_score_detector()        │
                    │  2. sudden_change_detector()  │
                    │  3. stuck_sensor_detector()   │
                    │  4. drift_detector()          │
                    │  5. correlation_detector()    │
                    │                               │
                    │  NEW:                         │
                    │  6. hydraulic_detector()      │
                    │  7. equipment_detector()      │
                    │  8. agronomic_detector()      │
                    └───────────────────────────────┘
```

> **Critical architectural rule** (already respected in code): `anomaly_service` does **NOT** call `device_control_routes`. It only writes `anomaly_events`. Irrigation scheduling lives in `iot_service` (threshold-based) and `device_control_routes` (manual). These are separate code paths and must remain so.

---

## 2. Anomaly Taxonomy

The existing `anomaly_type` column is a free-text string. We standardize it with a catalog of **32 types across 4 domains**.

```
HYDRAULIC
├── LEAK_BRANCH           — inlet_flow >> outlet_flow on a branch
├── LEAK_ZONE             — zone total inlet >> total outlet across branches
├── PIPE_BURST            — sudden extreme flow spike + pressure drop
├── DRIPPER_CLOG_PARTIAL  — flow_delta rising trend + low uniformity_coef
├── DRIPPER_CLOG_SEVERE   — outlet_flow near zero, inlet normal
├── FILTER_CLOG_EARLY     — inlet_pressure rising vs outlet stable
├── FILTER_CLOG_CRITICAL  — pressure differential above threshold
├── VALVE_STUCK_OPEN      — flow present when zone should be off
├── VALVE_STUCK_CLOSED    — no flow when zone active in schedule
├── PRESSURE_ANOMALY_LOW  — main_pressure_mpa below minimum
└── PRESSURE_ANOMALY_HIGH — main_pressure_mpa above maximum

AGRONOMIC
├── OVER_IRRIGATION       — soil moisture >> target + zone active
├── UNDER_IRRIGATION      — soil moisture << target + zone inactive too long
├── UNEVEN_ZONE           — uniformity_coefficient below threshold
├── WATERLOGGING_RISK     — moisture_end much higher than moisture_start
├── ROOT_ZONE_DRY         — moisture_middle low while edges ok
├── STRESS_SPIKE          — stress_score sudden jump without temp cause
└── YIELD_RISK_HEAT       — sustained air_temp above threshold + stress

EQUIPMENT
├── PUMP_DEGRADATION          — main_pump_flow declining trend over sessions
├── PUMP_FAILURE_IMMINENT     — flow_lpm drop + pressure drop simultaneously
├── PUMP_CAVITATION           — pressure oscillation pattern
├── RESERVOIR_CRITICAL        — reservoir_level below critical threshold
├── RESERVOIR_LEAK            — level drops when no irrigation active
└── SENSOR_COMMUNICATION_LOSS — missing data for N consecutive intervals

DATA
├── SENSOR_FROZEN        — stuck_sensor: identical values N times
├── SENSOR_DRIFT         — slow systematic drift from baseline
├── IMPOSSIBLE_VALUE     — reading outside physical bounds
├── MISSING_DATA         — gap in time series
├── CROSS_SENSOR_CONFLICT— moisture high but flow zero (impossible combo)
└── CLOCK_DRIFT          — timestamp anomaly vs server time
```

---

## 3. Database Schema Extensions

The `anomaly_events` table exists. We make **minimal surgical additions** — 3 new tables, 1 altered table. No existing tables removed or restructured.

### 3.1 Anomaly Type Catalog Table

```sql
CREATE TABLE anomaly_types (
    code TEXT PRIMARY KEY,
    domain TEXT NOT NULL CHECK (domain IN ('hydraulic', 'agronomic', 'equipment', 'data')),
    display_name TEXT NOT NULL,
    description TEXT,
    default_severity TEXT NOT NULL CHECK (default_severity IN ('low', 'medium', 'high', 'critical')),
    recommended_action TEXT,
    documentation_url TEXT
);
```

Seeded with all 32 types above. `anomaly_events.anomaly_type` is validated against this catalog at the application level (no FK constraint to avoid breaking existing rows).

### 3.2 Extend `anomaly_events` Table

```sql
-- All columns NULLABLE to avoid breaking existing rows
ALTER TABLE anomaly_events
    ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS baseline_value FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS actual_value FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS false_positive BOOLEAN DEFAULT FALSE;
```

### 3.3 Statistical Baselines Table

This is the key missing piece — persisted rolling baselines so detectors survive restarts and improve over time.

```sql
CREATE TABLE sensor_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    window_hours INTEGER NOT NULL DEFAULT 168,  -- 7-day rolling window
    mean FLOAT NOT NULL,
    std_dev FLOAT NOT NULL,
    min_val FLOAT NOT NULL,
    max_val FLOAT NOT NULL,
    p5 FLOAT,
    p95 FLOAT,
    sample_count INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, zone_id, branch_id, column_name, window_hours)
);

CREATE INDEX idx_baselines_lookup ON sensor_baselines (farm_id, column_name) WHERE zone_id IS NULL;
CREATE INDEX idx_baselines_zone ON sensor_baselines (farm_id, zone_id, column_name);
```

### 3.4 Farm Health Score History

```sql
CREATE TABLE farm_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hydraulic_health_score FLOAT,
    agronomic_health_score FLOAT,
    equipment_health_score FLOAT,
    data_quality_score FLOAT,
    overall_score FLOAT,
    active_anomalies_critical INTEGER DEFAULT 0,
    active_anomalies_high INTEGER DEFAULT 0,
    active_anomalies_medium INTEGER DEFAULT 0,
    active_anomalies_low INTEGER DEFAULT 0,
    zones_at_risk UUID[],
    UNIQUE(farm_id, DATE_TRUNC('hour', snapshot_at))
);
```

---

## 4. ML + Detection Strategy

### Detection Tiers (ordered by implementation priority)

#### Tier 1 — Hydraulic Rule-Based (Week 1, no ML dependencies)

Pure physics. No training data required.

**Branch Leak Detector** — extends existing `leak_detected` boolean:

```python
# backend/app/services/hydraulic_detector.py
def detect_branch_leak(branch_readings: list[dict], baselines: dict) -> list[AnomalyEvent]:
    anomalies = []
    for r in branch_readings:
        if not r.get("valve_open"):
            continue  # skip closed branches

        inlet = r.get("inlet_flow_lpm", 0)
        outlet = r.get("outlet_flow_lpm", 0)
        delta = inlet - outlet

        if delta <= 0 or inlet == 0:
            continue

        loss_pct = (delta / inlet) * 100

        if loss_pct > 25:
            severity = "critical" if loss_pct > 50 else "high"
            anomalies.append(AnomalyEvent(
                anomaly_type="LEAK_BRANCH",
                severity=severity,
                confidence_score=min(loss_pct / 50, 1.0),
                actual_value=delta,
                details={
                    "inlet_flow_lpm": inlet,
                    "outlet_flow_lpm": outlet,
                    "loss_pct": round(loss_pct, 1),
                    "branch_id": r["branch_id"],
                }
            ))
    return anomalies
```

**Filter Clog Detector:**

```python
def detect_filter_clog(infra_readings: list[dict]) -> list[AnomalyEvent]:
    # Signature: inlet pressure RISING while pump flow FALLING
    if len(infra_readings) < 10:
        return []

    recent = infra_readings[-10:]
    pressure_trend = linear_slope([r["main_pressure_mpa"] for r in recent])
    flow_trend = linear_slope([r["main_pump_flow_lpm"] for r in recent])

    if pressure_trend > 0.002 and flow_trend < -0.5:
        return [AnomalyEvent(
            anomaly_type="FILTER_CLOG_EARLY",
            severity="medium",
            details={"pressure_trend": pressure_trend, "flow_trend": flow_trend}
        )]
    return []
```

**Valve Stuck Open Detector:**

```python
def detect_valve_stuck_open(zone_health: dict, control_states: dict) -> AnomalyEvent | None:
    zone_id = zone_health["zone_id"]
    expected_open = control_states.get(str(zone_id), {}).get("valve_open", False)
    actual_flow = zone_health.get("total_inlet_flow_lpm", 0)

    if not expected_open and actual_flow > 2.0:
        return AnomalyEvent(
            anomaly_type="VALVE_STUCK_OPEN",
            severity="high",
            details={"expected": "closed", "actual_flow_lpm": actual_flow}
        )
```

#### Tier 2 — Statistical Baselines (Week 2-3)

Uses `sensor_baselines` table. Hourly background job computes and persists rolling statistics.

```python
# backend/app/services/baseline_service.py
async def compute_baselines(farm_id: str):
    windows = [24, 168]  # 1-day and 7-day windows

    for column in MONITORED_COLUMNS:
        table = COLUMN_TO_TABLE[column]
        data = await fetch_column_window(farm_id, table, column, hours=168)

        if len(data) < 20:
            continue  # insufficient data

        stats = {
            "mean": statistics.mean(data),
            "std_dev": statistics.stdev(data),
            "min_val": min(data),
            "max_val": max(data),
            "p5": percentile(data, 5),
            "p95": percentile(data, 95),
            "sample_count": len(data),
        }
        await upsert_baseline(farm_id, column, stats)
```

Enhanced Z-score using persisted baselines instead of in-memory window:

```python
def detect_zscore_with_baseline(value: float, baseline: dict, column: str) -> tuple[bool, float]:
    if baseline["std_dev"] == 0:
        return False, 0.0
    z = abs(value - baseline["mean"]) / baseline["std_dev"]
    threshold = COLUMN_ZSCORE_THRESHOLDS.get(column, 3.0)
    return z > threshold, round(z, 2)
```

#### Tier 3 — Multi-Sensor Correlation (Week 3, extends existing 2 rules → 8)

```python
CORRELATION_RULES = [
    {
        "name": "PIPE_BURST",
        "description": "Simultaneous: extreme flow spike + severe pressure drop",
        "conditions": {
            "main_pump_flow_lpm": {"change_pct": ">50"},
            "main_pressure_mpa": {"change_pct": "<-40"},
        },
        "time_window_minutes": 5,
        "severity": "critical",
        "confidence": 0.90,
    },
    {
        "name": "PUMP_FAILURE_IMMINENT",
        "description": "Pump flow declining + pressure declining over 30 min",
        "conditions": {
            "main_pump_flow_lpm": {"trend": "falling", "trend_window": 30},
            "main_pressure_mpa": {"trend": "falling", "trend_window": 30},
        },
        "severity": "high",
        "confidence": 0.75,
    },
    {
        "name": "DRIPPER_CLOG_PARTIAL",
        "description": "Outlet flow below expected + low uniformity coefficient",
        "conditions": {
            "outlet_flow_lpm": {"below_baseline_pct": 20},
            "uniformity_coefficient": {"below": 0.75},
        },
        "severity": "medium",
        "confidence": 0.80,
    },
    {
        "name": "OVER_IRRIGATION",
        "description": "Zone active + soil moisture already above optimal",
        "conditions": {
            "valve_open": {"equals": True},
            "avg_soil_moisture_pct": {"above": 60},
        },
        "severity": "low",
        "confidence": 0.85,
    },
    {
        "name": "CROSS_SENSOR_CONFLICT",
        "description": "Valve open + zero flow (physical impossibility)",
        "conditions": {
            "valve_open": {"equals": True},
            "zone_flow_lpm": {"below": 0.1},
        },
        "severity": "high",
        "confidence": 0.95,
    },
    {
        "name": "RESERVOIR_LEAK",
        "description": "Level drops significantly with no active irrigation zones",
        "conditions": {
            "reservoir_level_pct": {"trend": "falling", "trend_window": 60},
            "active_zones_count": {"equals": 0},
        },
        "severity": "high",
        "confidence": 0.80,
    },
    {
        "name": "UNEVEN_ZONE",
        "description": "High variance in moisture across positions within branch",
        "conditions": {"uniformity_coefficient": {"below": 0.65}},
        "severity": "medium",
        "confidence": 0.85,
    },
    {
        "name": "WATERLOGGING_RISK",
        "description": "moisture_end significantly higher than moisture_start",
        "conditions": {"moisture_end_pct": {"exceeds_moisture_start_by": 20}},
        "severity": "medium",
        "confidence": 0.78,
    },
]
```

#### Tier 4 — Isolation Forest ML (Week 4-5, feature-flagged)

No labels required. Unsupervised. Trained per farm/zone on rolling 30-day window.

```python
# backend/app/services/ml_anomaly_service.py
from sklearn.ensemble import IsolationForest
import numpy as np

class IsolationForestDetector:
    FEATURE_COLUMNS = [
        "main_pump_flow_lpm",
        "main_pressure_mpa",
        "total_inlet_flow_lpm",
        "total_outlet_flow_lpm",
        "avg_soil_moisture_pct",
        "water_efficiency_pct",
    ]

    def __init__(self, contamination: float = 0.05):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )

    def fit(self, readings: list[dict]) -> None:
        X = self._to_feature_matrix(readings)
        if len(X) < 50:
            raise ValueError("Insufficient data to train baseline")
        self.model.fit(X)

    def score(self, reading: dict) -> float:
        """Negative = more anomalous. Below -0.1 = suspicious."""
        return float(self.model.score_samples(self._to_feature_matrix([reading]))[0])

    def predict(self, reading: dict) -> bool:
        return self.model.predict(self._to_feature_matrix([reading]))[0] == -1

    def _to_feature_matrix(self, readings: list[dict]) -> np.ndarray:
        return np.array([[r.get(col, 0) or 0 for col in self.FEATURE_COLUMNS] for r in readings])
```

**Model persistence:** Supabase Storage bucket `ml-models/`, key `{farm_id}/{zone_id}/isolation_forest.pkl`. Retrain weekly (Sunday 2am). Fall back silently to rule-based if model missing.

---

## 5. Backend Integration Plan

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/app/services/hydraulic_detector.py` | 11 rule-based hydraulic checks |
| `backend/app/services/equipment_detector.py` | Pump degradation, reservoir leak |
| `backend/app/services/baseline_service.py` | Compute + persist rolling statistics |
| `backend/app/services/ml_anomaly_service.py` | IsolationForest detector |
| `backend/app/workers/baseline_worker.py` | Hourly baseline computation |
| `backend/app/workers/health_snapshot_worker.py` | Hourly farm health score |
| `backend/supabase_migration_v4.sql` | 3 new tables + ALTER anomaly_events |

### Extend Existing Files

**`anomaly_service.py`** — wire 3 new detectors into `analyze_reading_batch()`:

```python
async def analyze_reading_batch(farm_id: str, readings: list[dict]):
    for reading in readings:
        # Existing 5 detectors
        z_results       = z_score_detector(reading, farm_id)
        change_results  = sudden_change_detector(reading, farm_id)
        stuck_results   = stuck_sensor_detector(reading, farm_id)
        drift_results   = drift_detector(reading, farm_id)
        corr_results    = correlation_detector(reading, farm_id)

        # NEW 3 detectors
        hydraulic_results = await hydraulic_detector(reading, farm_id)
        equipment_results = await equipment_detector(reading, farm_id)
        agronomic_results = await agronomic_detector(reading, farm_id)

        all_anomalies = [
            *z_results, *change_results, *stuck_results,
            *drift_results, *corr_results,
            *hydraulic_results, *equipment_results, *agronomic_results
        ]

        await _store_anomalies(farm_id, all_anomalies)
        await _send_anomaly_alerts(farm_id, all_anomalies)
```

**`main.py`** — add background workers to lifespan:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.IOT_SIMULATOR_ENABLED:
        await start_iot_simulator(...)

    # NEW background workers
    baseline_task       = asyncio.create_task(run_baseline_worker())
    health_snapshot_task = asyncio.create_task(run_health_snapshot_worker())

    yield

    baseline_task.cancel()
    health_snapshot_task.cancel()
    if is_simulator_running():
        await stop_iot_simulator()
```

**`anomaly_routes.py`** — 4 new endpoints:

```python
@router.get("/api/anomalies/health")
async def get_farm_health(farm_id: str = Header(alias="X-Farm-ID")):
    """Returns latest farm_health_snapshots row + active anomaly summary."""
    ...

@router.get("/api/anomalies/types")
async def list_anomaly_types():
    """Returns anomaly_types catalog for frontend display."""
    ...

@router.get("/api/anomalies/baselines")
async def get_baselines(farm_id: str = Header(alias="X-Farm-ID")):
    """Returns sensor_baselines for dashboard visualization."""
    ...

@router.get("/api/anomalies/timeline")
async def get_anomaly_timeline(
    farm_id: str = Header(alias="X-Farm-ID"),
    days: int = 7,
    zone_id: Optional[str] = None
):
    """Returns anomaly events grouped by day for timeline chart."""
    ...
```

**`/api/events` SSE** — extend existing data dict:

```python
data = json.dumps({
    # ... all existing fields ...
    "anomaly_count": anomaly_count,
    "system_health_score": await get_latest_health_score(farm_id),  # NEW
    "active_critical_anomalies": critical_count,                     # NEW
})
```

---

## 6. Frontend / Product Experience

### New Page: System Health (`frontend/src/components/pages/SystemHealthPage.tsx`)

New sidebar item, positioned between "Alerts" and "Reports".

**User View — what farmers see:**

```
┌──────────────────────────────────────────────────────────────┐
│  System Health                              Last updated 2m ago│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Overall Health Score                                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │Hydraulic│  │Agronomy │  │Equipment│  │Data     │       │
│  │  87/100 │  │  92/100 │  │  74/100 │  │  96/100 │       │
│  │ 🟢 Good │  │ 🟢 Good │  │⚠️ Fair  │  │ 🟢 Good │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  Active Anomalies                                            │
│  ● 1 CRITICAL: Pump performance degrading (Zone 3)          │
│  ▲ 2 HIGH:    Branch leak detected (B2), Valve stuck (Z1)   │
│  ◆ 3 MEDIUM:  Partial dripper clog (B4, B7, B11)           │
│                                                              │
│  7-Day Anomaly Timeline                                      │
│  ▓▓▒░░▒▒  [sparkline chart per day]                        │
│                                                              │
│  Zone Risk Map                                               │
│  [FarmMapSVG with color overlay driven by health score]      │
└──────────────────────────────────────────────────────────────┘
```

### Severity Color Schema (consistent across entire app)

| Severity | Color | Icon | User Message |
|----------|-------|------|-------------|
| `critical` | `#dc2626` red | `●` | "Immediate action required" |
| `high` | `#ea580c` orange | `▲` | "Attention needed today" |
| `medium` | `#ca8a04` yellow | `◆` | "Monitor closely" |
| `low` | `#2563eb` blue | `ℹ` | "For your awareness" |

### New Components (`frontend/src/components/anomaly/`)

```
AnomalyBadge.tsx      — severity pill used everywhere
AnomalyCard.tsx       — single anomaly event card with acknowledge + false_positive buttons
AnomalyTimeline.tsx   — 7-day bar chart of anomaly counts by severity
HealthScoreRing.tsx   — circular 0-100 score with color gradient
ZoneRiskOverlay.tsx   — SVG color overlay for FarmMapSVG
AnomalyTypeIcon.tsx   — icon map for all 32 anomaly types
SystemHealthPage.tsx  — full page composing all of the above
```

### Modify Existing Components

**`AlertsPage.tsx`** — add resolution notes to acknowledge flow:

```typescript
const handleAcknowledge = async (anomalyIds: string[], notes: string) => {
  await acknowledgeAnomalies({ anomaly_ids: anomalyIds, resolution_notes: notes });
};
```

**`Sidebar.tsx`** — add System Health with critical count badge:

```typescript
{
  key: "system-health",
  label: t("systemHealth"),
  icon: <ShieldIcon />,
  badge: criticalAnomalyCount > 0 ? criticalAnomalyCount : undefined,
}
```

**`FarmMapSVG.tsx`** — wire zone color to health score:

```typescript
const zoneColor = (zoneId: string): string => {
  const score = healthScores[zoneId] ?? 100;
  if (score < 40) return "#dc2626";  // red
  if (score < 60) return "#ea580c";  // orange
  if (score < 80) return "#ca8a04";  // yellow
  return "#22c55e";                  // green (existing default)
};
```

### i18n Additions (`ar.json` and `fr.json`)

```json
{
  "systemHealth": "صحة النظام",
  "anomalyTypes": {
    "LEAK_BRANCH": "تسرب في الفرع",
    "PIPE_BURST": "انكسار الأنبوب",
    "DRIPPER_CLOG_PARTIAL": "انسداد جزئي للقطارات",
    "FILTER_CLOG_EARLY": "انسداد مبكر للمرشح",
    "PUMP_DEGRADATION": "تدهور أداء المضخة",
    "OVER_IRRIGATION": "ري مفرط",
    "SENSOR_FROZEN": "توقف المستشعر"
  }
}
```

---

## 7. Health Score Formula

Transparent to farmers, auditable by developers:

```python
def compute_overall_score(
    active_critical: int,
    active_high: int,
    active_medium: int,
    active_low: int,
    water_efficiency_avg: float,
    data_quality_pct: float,
) -> float:
    base = 100.0
    base -= active_critical * 25
    base -= active_high * 10
    base -= active_medium * 5
    base -= active_low * 2
    base = max(base, 0)

    efficiency_factor = (water_efficiency_avg / 100) * 10
    quality_factor    = (data_quality_pct / 100) * 5

    return min(100, base + efficiency_factor + quality_factor)
```

---

## 8. Testing Strategy

### Unit Tests

```python
# tests/test_hydraulic_detector.py
def test_branch_leak_detection():
    reading = {
        "branch_id": "test-branch-1",
        "valve_open": True,
        "inlet_flow_lpm": 10.0,
        "outlet_flow_lpm": 7.0,  # 30% loss
    }
    results = detect_branch_leak([reading], baselines={})
    assert len(results) == 1
    assert results[0].anomaly_type == "LEAK_BRANCH"
    assert results[0].severity == "high"

def test_no_leak_when_valve_closed():
    reading = {"valve_open": False, "inlet_flow_lpm": 10.0, "outlet_flow_lpm": 7.0}
    assert detect_branch_leak([reading], baselines={}) == []

def test_filter_clog_early_detection():
    readings = [
        {"main_pressure_mpa": 0.3 + i * 0.005, "main_pump_flow_lpm": 50 - i}
        for i in range(10)
    ]
    results = detect_filter_clog(readings)
    assert len(results) == 1
    assert results[0].anomaly_type == "FILTER_CLOG_EARLY"
```

### Integration Test

```python
# tests/test_anomaly_pipeline.py
async def test_full_anomaly_pipeline():
    response = client.post("/api/iot/simulator/inject/anomaly", json={
        "zone_id": 1, "anomaly_type": "pipe_burst", "duration": 60
    })
    assert response.status_code == 200

    await asyncio.sleep(0.5)

    anomalies = client.get("/api/anomalies?severity=critical").json()
    assert any(a["anomaly_type"] == "PIPE_BURST" for a in anomalies["items"])
```

### Observability

All detectors log structured events to the existing `/dashboard` debug endpoint:

```python
logger.info("anomaly_detected", extra={
    "farm_id": farm_id,
    "anomaly_type": event.anomaly_type,
    "severity": event.severity,
    "confidence": event.confidence_score,
    "detection_method": event.detection_method,
    "zone_id": event.zone_id,
})
```

`/api/debug/status` extension:

```python
"anomaly_detection": {
    "baselines_computed_at": last_baseline_compute,
    "ml_model_trained_at": last_model_train,
    "detectors_active": ["hydraulic", "equipment", "agronomic", "statistical", "ml"],
    "anomalies_last_24h": count,
}
```

---

## 9. Implementation TODO

### Phase 1 — Hydraulic Rules *(Week 1-2, no ML, immediate value)*

- [ ] Write `backend/supabase_migration_v4.sql` (3 new tables + ALTER)
- [ ] Apply migration via Supabase MCP tool
- [ ] Seed `anomaly_types` catalog with all 32 rows
- [ ] Create `backend/app/services/hydraulic_detector.py` with 5 rules (leak, filter clog, valve stuck, pressure anomaly)
- [ ] Create `backend/app/services/equipment_detector.py` (pump degradation, reservoir leak)
- [ ] Wire new detectors into `analyze_reading_batch()` in `anomaly_service.py`
- [ ] Add `GET /api/anomalies/types` route to `anomaly_routes.py`
- [ ] Run codegen: `cd frontend && npm run codegen`
- [ ] Build `AnomalyBadge.tsx` component
- [ ] Build `AnomalyCard.tsx` component with acknowledge + false_positive buttons
- [ ] Test: inject `pipe_burst` via `/api/iot/simulator/inject/anomaly` → verify `PIPE_BURST` critical row + WhatsApp fires

**Verification checkpoint:** `anomaly_events` table gets typed rows with `confidence_score` and `detection_method` populated.

---

### Phase 2 — Statistical Baselines *(Week 2-3)*

- [ ] Create `backend/app/services/baseline_service.py`
- [ ] Create `backend/app/workers/baseline_worker.py` (hourly async loop)
- [ ] Register `baseline_worker` in `main.py` lifespan
- [ ] Wire `sensor_baselines` into z_score and sudden_change detectors
- [ ] Add `GET /api/anomalies/baselines` route
- [ ] Run codegen after adding the route
- [ ] Build `HealthScoreRing.tsx` component
- [ ] Bootstrap: run `compute_baselines()` once manually for existing farm data

**Verification checkpoint:** After 24h with simulator running, `sensor_baselines` table is populated. Z-score detections use DB values, not in-memory window.

---

### Phase 3 — Health Scoring *(Week 3)*

- [ ] Create `backend/app/workers/health_snapshot_worker.py`
- [ ] Implement `compute_overall_score()` health formula
- [ ] Register `health_snapshot_worker` in `main.py` lifespan
- [ ] Add `GET /api/anomalies/health` route
- [ ] Extend `/api/events` SSE to include `system_health_score` and `active_critical_anomalies`
- [ ] Run codegen
- [ ] Build `SystemHealthPage.tsx` with 4 domain score rings
- [ ] Add "System Health" entry to `Sidebar.tsx` with critical badge
- [ ] Add i18n keys for `systemHealth` in `ar.json` and `fr.json`

**Verification checkpoint:** `/api/anomalies/health` returns a score. Sidebar badge shows count on critical anomalies.

---

### Phase 4 — ML Isolation Forest *(Week 4-5, feature-flagged)*

- [ ] Add `scikit-learn` to `backend/requirements.txt`
- [ ] Create `backend/app/services/ml_anomaly_service.py` with `IsolationForestDetector`
- [ ] Implement model train / save / load pipeline with Supabase Storage
- [ ] Wire into `analyze_reading_batch()` as Tier-4 detector (after rule-based tiers)
- [ ] Add `ML_ANOMALY_ENABLED=false` feature flag to `.env.example`
- [ ] Gate ML detector behind feature flag
- [ ] Add `GET /api/anomalies/timeline` route
- [ ] Build `AnomalyTimeline.tsx` 7-day bar chart
- [ ] Add weekly retrain job (Sunday 2am) inside `health_snapshot_worker`

**Verification checkpoint:** With `ML_ANOMALY_ENABLED=true` and ≥50 readings, `anomaly_events` rows appear with `detection_method = "isolation_forest"`.

---

### Phase 5 — Zone Risk Map *(Week 5-6)*

- [ ] Build `ZoneRiskOverlay.tsx` SVG color component
- [ ] Build `AnomalyTypeIcon.tsx` icon map for all 32 types
- [ ] Wire `ZoneRiskOverlay` into `FarmMapSVG.tsx`
- [ ] Wire zone health scores into `FarmMapSVG.tsx` zone colors
- [ ] Add `AnomalyTimeline.tsx` to `SystemHealthPage.tsx`
- [ ] Add resolution notes input to acknowledge flow in `AlertsPage.tsx`
- [ ] Add false_positive reporting button to `AnomalyCard.tsx`
- [ ] Complete i18n for all 32 anomaly type names in `ar.json` and `fr.json`
- [ ] Write unit tests for all new detectors
- [ ] Write integration test for full anomaly pipeline

**Verification checkpoint:** Farm map zones turn red/orange/yellow based on active anomalies. False positives can be flagged and filtered from dashboard.

---

## 10. Architectural Invariants

These rules must never be broken:

1. **Separation of concerns** — `anomaly_service` never calls `device_control_routes`. Detection and actuation are always separate code paths.
2. **Append-only events** — `anomaly_events` is never deleted. Use `acknowledged = true` or `false_positive = true`.
3. **Feature flags** — every detector can be individually disabled via `.env`.
4. **Graceful degradation** — ML model failure falls back silently to rule-based. Production farms cannot have blind spots from a missing pickle file.
5. **Advisory baselines** — `sensor_baselines` are optional. All detectors work without them (less precise, not broken).

---

## 11. How Everything Should Look When Done

### System Architecture (final state)

```
IoT Devices / Simulator
        │
        ▼
POST /api/iot/readings/batch
        │
        ▼
iot_service.ingest_batch()
        │
        ├──▶ 5 v3 tables (environment, infrastructure, branch_flow, soil_moisture, zone_health)
        │
        └──▶ anomaly_service.analyze_reading_batch() [non-blocking task]
                    │
                    ├── z_score_detector()         [existing, upgraded with DB baselines]
                    ├── sudden_change_detector()   [existing, upgraded with DB baselines]
                    ├── stuck_sensor_detector()    [existing]
                    ├── drift_detector()           [existing]
                    ├── correlation_detector()     [existing, extended to 8 rules]
                    ├── hydraulic_detector()       [NEW — 11 rules]
                    ├── equipment_detector()       [NEW — pump, reservoir]
                    ├── agronomic_detector()       [NEW — stress, over/under irrigation]
                    └── ml_anomaly_service()       [NEW — IsolationForest, feature-flagged]
                                │
                    ┌───────────┴──────────────┐
                    ▼                          ▼
            anomaly_events table        WhatsApp alert
            (typed, with confidence,    (on critical/high
            detection_method,           if auto_alert_sent = FALSE)
            resolution_notes)
                    │
                    ▼
        Background workers (every hour)
            ├── baseline_worker        → sensor_baselines table
            └── health_snapshot_worker → farm_health_snapshots table
                    │
                    ▼
        /api/events SSE stream
            → includes system_health_score + active_critical_anomalies
                    │
                    ▼
        Frontend Dashboard
```

### What Farmers Experience (final state)

The farmer opens the app and immediately sees:

- **Sidebar** — "System Health" tab with a red badge showing `2` critical anomalies
- **Dashboard header** — a single `74/100` health score with a colored ring
- **System Health page** — 4 domain scores (Hydraulic, Agronomy, Equipment, Data), a list of all active anomalies sorted by severity, a 7-day timeline chart, and the farm map with zones colored by risk
- **Farm Map** — Zone 3 is orange (equipment issue), Zone 1 is red (valve stuck), all others green
- **Alert on phone** — WhatsApp message in Darija: "⚠️ تسرب في فرع B2 — الضياع 32% من الماء. قطاع 3"
- **Acknowledge flow** — farmer taps "Resolve", types "Cleaned dripper line", closes the event with a timestamp

### What Developers See (final state)

- `GET /api/anomalies` returns typed events with `confidence_score`, `detection_method`, `baseline_value`, and `actual_value`
- `GET /api/anomalies/health` returns a structured JSON with 4 domain scores + zone risk list
- `GET /api/anomalies/timeline` returns daily aggregates for the chart
- `GET /api/anomalies/types` returns the full 32-type catalog with descriptions and recommended actions
- `GET /api/debug/status` shows which detectors are active, when baselines were last computed, and ML model status
- `sensor_baselines` table contains rolling statistics per farm/zone/column, updated hourly
- `farm_health_snapshots` table has one row per hour per farm — full audit trail of system health

### Database State (final state)

| Table | Rows (per active farm, per week) | Purpose |
|-------|----------------------------------|---------|
| `anomaly_events` | 50–500 | All detected anomalies, append-only |
| `anomaly_types` | 32 (static) | Type catalog and documentation |
| `sensor_baselines` | ~200 | Rolling statistics per sensor column |
| `farm_health_snapshots` | 168 (one/hour) | Historical health score audit trail |

### Final File Count

**Backend — 6 new files, 3 modified:**

| File | Status |
|------|--------|
| `hydraulic_detector.py` | New |
| `equipment_detector.py` | New |
| `baseline_service.py` | New |
| `ml_anomaly_service.py` | New |
| `baseline_worker.py` | New |
| `health_snapshot_worker.py` | New |
| `supabase_migration_v4.sql` | New |
| `anomaly_service.py` | Modified |
| `anomaly_routes.py` | Modified |
| `main.py` | Modified |

**Frontend — 7 new components, 3 modified:**

| File | Status |
|------|--------|
| `SystemHealthPage.tsx` | New |
| `AnomalyBadge.tsx` | New |
| `AnomalyCard.tsx` | New |
| `AnomalyTimeline.tsx` | New |
| `HealthScoreRing.tsx` | New |
| `ZoneRiskOverlay.tsx` | New |
| `AnomalyTypeIcon.tsx` | New |
| `AlertsPage.tsx` | Modified |
| `FarmMapSVG.tsx` | Modified |
| `Sidebar.tsx` | Modified |

### Business Impact Per Phase

| Phase | Capability Unlocked | Farmer Benefit |
|-------|--------------------|-|
| 1 | Hydraulic + equipment rules | Catches leaks, valve failures, and filter clogs automatically — same day |
| 2 | Statistical baselines | Detection adapts to each farm's own normal behavior, fewer false positives |
| 3 | Health scoring | One number tells the full story: "Your system is at 74/100 — pump needs attention" |
| 4 | ML anomaly detection | Catches complex patterns no rule was written for |
| 5 | Zone risk map | Visual — farmers point at the map, not a spreadsheet |
