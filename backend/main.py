"""
SoussFlow Backend — FastAPI application
Modules: Auth (JWT), WhatsApp (Wassender), IoT, Predictions, AI (OpenAI)
License: MIT
"""
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
import asyncio

from starlette.middleware.base import BaseHTTPMiddleware
from app.logging_config import logger, is_debug_mode, set_debug_mode, toggle_debug_mode, debug, debug_request, debug_response, debug_db_query as debug_db
from app.routes import (
    auth_router,
    admin_router,
    whatsapp_router,
    iot_router,
    prediction_router,
    openai_router,
    farm_router,
    conversation_router,
    zone_router,
    device_control_router,
    anomaly_router,
)
from app.routes.infrastructure_routes import router as infrastructure_router

START_TIME = time.time()
templates = Jinja2Templates(directory="app/templates")


def render_template(name: str, request: Request, context: dict | None = None) -> HTMLResponse:
    """Render a Jinja2 template in a way compatible with all Starlette versions."""
    ctx = context or {}
    ctx["request"] = request
    template = templates.get_template(name)
    html = template.render(ctx)
    return HTMLResponse(html)

_latest_readings_cache = []
_hierarchical_readings_cache = {}
_simulator_status_cache = {"running": False}


def update_readings_cache(readings: list, running: bool):
    global _latest_readings_cache, _hierarchical_readings_cache, _simulator_status_cache
    _latest_readings_cache = readings
    _simulator_status_cache = {"running": running}


def update_hierarchical_cache(hierarchical: dict, running: bool):
    global _hierarchical_readings_cache, _simulator_status_cache
    _hierarchical_readings_cache = hierarchical
    _simulator_status_cache = {"running": running}


def _merge_hierarchical_to_zones(zones_meta: list, hierarchical: dict) -> list:
    """
    Merge separate zone_healths, branch_flows, and soil_moistures arrays
    into a single zones[] array with nested branches — matching the frontend
    SSEPayload.zones shape (ZoneReading[]).
    """
    zone_healths = {zh["zone_id"]: zh for zh in (hierarchical.get("zone_healths") or [])}

    # Index branch_flows and soil_moistures by (zone_id, branch_id)
    bf_by_branch = {}
    for bf in (hierarchical.get("branch_flows") or []):
        bf_by_branch[bf["branch_id"]] = bf

    sm_by_branch = {}
    for sm in (hierarchical.get("soil_moistures") or []):
        sm_by_branch[sm["branch_id"]] = sm

    merged = []
    for zone in zones_meta:
        zone_id = zone["id"]
        zh = zone_healths.get(zone_id, {})

        branches_out = []
        for branch in zone.get("branches", []):
            bid = branch["id"]
            bf = bf_by_branch.get(bid, {})
            sm = sm_by_branch.get(bid, {})

            inlet = bf.get("inlet_flow_lpm", 0) or 0
            outlet = bf.get("outlet_flow_lpm", 0) or 0

            start = sm.get("moisture_start_pct", 0) or 0
            mid = sm.get("moisture_middle_pct", 0) or 0
            end = sm.get("moisture_end_pct", 0) or 0
            avg_m = (start + mid + end) / 3.0 if (start or mid or end) else 0
            max_m = max(start, mid, end)
            uc = (max(0, 100 - ((max_m - min(start, mid, end)) / max_m * 100))
                  if max_m > 0 else 100)

            branches_out.append({
                "branch_id": bid,
                "branch_number": branch.get("branch_number", 1),
                "branch_name": branch.get("name", f"Branch {branch.get('branch_number', 1)}"),
                "valve_open": bf.get("valve_open", 0),
                "inlet_flow_lpm": round(inlet, 2),
                "outlet_flow_lpm": round(outlet, 2),
                "flow_delta_lpm": round(inlet - outlet, 2),
                "leak_detected": bf.get("leak_detected", False),
                "inlet_pressure_mpa": bf.get("inlet_pressure_mpa", 0) or 0,
                "outlet_pressure_mpa": bf.get("outlet_pressure_mpa", 0) or 0,
                "moisture_start_pct": round(start, 1),
                "moisture_middle_pct": round(mid, 1),
                "moisture_end_pct": round(end, 1),
                "avg_moisture_pct": round(avg_m, 1),
                "uniformity_coefficient": round(uc, 1),
            })

        stress = zh.get("stress_score", 0) or 0
        if stress < 0.10:
            stress_cls = "none"
        elif stress < 0.30:
            stress_cls = "mild"
        elif stress < 0.60:
            stress_cls = "moderate"
        else:
            stress_cls = "severe"

        avg_moist = zh.get("avg_soil_moisture_pct", 0) or 0

        merged.append({
            "zone_id": zone_id,
            "zone_number": zone.get("zone_number", 1),
            "zone_name": zone.get("name", f"Zone {zone.get('zone_number', 1)}"),
            "is_active": zone.get("is_active", True),
            "branches": branches_out,
            "avg_moisture_pct": round(avg_moist, 1),
            "total_inlet_flow_lpm": round(zh.get("total_inlet_flow_lpm", 0) or 0, 2),
            "total_outlet_flow_lpm": round(zh.get("total_outlet_flow_lpm", 0) or 0, 2),
            "water_efficiency_pct": round(zh.get("water_efficiency_pct", 0) or 0, 1),
            "leak_count": zh.get("leak_count", 0) or 0,
            "stress_score": round(stress, 3),
            "stress_class": stress_cls,
            "health_score": round(zh.get("health_score", 0) or 0, 1),
            "irrigation_needed": avg_moist < 32,
        })

    return merged


