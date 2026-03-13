"""
Logging configuration using Loguru
"""
import os
import sys
from loguru import logger
import json


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

# Add console handler with JSON format
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


__all__ = ["logger"]