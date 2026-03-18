"""
Logging configuration using Loguru
"""
import os
import sys
from loguru import logger
import json
from threading import Lock

_debug_mode = False
_debug_lock = Lock()


def serialize(record):
    """Serialize log record to JSON"""
    subset = {
        "timestamp": record["time"].isoformat(),
        "level": record["level"].name,
        "message": record["message"],
        "module": record["module"],
        "function": record["function"],
        "line": record["line"],
    }

    # Add extra fields
    if record["extra"]:
        subset["extra"] = record["extra"]

    return json.dumps(subset)


def formatter(record):
    """Custom log formatter"""
    record["extra"]["serialized"] = serialize(record)
    return "{extra[serialized]}\n"


# Remove default handler
logger.remove()

# Add console handler — human-readable in dev, JSON in production
_is_dev = os.environ.get("DEBUG", "true").lower() in ("true", "1", "yes")

if _is_dev:
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> — <level>{message}</level>",
        level="DEBUG",
        colorize=True,
    )
else:
    logger.add(
        sys.stderr,
        format=formatter,
        level="INFO",
        serialize=False,
    )

# Only add file handlers when not running on Vercel (read-only filesystem)
if not os.environ.get("VERCEL"):
    logger.add(
        "logs/backend.log",
        rotation="500 MB",
        retention="10 days",
        level="INFO",
        format=formatter,
        serialize=False,
    )

    logger.add(
        "logs/backend_errors.log",
        rotation="100 MB",
        retention="30 days",
        level="ERROR",
        format=formatter,
        serialize=False,
    )


# Debug logger - outputs to debug.log when debug mode is enabled
_debug_handler = None


def _get_debug_handler():
    """Get or create the debug file handler"""
    global _debug_handler
    if _debug_handler is None and not os.environ.get("VERCEL"):
        _debug_handler = logger.add(
            "logs/debug.log",
            rotation="50 MB",
            retention="7 days",
            level="DEBUG",
            format=formatter,
            serialize=False,
        )
    return _debug_handler


def is_debug_mode() -> bool:
    """Check if debug mode is enabled"""
    return _debug_mode


def set_debug_mode(enabled: bool) -> bool:
    """Enable or disable debug mode. Returns the new state."""
    global _debug_mode
    with _debug_lock:
        _debug_mode = enabled
        if enabled:
            logger.info("Debug mode enabled")
            _get_debug_handler()
        else:
            logger.info("Debug mode disabled")
    return _debug_mode


def toggle_debug_mode() -> bool:
    """Toggle debug mode. Returns the new state."""
    with _debug_lock:
        return set_debug_mode(not _debug_mode)


def debug(message: str, **kwargs):
    """Log a debug message - only outputs when debug mode is enabled"""
    if _debug_mode:
        logger.debug(message, **kwargs)


def debug_obj(label: str, obj: dict, **kwargs):
    """Log an object with a label - only outputs when debug mode is enabled"""
    if _debug_mode:
        logger.debug(f"[{label}] {obj}", **kwargs)


def debug_request(method: str, path: str, **kwargs):
    """Log an HTTP request - only outputs when debug mode is enabled"""
    if _debug_mode:
        logger.debug(f"REQUEST: {method} {path}", **kwargs)


def debug_response(method: str, path: str, status: int, duration_ms: float = None, **kwargs):
    """Log an HTTP response - only outputs when debug mode is enabled"""
    if _debug_mode:
        msg = f"RESPONSE: {method} {path} -> {status}"
        if duration_ms is not None:
            msg += f" ({duration_ms:.1f}ms)"
        logger.debug(msg, **kwargs)


def debug_db_query(query_type: str, table: str, **kwargs):
    """Log a database query - only outputs when debug mode is enabled"""
    if _debug_mode:
        logger.debug(f"DB_QUERY: {query_type} {table}", **kwargs)


def debug_service_call(service: str, method: str, **kwargs):
    """Log a service call - only outputs when debug mode is enabled"""
    if _debug_mode:
        logger.debug(f"SERVICE_CALL: {service}.{method}", **kwargs)


__all__ = [
    "logger",
    "is_debug_mode",
    "set_debug_mode",
    "toggle_debug_mode",
    "debug",
    "debug_obj",
    "debug_request",
    "debug_response",
    "debug_db_query",
    "debug_service_call",
]