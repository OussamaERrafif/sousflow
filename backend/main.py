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

from app.logging_config import logger
from app.routes import (
    auth_router,
    admin_router,
    whatsapp_router,
    iot_router,
    prediction_router,
    openai_router,
    farm_router,
    conversation_router,
)

START_TIME = time.time()
templates = Jinja2Templates(directory="app/templates")

_latest_readings_cache = []
_simulator_status_cache = {"running": False}


def update_readings_cache(readings: list, running: bool):
    global _latest_readings_cache, _simulator_status_cache
    _latest_readings_cache = readings
    _simulator_status_cache = {"running": running}


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

    yield

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

# Include routers (each router defines its own /api/* prefix)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(whatsapp_router)
app.include_router(iot_router)
app.include_router(prediction_router)
app.include_router(openai_router)
app.include_router(farm_router)
app.include_router(conversation_router)


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
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/dashboard/logout")
async def dashboard_logout():
    """Clear admin cookie and redirect to login"""
    response = RedirectResponse(url="/dashboard/login", status_code=302)
    response.delete_cookie("admin_token", path="/")
    return response


# ─── Public Auth Pages (Jinja Templates) ──────────────────────

@app.get("/signin", response_class=HTMLResponse)
async def signin_page(request: Request):
    """User sign-in page"""
    return templates.TemplateResponse("signin.html", {"request": request})


@app.get("/ar/signin", response_class=HTMLResponse)
async def signin_page_ar(request: Request):
    """User sign-in page (Arabic redirect)"""
    return templates.TemplateResponse("signin.html", {"request": request})


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
        return RedirectResponse(url="/signin?return=/users", status_code=302)
    return templates.TemplateResponse("users.html", {"request": request, "current_user": user})


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

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "health": health,
        "logs": logs,
        "error_logs": error_logs,
        "latest_readings": latest_readings,
        "simulator_running": simulator_running,
        "admin_user": admin_user,
    })


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
                from app.services.iot_simulator import is_simulator_running, get_latest_readings
                running = is_simulator_running()
                readings = get_latest_readings() if running else []
                update_readings_cache(readings, running)

                data = json.dumps({
                    "readings": readings,
                    "simulator_running": running,
                    "timestamp": datetime.now().isoformat(),
                })
                yield f"data: {data}\n\n"
            except ImportError:
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=None,
    )