def read_logs(log_file: str, max_lines: int = 100) -> list:
    log_path = Path("logs") / log_file
    logs = []
    if log_path.exists():
        with open(log_path, "r") as f:
            lines = f.readlines()[-max_lines:]
        for line in lines:
            try:
                data = json.loads(line.strip())
                logs.append({
                    "timestamp": data.get("timestamp", ""),
                    "level": data.get("level", "INFO"),
                    "message": data.get("message", ""),
                    "module": data.get("module", ""),
                    "function": data.get("function", ""),
                })
            except json.JSONDecodeError:
                continue
    return logs


def get_uptime() -> str:
    elapsed = time.time() - START_TIME
    hours, remainder = divmod(int(elapsed), 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m {seconds}s"


def _get_admin_from_cookie(request: Request) -> dict | None:
    """Validate admin_token cookie and return user dict if superadmin, else None."""
    token = request.cookies.get("admin_token")
    if not token:
        return None
    try:
        from app.auth import decode_token
        from app.supabase_client import get_supabase_admin
        payload = decode_token(token)
        user_id = payload.get("sub")
        role = payload.get("role")
        if role != "superadmin" or not user_id:
            return None
        admin = get_supabase_admin()
        user_resp = admin.from_("users").select("id, username, full_name, role").eq("id", user_id).eq("is_active", True).execute()
        if not user_resp.data or user_resp.data[0]["role"] != "superadmin":
            return None
        return user_resp.data[0]
    except Exception:
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    logger.info("SoussFlow API starting up", version="2.0.0")

    from app.config import get_settings
    settings = get_settings()

    if settings.IOT_SIMULATOR_ENABLED:
        from app.services.iot_simulator import start_iot_simulator
        logger.info("Starting IoT Simulator", zones=settings.IOT_SIMULATOR_ZONES, interval=settings.IOT_SIMULATOR_INTERVAL)
        await start_iot_simulator(
            n_zones=settings.IOT_SIMULATOR_ZONES,
            interval_seconds=settings.IOT_SIMULATOR_INTERVAL,
            farm_id=settings.IOT_SIMULATOR_FARM_ID,
        )
    else:
        logger.info("IoT Simulator disabled (set IOT_SIMULATOR_ENABLED=true to enable)")

    from app.workers.baseline_worker import run_baseline_worker
    baseline_task = asyncio.create_task(run_baseline_worker(interval_hours=1, enabled=True))
    logger.info("Started baseline worker")

    from app.workers.health_snapshot_worker import run_health_worker
    health_task = asyncio.create_task(run_health_worker(interval_hours=1, enabled=True))
    logger.info("Started health snapshot worker")

    yield

    baseline_task.cancel()
    health_task.cancel()
    try:
        await baseline_task
    except asyncio.CancelledError:
        pass
    try:
        await health_task
    except asyncio.CancelledError:
        pass

    from app.services.iot_simulator import stop_iot_simulator, is_simulator_running
    if is_simulator_running():
        logger.info("Stopping IoT Simulator")
        await stop_iot_simulator()
    logger.info("SoussFlow API shutting down")


app = FastAPI(
    title="SoussFlow API",
    description="Smart agriculture platform — IoT monitoring, AI predictions, and WhatsApp alerts",
    version="2.0.0",
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

# CORS middleware
from app.config import get_settings as _get_settings
_settings = _get_settings()
_origins = [o.strip() for o in _settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Debug request/response logging middleware
class DebugLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if not is_debug_mode():
            return await call_next(request)
        # Skip SSE, static, and OPTIONS preflight (OPTIONS must bypass BaseHTTPMiddleware
        # so CORSMiddleware can handle it — BaseHTTPMiddleware.call_next() hangs on OPTIONS)
        if request.method == "OPTIONS" or request.url.path in ("/api/events", "/favicon.ico"):
            return await call_next(request)
        start = time.time()
        debug_request(request.method, request.url.path)
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        debug_response(request.method, request.url.path, response.status_code, duration_ms)
        return response

app.add_middleware(DebugLoggingMiddleware)

# Include routers (each router defines its own /api/* prefix)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(whatsapp_router)
app.include_router(iot_router)
app.include_router(prediction_router)
app.include_router(openai_router)
app.include_router(farm_router)
app.include_router(conversation_router)
app.include_router(zone_router)
app.include_router(infrastructure_router)
app.include_router(device_control_router)
app.include_router(anomaly_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to SoussFlow API",
        "docs": "/docs",
        "redoc": "/redoc",
        "version": "2.0.0",
        "modules": ["auth", "whatsapp", "iot", "predictions", "ai"],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "service": "SoussFlow API",
        "version": "2.0.0",
    }


# ─── Dashboard (protected by admin cookie) ──────────────────────

@app.get("/dashboard/login", response_class=HTMLResponse)
async def dashboard_login(request: Request):
    """Admin login page"""
    # If already authenticated, redirect to dashboard
    admin_user = _get_admin_from_cookie(request)
    if admin_user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return render_template("login.html", request)


@app.get("/dashboard/logout")
async def dashboard_logout():
    """Clear admin cookie and redirect to login"""
    response = RedirectResponse(url="/dashboard/login", status_code=302)
    response.delete_cookie("admin_token", path="/")
    return response


# ─── Public Auth Pages (Jinja Templates) ──────────────────────

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """User sign-in page"""
    return render_template("login.html", request)


def _get_user_from_token(request: Request) -> dict | None:
    """Validate JWT token from Authorization header and return user if valid."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        from app.auth import decode_token
        from app.supabase_client import get_supabase_admin
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        admin = get_supabase_admin()
        user_resp = admin.from_("users").select("id, username, full_name, role").eq("id", user_id).eq("is_active", True).execute()
        if not user_resp.data:
            return None
        return user_resp.data[0]
    except Exception:
        return None


@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request):
    """User management page (requires auth)"""
    user = _get_user_from_token(request)
    if not user:
        return RedirectResponse(url="/login?return=/users", status_code=302)
    return render_template("users.html", request, {"current_user": user})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Dashboard with health, data, logs, and user management (superadmin only)"""
    admin_user = _get_admin_from_cookie(request)
    if not admin_user:
        return RedirectResponse(url="/dashboard/login", status_code=302)

    logs = read_logs("backend.log", 50)
    error_logs = read_logs("backend_errors.log", 50)

    simulator_running = _simulator_status_cache.get("running", False)
    latest_readings = _latest_readings_cache if simulator_running else []

    health = {
        "status": "healthy",
        "version": "2.0.0",
        "uptime": get_uptime(),
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "modules": ["auth", "whatsapp", "iot", "predictions", "ai"],
    }

    debug_logs = read_logs("debug.log", 50) if is_debug_mode() else []

    return render_template("dashboard.html", request, {
        "health": health,
        "logs": logs,
        "error_logs": error_logs,
        "debug_logs": debug_logs,
        "latest_readings": latest_readings,
        "simulator_running": simulator_running,
        "admin_user": admin_user,
        "debug_mode": is_debug_mode(),
    })


# ─── Debug Mode Endpoints ───────────────────────

@app.get("/api/debug/status")
async def debug_status():
    """Get current debug mode status"""
    return {
        "debug_mode": is_debug_mode(),
        "uptime": get_uptime(),
        "version": "2.0.0",
        "simulator_running": _simulator_status_cache.get("running", False),
    }


@app.post("/api/debug/toggle")
async def debug_toggle():
    """Toggle debug mode on/off"""
    new_state = toggle_debug_mode()
    logger.info(f"Debug mode toggled: {new_state}")
    return {"debug_mode": new_state}


@app.post("/api/debug/enable")
async def debug_enable():
    """Enable debug mode"""
    set_debug_mode(True)
    logger.info("Debug mode enabled")
    return {"debug_mode": True}


@app.post("/api/debug/disable")
async def debug_disable():
    """Disable debug mode"""
    set_debug_mode(False)
    logger.info("Debug mode disabled")
    return {"debug_mode": False}


@app.get("/api/debug/logs")
async def debug_logs(max_lines: int = 100):
    """Get debug logs"""
    debug_log_entries = read_logs("debug.log", max_lines) if is_debug_mode() else []
    backend_log_entries = read_logs("backend.log", max_lines)
    error_log_entries = read_logs("backend_errors.log", max_lines)
    return {
        "debug_mode": is_debug_mode(),
        "logs": debug_log_entries,
        "backend_logs": backend_log_entries,
        "error_logs": error_log_entries,
    }


@app.get("/api/latest")
async def get_latest():
    """API endpoint for latest sensor readings"""
    return {
        "readings": _latest_readings_cache,
        "simulator_running": _simulator_status_cache.get("running", False),
    }


@app.get("/api/events")
async def sse_events():
    """Server-Sent Events stream for real-time updates"""
    async def event_generator():
        while True:
            try:
                from app.services.iot_simulator import is_simulator_running, get_latest_readings, get_simulator
                running = is_simulator_running()
                
                if running:
                    simulator = get_simulator()
                    if simulator and hasattr(simulator, 'generate_hierarchical_readings'):
                        zones_meta = await get_farm_zones()
                        hierarchical = simulator.generate_hierarchical_readings(zones_meta)
                        update_hierarchical_cache(hierarchical, running)

                        # Transform into the shape the frontend expects:
                        # Merge zone_healths + branch_flows + soil_moistures into zones[]
                        merged_zones = _merge_hierarchical_to_zones(
                            zones_meta, hierarchical
                        )

                        # Build control states from simulator
                        control_states = {}
                        if simulator:
                            control_states = {
                                "zone_valves": {z: simulator.zone_irrig.get(z, False) for z in range(1, simulator.n_zones + 1)},
                                "manual_overrides": {z: simulator.manual_override.get(z, False) for z in range(1, simulator.n_zones + 1)},
                            }

                        # Get unacknowledged anomaly count (non-blocking)
                        anomaly_count = 0
                        critical_count = 0
                        system_health_score = None
                        try:
                            from app.supabase_client import get_supabase_admin as _get_sb
                            from datetime import datetime, timezone, timedelta
                            _sb = _get_sb()
                            _anomaly_result = _sb.table("anomaly_events").select("id", count="exact").eq(
                                "farm_id", simulator.farm_id
                            ).eq("acknowledged", False).execute()
                            anomaly_count = _anomaly_result.count or 0
                            
                            _critical = _sb.table("anomaly_events").select("id", count="exact").eq(
                                "farm_id", simulator.farm_id
                            ).eq("acknowledged", False).eq("severity", "critical").execute()
                            critical_count = _critical.count or 0

                            _health = _sb.table("farm_health_snapshots").select("overall_score").eq(
                                "farm_id", simulator.farm_id
                            ).gte("snapshot_at", (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat())
                            _health_result = _health.order("snapshot_at", desc=True).limit(1).maybe_single().execute()
                            if _health_result.data:
                                system_health_score = _health_result.data.get("overall_score")
                        except Exception:
                            pass

                        data = json.dumps({
                            "environment": hierarchical.get("environment"),
                            "infrastructure": hierarchical.get("infrastructure"),
                            "zones": merged_zones,
                            "control_states": control_states,
                            "anomaly_count": anomaly_count,
                            "active_critical_anomalies": critical_count,
                            "system_health_score": system_health_score,
                            "simulator_running": running,
                            "timestamp": datetime.now().isoformat(),
                        })
                    else:
                        readings = get_latest_readings() if running else []
                        update_readings_cache(readings, running)
                        data = json.dumps({
                            "environment": None,
                            "infrastructure": None,
                            "zones": [],
                            "simulator_running": running,
                            "timestamp": datetime.now().isoformat(),
                        })
                else:
                    data = json.dumps({
                        "environment": None,
                        "infrastructure": None,
                        "zones": [],
                        "simulator_running": False,
                        "timestamp": datetime.now().isoformat(),
                    })
                
                yield f"data: {data}\n\n"
            except ImportError:
                pass
            except Exception:
                pass

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def get_farm_zones():
    """Get farm zones and branches for hierarchical readings using simulator's farm_id"""
    try:
        from app.supabase_client import get_supabase_admin
        from app.services.iot_simulator import get_simulator
        supabase = get_supabase_admin()

        simulator = get_simulator()
        if not simulator:
            return []
        farm_id = simulator.farm_id

        zones_resp = supabase.table("zones").select("id, zone_number, name, is_active").eq("farm_id", farm_id).eq("is_active", True).execute()
        zones = zones_resp.data or []

        result = []
        for zone in zones:
            branches_resp = supabase.table("branches").select("id, branch_number, name").eq("zone_id", zone["id"]).eq("is_active", True).execute()
            branches = branches_resp.data or []
            result.append({
                "id": zone["id"],
                "zone_number": zone["zone_number"],
                "name": zone["name"],
                "is_active": zone["is_active"],
                "branches": branches
            })
        return result
    except Exception as e:
        logger.error("Failed to fetch farm zones", error=str(e))
        return []


if __name__ == "__main__":
    import uvicorn
    from app.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None,
    )
