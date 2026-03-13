"""
Database configuration — Supabase (replaces SQLAlchemy)
This module is kept for backward compatibility but Supabase is now the primary database.
Use app.supabase_client for all database operations.
"""
from app.supabase_client import get_supabase, get_supabase_admin

__all__ = ["get_supabase", "get_supabase_admin"]
