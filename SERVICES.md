# SoussFlow Services Documentation

SoussFlow is a smart irrigation platform for olive farms in the Agadir, Morocco region. This document details all services provided by the platform.

---

## Table of Contents

1. [Farm Management Service](#1-farm-management-service)
2. [IoT Data Processing Service](#2-iot-data-processing-service)
3. [IoT Simulator Service](#3-iot-simulator-service)
4. [AI Assistant Service](#4-ai-assistant-service)
5. [WhatsApp Integration Service](#5-whatsapp-integration-service)
6. [Prediction Service](#6-prediction-service)

---

## 1. Farm Management Service

**File:** `backend/app/services/farm_service.py`

**Purpose:** Handles farm CRUD operations and membership/employee management for the multi-tenant farm system.

### Core Features

- **Multi-tenant Farm System:** Each farm has its own owner and employees with role-based permissions
- **Membership Management:** Add, update, and remove farm members with granular permissions
- **Employee Management:** Create employee accounts and assign them to farms

### Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `list_farms` | Lists all farms accessible to a user (owned + member of) | `user_id` |
| `get_farm` | Gets a single farm if the user has access | `farm_id`, `user_id` |
| `create_farm` | Creates a new farm with zones and branches | `owner_id`, `name`, `location`, `total_zones`, `branches_per_zone`, `description` |
| `update_farm` | Updates farm details (owner only) | `farm_id`, `owner_id`, `**updates` |
| `delete_farm` | Deletes a farm (owner only) | `farm_id`, `owner_id` |
| `list_members` | Lists all members of a farm with user info | `farm_id`, `owner_id` |
| `add_member_by_id` | Adds a member by user ID | `farm_id`, `owner_id`, `user_id`, `invited_by`, `permissions` |
| `update_member` | Updates member permissions | `farm_id`, `owner_id`, `user_id`, `**updates` |
| `remove_member` | Removes a member from a farm | `farm_id`, `owner_id`, `user_id` |

### Permission Model

Members can have the following permissions:
- `read` - View farm data
- `write_readings` - Submit sensor readings
- `manage_alerts` - Create and manage alert rules
- `manage_employees` - Add and manage farm employees

---

## 2. IoT Data Processing Service

**File:** `backend/app/services/iot_service.py`

**Purpose:** Handles ingestion, querying, zone analysis, dashboard snapshots, and alert evaluation for sensor data from olive farm IoT devices.

### 2.1 Ingestion Functions

| Function | Description |
|----------|-------------|
| `ingest_reading` | Inserts a single IoT reading into normalized v3 tables |
| `ingest_batch` | Batch insert of readings into v3 tables (max 1000) |
| `ingest_environment_reading` | Insert weather station data (temperature, humidity, pressure, etc.) |
| `ingest_infrastructure_reading` | Insert reservoir/pump/filter data |
| `ingest_branch_flow_reading` | Insert branch inlet/outlet flow data |
| `ingest_soil_moisture_reading` | Insert soil moisture from 3 sensors per branch |
| `ingest_zone_health_reading` | Insert aggregated zone health data |

### 2.2 Query Functions

| Function | Description |
|----------|-------------|
| `query_readings` | Query environment readings with filters (zone, date range, columns) |
| `get_latest_environment` | Get most recent environment reading |
| `get_latest_infrastructure` | Get most recent infrastructure reading |
| `get_latest_per_branch` | Get latest flow reading per branch |
| `get_latest_per_zone` | Get latest zone health per zone |
| `get_latest_per_zone_health` | Get most recent zone health reading for each zone |

### 2.3 Analysis Functions

| Function | Description |
|----------|-------------|
| `analyze_zone` | Analyze zone stats, anomalies, and recommendations |
| `analyze_zone_hierarchical` | Zone analysis with branch-level data |
| `get_dashboard` | Dashboard snapshot with all zone data |
| `get_hierarchical_dashboard` | Hierarchical dashboard (zones, branches, health) |

### 2.4 Alert Functions

| Function | Description |
|----------|-------------|
| `check_alert_rules` | Check reading against active alert rules |
| `create_alert_rule` | Create new alert rule |
| `list_alert_rules` | List all alert rules for a farm |
| `delete_alert_rule` | Delete an alert rule |

### 2.5 Olive-Specific Thresholds

The service uses these optimal thresholds for olive cultivation:

| Sensor | Optimal Range | Warning | Critical |
|--------|--------------|---------|----------|
| Soil Moisture | 30-55% | <30% | <25% |
| Air Temperature | 15-30°C | <5°C or >45°C | - |
| Air Humidity | 40-70% | - | - |
| Reservoir Level | >40% | <40% | <25% |
| Main Pressure | 0.04-0.15 MPa | - | - |

### 2.6 Recommendation Engine

The `_generate_recommendations` function provides olive-specific irrigation recommendations based on:
- Current sensor readings
- Statistical anomalies detected
- Seasonal and weather patterns
- Soil moisture trends

---

## 3. IoT Simulator Service

**File:** `backend/app/services/iot_simulator.py`

**Purpose:** Generates realistic sensor data for olive farms in Agadir, Morocco using real climate patterns and time-scaled physics. Used for testing and demo environments.

### 3.1 Main Class: IoTSimulator

| Method | Description |
|--------|-------------|
| `generate_reading` | Generate one batch of readings (one per zone) using real current time |
| `generate_hierarchical_readings` | Generate hierarchical readings for all zones and branches |
| `generate_weather` | Generate realistic Agadir weather for current moment |
| `sim_reservoir` | Simulate reservoir drain/refill based on flow and precipitation |
| `sim_main_pressure` | Simulate main pipe pressure |
| `sim_filter_status` | Simulate filter degradation over time |
| `sim_zone_flow` | Simulate zone flow rate |
| `sim_zone_pressure` | Simulate zone pressure |
| `sim_soil_moisture` | Simulate soil moisture dynamics |
| `compute_stress` | Calculate plant stress score (0-1) |
| `compute_health` | Calculate health score (0-10) |

### 3.2 Anomaly Injection (Demo/Testing)

| Method | Description |
|--------|-------------|
| `inject_anomaly` | Force anomalies: `sensor_fault`, `pipe_burst`, `pressure_drop`, `flow_spike` |
| `inject_irrigation` | Force irrigation on/off for a zone |
| `inject_reservoir` | Override reservoir level (0-100%) |
| `inject_filter` | Override filter status (0-2) |
| `inject_soil_moisture` | Override soil moisture for a zone |

### 3.3 Climate Simulation

Uses real Agadir monthly climate baselines including:
- Seasonal temperature and humidity cycles
- Diurnal patterns (day/night variations)
- Precipitation events
- Olive-specific growth phases mapped to months

### 3.4 Module-Level Functions

| Function | Description |
|----------|-------------|
| `start_iot_simulator` | Start simulator in background |
| `stop_iot_simulator` | Stop the simulator |
| `is_simulator_running` | Check if simulator is running |
| `get_simulator` | Get running simulator instance |
| `get_latest_readings` | Get most recent readings without advancing state |

---

## 4. AI Assistant Service

**File:** `backend/app/services/openai_service.py`

**Purpose:** Provides conversational AI with awareness of IoT sensor data, olive cultivation best practices, and Souss-Massa region context. Supports function calling for device control.

### 4.1 Chat System

| Function | Description |
|----------|-------------|
| `chat` | Main chat function with OpenAI + function calling |
| `generate_chart_config` | Generate Chart.js config from conversation |
| `get_history` | Get conversation history |
| `_get_sensor_context` | Build sensor context string for AI |
| `_execute_tool` | Execute AI tool calls |

### 4.2 Device Control Tools (Function Calling)

| Tool | Description | Parameters |
|------|-------------|------------|
| `control_zone_irrigation` | Start/stop irrigation for a zone | `zone_id`, `action` |
| `get_zone_status` | Get current zone status | `zone_id` |
| `set_manual_override` | Enable/disable manual control mode | `enabled` |
| `get_anomaly_summary` | Get anomaly detection summary | - |

### 4.3 AI Capabilities

- **Multi-turn Conversations:** Maintains conversation history for contextual responses
- **Real-time Sensor Data:** Enriches responses with current sensor readings
- **Device Control:** Execute irrigation commands via AI conversation
- **Permission Checks:** Validates user permissions before executing control actions
- **Chart Generation:** Creates Chart.js configurations for data visualization
- **Channel Formatting:** Different output formats for web vs WhatsApp

### 4.4 System Prompts

| Prompt | Use Case |
|--------|----------|
| `SYSTEM_PROMPT` | Full AI prompt with data model, capabilities, SVG chart support |
| `WHATSAPP_SYSTEM_PROMPT` | WhatsApp-formatted version (no markdown tables/charts) |
| `CHART_GENERATION_PROMPT` | For generating Chart.js configurations |

---

## 5. WhatsApp Integration Service

**File:** `backend/app/services/whatsapp_service.py`

**Purpose:** Sends and receives WhatsApp messages via WaSenderAPI, includes AI assistant with intent routing and natural language processing.

### 5.1 Sending Functions

| Method | Description |
|--------|-------------|
| `send_message` | Send text message via WaSenderAPI |
| `_send_multi_message` | Split long messages at paragraph boundaries |
| `_send_image` | Send image via WaSenderAPI |

### 5.2 Receiving/AI Functions

| Method | Description |
|--------|-------------|
| `handle_incoming_message` | Main handler for incoming messages |
| `_handle_farm_lookup` | Look up farm and connect user |
| `_handle_ai_chat` | Route message through intent handlers |
| `_handle_chart_request` | Generate and send chart image |
| `_handle_openai_chat` | Route to OpenAI for AI conversation |
| `_execute_irrigation_command` | Execute irrigation start/stop |
| `_handle_soil_moisture_check` | Fetch and return soil moisture data |

### 5.3 Intent Handlers (Priority Order)

| Handler | Description |
|---------|-------------|
| `_intent_farm_switch` | Switch between farms |
| `_intent_help` | Show help menu |
| `_intent_pending_confirmation` | Handle pending confirmations |
| `_intent_irrigation_on` | Turn on irrigation |
| `_intent_irrigation_off` | Turn off irrigation |
| `_intent_soil_moisture` | Check soil moisture |
| `_intent_chart` | Generate chart |
| `_intent_ai_chat` | Fallback to AI |

### 5.4 Alert System

| Method | Description |
|--------|-------------|
| `send_alert` | Send automated alert with deduplication |
| `_is_alert_on_cooldown` | Check if alert is on cooldown |
| `_record_alert_cooldown` | Record alert cooldown |

### 5.5 Session Management

| Method | Description |
|--------|-------------|
| `_get_ai_session` | Get AI session for phone |
| `_create_ai_session` | Create new AI session |
| `_update_ai_session` | Update session state |
| `_set_pending_action` | Store pending confirmation |
| `_clear_pending_action` | Clear pending confirmation |

### 5.6 Utility Functions

| Method | Description |
|--------|-------------|
| `_convert_to_whatsapp_format` | Convert markdown to WhatsApp format |
| `_log_message` | Log message to Supabase |
| `get_device_status` | Check WhatsApp device connection status |
| `get_messages` | Get WhatsApp message history |

### 5.7 Features

- **Rate Limiting:** 20 messages per 60 seconds per phone
- **Alert Deduplication:** Prevents spam with configurable cooldowns
- **Multi-language Support:** Arabic, French, English, Moroccan Darija
- **Pending Confirmations:** 5-minute TTL for irrigation confirmations
- **Long Message Splitting:** Handles messages over WhatsApp character limit
- **Session State Management:** User onboarding and farm connection flow

---

## 6. Prediction Service

**File:** `backend/app/services/prediction_service.py`

**Purpose:** Linear regression forecasting, z-score anomaly detection, trend analysis with olive-specific recommendations.

### 6.1 Main Functions

| Function | Description |
|----------|-------------|
| `forecast` | Linear regression forecast on time-series column |
| `detect_anomalies` | Z-score anomaly detection |
| `get_prediction_history` | Get past predictions |

### 6.2 Forecast Output

| Field | Description |
|-------|-------------|
| `r2_score` | R² accuracy score (0-1) |
| `trend` | Trend direction: `rising`, `falling`, `stable` |
| `trend_slope` | Trend slope per hour |
| `current_value` | Current sensor value |
| `forecast_points` | Array of forecasted values |
| `confidence_bounds` | 95% confidence interval |
| `recommendations` | Olive-specific recommendations |

### 6.3 Anomaly Detection Output

| Field | Description |
|-------|-------------|
| `total_anomalies` | Total anomalies found |
| `anomaly_rate` | Percentage of anomalous readings |
| `anomalies` | Array of individual anomalies |
| `z_score` | Z-score for each anomaly |
| `expected_range` | Expected value range |
| `recommendations` | Based on anomaly rate |

### 6.4 Supported Columns for Forecasting

**Environment:**
- `air_temperature_c`
- `air_humidity_pct`
- `air_pressure_hpa`
- `light_intensity_lux`
- `solar_radiation_wm2`
- `precipitation_mm`
- `wind_speed_kmh`
- `cloud_cover_pct`

**Infrastructure:**
- `reservoir_level_pct`
- `main_pressure_mpa`
- `main_pump_flow_lpm`
- `filter_status`

**Zone Health:**
- `stress_score`
- `health_score`
- `avg_soil_moisture_pct`
- `water_efficiency_pct`
- `leak_count`

---

## API Routes Summary

| Route File | Prefix | Description |
|------------|--------|-------------|
| `auth_routes.py` | `/api/auth` | Authentication (sign in, profile, password change) |
| `admin_routes.py` | `/api/admin` | Superadmin owner/farm management |
| `farm_routes.py` | `/api/farms` | Farm CRUD, employees, members |
| `iot_routes.py` | `/api/iot` | Readings, analysis, dashboard, simulator |
| `conversation_routes.py` | `/api/conversations` | Chat conversations |
| `openai_routes.py` | `/api/ai` | AI chat |
| `whatsapp_routes.py` | `/api/whatsapp` | WhatsApp send/receive/webhook |
| `prediction_routes.py` | `/api/predictions` | Forecasts and anomaly detection |

---

## Authentication & Authorization

### User Roles

| Role | Description |
|------|-------------|
| `superadmin` | System administrator, created via SQL seed |
| `farm_owner` | Manages their farm and creates employees |
| `farm_employee` | Can view farm data and write readings |

### Auth Flow

1. User signs in with username/password (`/api/auth/signin`)
2. JWT token returned and stored client-side
3. All subsequent requests include JWT in Authorization header
4. Backend validates token and extracts user/role context

---

## External Integrations

| Service | Purpose |
|---------|---------|
| **Supabase** | Database storage (users, farms, readings, predictions) |
| **OpenAI** | AI chat and natural language processing |
| **WaSenderAPI** | WhatsApp messaging |

---

## Data Flow Diagram

```
IoT Devices → Ingestion API → IoT Service → Database
                              ↓
                        Alert Service → WhatsApp Service → Farmer
                              ↓
                        Prediction Service → Analysis Dashboard
                              ↓
                        AI Assistant ← Farmer Query
```

---

## Use Cases

### 1. Real-time Monitoring
Farmers receive WhatsApp alerts when sensor values exceed thresholds.

### 2. Irrigation Control
- Via AI Chat: "Start irrigation for Zone 1"
- Via WhatsApp: Send "Start irrigation Zone 1"

### 3. Forecasting
- View predicted soil moisture for next 7 days
- Identify anomalies before they become problems

### 4. Multi-farm Management
Superadmins can manage multiple farm owners and their farms through the admin dashboard.

### 5. Historical Analysis
Query historical sensor data for any date range and generate reports.

---

*Last updated: March 2026*
