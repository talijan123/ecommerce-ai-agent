"""
FastAPI Main Application Entrypoint.
Includes CORS Middleware, Lifespan Database Initialization, and API Routers.
"""

from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, get_db, ensure_db_initialized, create_db_and_tables
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.api.v1.api import api_router
from app.api.v1.endpoints.admin import list_products
from app.api.v1.endpoints.chat import send_chat_message
from app.schemas.chat import ChatRequest, ChatResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan:
    - Runs on startup: Creates all database tables, seeds catalog if empty, and starts background workers.
    - Runs on shutdown: Gracefully shuts down background scheduler and cleans up resources.
    """
    try:
        ensure_db_initialized()
    except Exception as e:
        print(f"Database initialization warning: {e}")

    try:
        start_scheduler()
    except Exception as e:
        print(f"Scheduler startup warning: {e}")

    yield

    try:
        shutdown_scheduler()
    except Exception as e:
        print(f"Scheduler shutdown warning: {e}")



app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Ready Autonomous E-Commerce AI Agent API with OpenAI Tool Calling & Supabase/PostgreSQL Support.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Explicitly Whitelisted Origins (Production Vercel + Local Development)
ALLOWED_ORIGINS: List[str] = [
    "https://ecommerce-store-frontend-swart.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Include additional origins from environment settings if provided
for origin in settings.CORS_ORIGINS:
    if origin and origin != "*" and origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(origin)

# CORS Middleware Configuration with exact origin list & Vercel preview regex
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

# Include API v1 and API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")
app.include_router(api_router)


@app.get("/")
def root_home():
    return {"status": "ok", "service": "Autonomous E-Commerce AI Agent API"}


@app.get("/api", tags=["System"])
@app.get("/api/v1", tags=["System"])
def root():
    """Root status endpoint."""
    return {"status": "ok", "service": "Autonomous E-Commerce AI Agent API"}


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
@app.get("/api/v1/health", tags=["System"])
def health_check():
    """Health check endpoint for container orchestrators, dashboards, and load balancers."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "operational": True,
    }


@app.get("/products", tags=["Catalog"])
@app.get("/api/products", tags=["Catalog"])
@app.get("/api/v1/products", tags=["Catalog"])
def get_products_catalog(db: Session = Depends(get_db)):
    """List all products (alias for /admin/products)."""
    return list_products(db)


@app.post("/chat/turn", response_model=ChatResponse, tags=["Chat & Agent"])
@app.post("/api/chat/turn", response_model=ChatResponse, tags=["Chat & Agent"])
@app.post("/api/v1/chat/turn", response_model=ChatResponse, tags=["Chat & Agent"])
def chat_turn(payload: ChatRequest, db: Session = Depends(get_db)):
    """Execute an autonomous agent conversation turn (alias for /chat)."""
    return send_chat_message(payload, db)


@app.get("/api/docs", include_in_schema=False)
def api_docs_redirect():
    """Redirect /api/docs to /docs."""
    return RedirectResponse(url="/docs")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global unhandled exception safety net ensuring JSON response with CORS."""
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "InternalServerError", "message": str(exc)},
        headers=headers,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
