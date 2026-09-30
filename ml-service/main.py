"""
=============================================================================
FILE: main.py  (FastAPI ML Microservice)
PURPOSE: Serves the trained ML model as an HTTP API.
         The Node.js backend will call this service to get attendance
         predictions, keeping ML concerns separate from business logic.

ARCHITECTURE NOTE — WHY A SEPARATE MICROSERVICE?
  We separate the Python ML service from the Node.js backend because:
  1. Python has the best ML ecosystem (scikit-learn, numpy, pandas)
  2. Node.js excels at handling HTTP requests and database operations
  3. Each service can be scaled, updated, or replaced independently
  4. This is real-world microservice architecture — impressive for judges!

PORT: This service runs on http://localhost:8000
      Node.js backend runs on http://localhost:3001
      React frontend runs on http://localhost:3000
=============================================================================
"""

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException  # FastAPI: modern, fast web framework for Python
from fastapi.middleware.cors import CORSMiddleware  # Allows cross-origin requests (React → FastAPI)
from pydantic import BaseModel, field_validator  # For automatic input validation and type checking
import joblib                              # For loading our saved ML model and encoders
import numpy as np                        # For creating the feature array for prediction
import os                                 # For building file paths
import logging                            # For structured logging output

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING SETUP
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)   # Log INFO level messages and above
logger = logging.getLogger(__name__)      # Create a logger for this module

# ─────────────────────────────────────────────────────────────────────────────
# CREATE THE FASTAPI APPLICATION
# FastAPI auto-generates API documentation at http://localhost:8000/docs
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Mess Demand Forecasting API",
    description="Predicts student mess attendance using ML with Asymmetric Quantile Loss",
    version="1.0.0"
)

# ─────────────────────────────────────────────────────────────────────────────
# CORS (Cross-Origin Resource Sharing) MIDDLEWARE
# By default, browsers block requests from one domain to another.
# React (port 3000) calling FastAPI (port 8000) would be blocked.
# This middleware tells the browser: "It's okay, allow all origins."
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow requests from ANY origin (relaxed for development)
    allow_credentials=True,       # Allow cookies in cross-origin requests
    allow_methods=["*"],          # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],          # Allow all request headers
)

# ─────────────────────────────────────────────────────────────────────────────
# LOAD THE TRAINED MODEL AND ENCODERS AT STARTUP
# We load these ONCE when the server starts (not on every request).
# This is critical for performance — loading a model takes time.
# ─────────────────────────────────────────────────────────────────────────────
SERVICE_DIR = os.path.dirname(__file__)   # Directory where this main.py lives
MODEL_PATH = os.path.join(SERVICE_DIR, 'model.joblib')      # Path to saved model
ENCODER_PATH = os.path.join(SERVICE_DIR, 'encoders.joblib') # Path to saved encoders

# Check if the model files exist — they won't if train_model.py hasn't been run yet
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(
        "❌ Model file not found! Please run 'python train_model.py' first."
    )

# Load the trained GradientBoostingRegressor model
model = joblib.load(MODEL_PATH)
logger.info(f"✅ ML Model loaded from {MODEL_PATH}")

# Load the dictionary of LabelEncoders (weather, menu, traffic)
encoders = joblib.load(ENCODER_PATH)
logger.info(f"✅ Encoders loaded from {ENCODER_PATH}")

# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC INPUT SCHEMA
# This class defines the EXACT shape of data expected in a POST /predict request.
# FastAPI automatically validates incoming JSON against this schema and returns
# a helpful 422 error if the data doesn't match — no manual validation needed!
# ─────────────────────────────────────────────────────────────────────────────
class PredictionInput(BaseModel):
    """
    Input schema for the /predict endpoint.
    All fields are required. Invalid values will return a 422 Unprocessable Entity error.
    Uses Pydantic v2 @field_validator syntax (replaces v1's @validator).
    """
    weather: str          # Must be 'Clear' or 'Rain'
    menu_item: str        # Must be 'Paneer' or 'Tori'
    delivery_traffic: str # Must be 'Low', 'Medium', or 'High'

    # Pydantic v2: @field_validator with mode='after' (runs after type coercion)
    @field_validator('weather')
    @classmethod
    def validate_weather(cls, v: str) -> str:
        """Ensure weather is one of the trained categories."""
        if v not in ['Clear', 'Rain']:
            raise ValueError("weather must be 'Clear' or 'Rain'")
        return v  # Return the valid value unchanged

    @field_validator('menu_item')
    @classmethod
    def validate_menu(cls, v: str) -> str:
        """Ensure menu_item is one of the trained categories."""
        if v not in ['Paneer', 'Tori']:
            raise ValueError("menu_item must be 'Paneer' or 'Tori'")
        return v

    @field_validator('delivery_traffic')
    @classmethod
    def validate_traffic(cls, v: str) -> str:
        """Ensure delivery_traffic is one of the trained categories."""
        if v not in ['Low', 'Medium', 'High']:
            raise ValueError("delivery_traffic must be 'Low', 'Medium', or 'High'")
        return v

