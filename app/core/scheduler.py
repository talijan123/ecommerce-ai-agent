"""
Background Task Scheduler for Periodic Jobs.
Uses APScheduler's BackgroundScheduler to run background cron jobs such as
WhatsApp Abandoned Cart Recovery at configurable intervals without blocking FastAPI.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton BackgroundScheduler instance
scheduler = BackgroundScheduler()


def start_scheduler():
    """
    Start the APScheduler instance if not already running.
    Registers the periodic abandoned cart recovery background worker.
    """
    if not settings.ENABLE_RECOVERY_SCHEDULER:
        logger.info("⏸️  [Scheduler] Abandoned cart recovery scheduler is disabled (ENABLE_RECOVERY_SCHEDULER=False).")
        return

    if scheduler.running:
        logger.info("ℹ️  [Scheduler] APScheduler is already active and running.")
        return

    from app.services.cart_recovery import process_abandoned_cart_recoveries

    interval_minutes = max(1, int(settings.RECOVERY_CRON_INTERVAL_MINUTES))

    try:
        scheduler.add_job(
            func=process_abandoned_cart_recoveries,
            trigger=IntervalTrigger(minutes=interval_minutes),
            id="abandoned_cart_recovery_cron",
            name="Automated WhatsApp Abandoned Cart Recovery",
            replace_existing=True,
            misfire_grace_time=300,
        )
        scheduler.start()
        logger.info(
            f"🚀 [Scheduler] APScheduler background worker started successfully. "
            f"Abandoned cart recovery will run every {interval_minutes} minute(s)."
        )
    except Exception as e:
        logger.error(f"❌ [Scheduler] Failed to initialize APScheduler: {e}", exc_info=True)


def shutdown_scheduler():
    """Gracefully shutdown the APScheduler background worker."""
    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
            logger.info("🛑 [Scheduler] APScheduler stopped cleanly.")
        except Exception as e:
            logger.warning(f"⚠️ [Scheduler] Error during APScheduler shutdown: {e}")

