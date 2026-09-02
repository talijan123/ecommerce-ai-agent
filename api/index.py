"""
Vercel Serverless Entrypoint for FastAPI Application.
Handles ASGI path preservation, serverless database initialization, and root routing.
"""

import os
import sys
import urllib.parse

# Add project root directory to sys.path so 'app' module can be imported in serverless environments
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.main import app
from app.core.database import ensure_db_initialized, create_db_and_tables

# Ensure database tables and mock seed data exist on serverless cold start
try:
    ensure_db_initialized()
except Exception as e:
    print(f"Serverless DB cold-start initialization warning: {e}")


class VercelPathMiddleware:
    """
    ASGI Middleware to preserve the original requested URL path on Vercel deployments.
    Vercel rewrites (e.g. source: '/(.*)' -> destination: '/api/index.py') often pass '/'
    or '/api/index.py' in scope['path']. This middleware extracts the original matched
    path from platform headers ('x-matched-path', 'x-forwarded-uri', 'x-original-url', etc.)
    and rewrites scope['path'] so FastAPI routers match correctly.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            headers = dict(scope.get("headers", []))

            forwarded_path = None
            for h_name in (
                b"x-matched-path",
                b"x-forwarded-uri",
                b"x-original-url",
                b"x-rewrite-url",
                b"x-now-route-matches",
            ):
                raw_val = headers.get(h_name)
                if not raw_val:
                    continue

                decoded = raw_val.decode("latin1")

                # Handle x-now-route-matches query string format (e.g. '1=api%2Fv1%2Fproducts')
                if h_name == b"x-now-route-matches":
                    try:
                        matches = urllib.parse.parse_qs(decoded)
                        if "1" in matches and matches["1"]:
                            candidate = "/" + matches["1"][0].lstrip("/")
                            if candidate and not candidate.startswith("/api/index"):
                                forwarded_path = candidate
                                break
                    except Exception:
                        pass
                    continue

                clean = decoded.split("?")[0].strip()
                if clean and not clean.startswith("/api/index"):
                    forwarded_path = clean
                    break

            if forwarded_path:
                if not forwarded_path.startswith("/"):
                    forwarded_path = "/" + forwarded_path
                scope["path"] = forwarded_path
                scope["raw_path"] = forwarded_path.encode("latin1")

        await self.app(scope, receive, send)


# Register path preservation middleware
app.add_middleware(VercelPathMiddleware)


# Ensure root route handler exists for health / status checks
@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def root():
    return {"status": "ok", "service": "Autonomous E-Commerce AI Agent API"}


# Support Mangum or standard ASGI callable handler
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    handler = app
