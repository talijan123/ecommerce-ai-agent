import os
import sys

# Add project root directory to sys.path so 'app' module can be imported in serverless environments
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.main import app


@app.get("/")
def root_check():
    return {"status": "ok", "service": "FastAPI Backend"}