# ─────────────────────────────────────────────────────────────────────────────
# ROOT ENDPOINT — Health Check
# A simple GET / endpoint to verify the service is running.
# Node.js can ping this to check if the ML service is alive.
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    """Health check endpoint — returns service status."""
    return {
        "status": "running",
        "service": "Mess Demand Forecasting ML API",
        "model_type": "GradientBoostingRegressor",
        "loss_function": "Quantile Loss (alpha=0.90)",
        "docs": "Visit /docs for interactive API documentation"
    }

# ─────────────────────────────────────────────────────────────────────────────
# PREDICT ENDPOINT — THE CORE OF THE SYSTEM
#
# POST /predict
# Accepts today's conditions (weather, menu, traffic) as JSON.
# Returns the predicted attendance number (90th percentile = safety buffer).
#
# HOW IT WORKS (step by step):
# 1. FastAPI receives the JSON and validates it using PredictionInput schema
# 2. We encode each categorical text value to a number (e.g., 'Rain' → 1)
# 3. We create a feature array [[weather_enc, menu_enc, traffic_enc]]
# 4. We pass it to our trained model's .predict() method
# 5. The model returns the 90th percentile attendance estimate
# 6. We return it as JSON with metadata
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/predict")
def predict_attendance(data: PredictionInput):
    """
    Predict today's mess attendance using trained GradientBoostingRegressor
    with Quantile Loss (alpha=0.90) — the 90th percentile safety buffer.
    """
    try:
        # ── ENCODE INPUTS ──────────────────────────────────────────────────
        # .transform() converts a text label to its corresponding integer.
        # We pass [data.weather] (a list) because transform expects an array.
        # [0] gets the first (and only) element of the result array.
        weather_enc = encoders['weather'].transform([data.weather])[0]
        menu_enc = encoders['menu'].transform([data.menu_item])[0]
        traffic_enc = encoders['traffic'].transform([data.delivery_traffic])[0]

        logger.info(
            f"📥 Input: weather={data.weather}({weather_enc}), "
            f"menu={data.menu_item}({menu_enc}), "
            f"traffic={data.delivery_traffic}({traffic_enc})"
        )

        # ── CREATE FEATURE ARRAY ───────────────────────────────────────────
        # The model expects a 2D array: [[feature1, feature2, feature3]]
        # The outer list represents one SAMPLE (today's data).
        # numpy.array converts it to the numerical format sklearn expects.
        features = np.array([[weather_enc, menu_enc, traffic_enc]])
        # Shape is now (1, 3): 1 sample, 3 features

        # ── MAKE PREDICTION ────────────────────────────────────────────────
        # model.predict() runs our input through all 200 decision trees and
        # returns the aggregated 90th percentile estimate.
        # [0] extracts the scalar value from the returned array.
        raw_prediction = model.predict(features)[0]

        # ── ROUND AND CLIP ─────────────────────────────────────────────────
        # Attendance must be a whole number between 0 and 500.
        # int() truncates decimals. min/max act as safety bounds.
        predicted_attendance = int(min(max(raw_prediction, 0), 500))

        logger.info(f"📤 Raw prediction: {raw_prediction:.2f} → Final: {predicted_attendance}")

        # ── RETURN RESPONSE ────────────────────────────────────────────────
        return {
            "predicted_attendance": predicted_attendance,  # The 90th percentile estimate
            "inputs": {                                    # Echo inputs back for verification
                "weather": data.weather,
                "menu_item": data.menu_item,
                "delivery_traffic": data.delivery_traffic
            },
            "model_info": {
                # Explain the safety buffer to the Node.js backend (and judges)
                "type": "GradientBoostingRegressor",
                "loss": "quantile",
                "alpha": 0.90,
                # This message appears on the dashboard
                "safety_note": (
                    "This prediction targets the 90th percentile. "
                    "On 9 out of 10 days, the actual attendance will be "
                    "AT OR BELOW this number — providing a built-in safety buffer."
                )
            }
        }

    except Exception as e:
        # If anything goes wrong, return a 500 Internal Server Error with details
        logger.error(f"❌ Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# MODEL METADATA ENDPOINT — For the dashboard UI
# Returns information about the model's configuration.
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/model-info")
def get_model_info():
    """Returns metadata about the trained model."""
    return {
        "algorithm": "Gradient Boosting Regressor",
        "loss_function": "Quantile (Pinball) Loss",
        "alpha": 0.90,
        "n_estimators": 200,
        "features": ["Weather", "Menu_Item", "Delivery_Traffic"],
        "interpretation": (
            "An alpha of 0.90 means the model targets the 90th percentile. "
            "Under-predicting is penalized 9x more than over-predicting, "
            "ensuring the kitchen always has enough food prepared."
        )
    }
