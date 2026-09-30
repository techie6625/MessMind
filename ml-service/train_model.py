"""
=============================================================================
FILE: train_model.py
PURPOSE: Loads the generated dataset, encodes features, trains a
         GradientBoostingRegressor with ASYMMETRIC LOSS (Quantile loss),
         evaluates it, and saves the trained model to disk.

KEY CONCEPT — ASYMMETRIC LOSS (THE MOST IMPORTANT PART):
─────────────────────────────────────────────────────────
  Standard ML models try to predict the AVERAGE outcome. They treat
  over-predicting and under-predicting as equally bad.

  BUT IN A MESS / CAFETERIA, THESE ERRORS ARE NOT EQUAL:
    • Under-predict (cook 300 plates, 380 students show up)
      → 80 students go HUNGRY. This is catastrophic. 😱
    • Over-predict (cook 400 plates, 350 students show up)
      → 50 plates wasted. This is bad, but not catastrophic. 😐

  SOLUTION: Quantile (Pinball) Loss with alpha=0.9
  ─────────────────────────────────────────────────
  The "quantile" loss function is ASYMMETRIC. With alpha=0.9:
  
    Loss = alpha * max(actual - predicted, 0)        ← when we UNDER-predict
         + (1 - alpha) * max(predicted - actual, 0)  ← when we OVER-predict

  With alpha=0.9:
    Loss for under-predicting = 0.9 × error  (HEAVY PENALTY)
    Loss for over-predicting  = 0.1 × error  (LIGHT PENALTY)

  This means the model is penalized 9x MORE for predicting too low.
  Result: The model learns to predict the 90th PERCENTILE — i.e., it
  predicts a value that will be ENOUGH for 90% of days.
  This creates a built-in SAFETY BUFFER for the kitchen.
=============================================================================
"""

import pandas as pd                              # For reading CSV data
import numpy as np                               # For numerical operations
from sklearn.ensemble import GradientBoostingRegressor  # Our core ML model
from sklearn.preprocessing import LabelEncoder          # Converts text labels to numbers
from sklearn.model_selection import train_test_split    # Splits data into train/test sets
from sklearn.metrics import mean_absolute_error         # Measures prediction accuracy
import joblib                                    # For saving/loading the trained model
import os                                        # For file path operations

print("=" * 60)
print("🤖 MESS DEMAND FORECASTING — MODEL TRAINING")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Load the dataset we generated with generate_data.py
# ─────────────────────────────────────────────────────────────────────────────
data_path = os.path.join(os.path.dirname(__file__), 'mess_data.csv')
df = pd.read_csv(data_path)  # Read the CSV into a DataFrame
print(f"\n📂 Loaded dataset: {len(df)} rows, {len(df.columns)} columns")
print(df.dtypes)  # Show data types of each column

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: ENCODE CATEGORICAL FEATURES
# Machine learning models work with NUMBERS, not text.
# We use LabelEncoder to convert text categories to integers:
#   'Clear' → 0, 'Rain' → 1
#   'Paneer' → 0, 'Tori' → 1
#   'High' → 0, 'Low' → 1, 'Medium' → 2
# (LabelEncoder assigns numbers alphabetically)
# ─────────────────────────────────────────────────────────────────────────────
le_weather = LabelEncoder()    # Encoder specifically for Weather column
le_menu = LabelEncoder()       # Encoder specifically for Menu_Item column
le_traffic = LabelEncoder()    # Encoder specifically for Delivery_Traffic column

# fit_transform: LEARNS the mapping AND APPLIES it in one step
df['Weather_encoded'] = le_weather.fit_transform(df['Weather'])
df['Menu_encoded'] = le_menu.fit_transform(df['Menu_Item'])
df['Traffic_encoded'] = le_traffic.fit_transform(df['Delivery_Traffic'])

print(f"\n🔤 Label Encoding mappings:")
print(f"   Weather: {dict(zip(le_weather.classes_, le_weather.transform(le_weather.classes_)))}")
print(f"   Menu:    {dict(zip(le_menu.classes_, le_menu.transform(le_menu.classes_)))}")
print(f"   Traffic: {dict(zip(le_traffic.classes_, le_traffic.transform(le_traffic.classes_)))}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: DEFINE FEATURES (X) AND TARGET (y)
# X = the INPUT columns the model uses to make predictions
# y = the OUTPUT column we want to predict (Actual_Attendance)
# ─────────────────────────────────────────────────────────────────────────────
# Feature matrix: 3 encoded columns as input
X = df[['Weather_encoded', 'Menu_encoded', 'Traffic_encoded']]

# Target vector: the attendance number we want to predict
y = df['Actual_Attendance']

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: SPLIT DATA into Training set and Testing set
# We train on 80% of data and evaluate on the remaining 20%.
# This tests whether the model can generalize to UNSEEN data.
# random_state=42 ensures the same split every time (reproducibility).
# ─────────────────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.20,   # 20% of data reserved for testing
    random_state=42   # Fixed seed for reproducible results
)
print(f"\n📊 Data split:")
print(f"   Training samples: {len(X_train)} days")
print(f"   Testing samples:  {len(X_test)} days")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: TRAIN THE MODEL — THE HEART OF THE SYSTEM
#
# GradientBoostingRegressor: An ensemble model that builds many "weak"
# decision trees in sequence, each one correcting the errors of the previous.
# Think of it as 100 junior chefs each fixing the mistakes of the one before.
#
# KEY PARAMETER — loss='quantile', alpha=0.9:
# ───────────────────────────────────────────
# This is what makes our model SPECIAL compared to a basic predictor.
#
# Quantile Regression targets the 90th PERCENTILE of the distribution:
#   → On 90% of days, the actual attendance will be AT or BELOW this prediction
#   → On only 10% of days will more students show up than predicted
#   → This gives the kitchen a comfortable SAFETY BUFFER
#
# MATH BEHIND QUANTILE LOSS:
#   For a given alpha (α) and prediction error (r = actual - predicted):
#     L(r) = α × r      if r > 0  (actual > predicted: we UNDER-predicted)
#     L(r) = (α-1) × r  if r ≤ 0  (actual ≤ predicted: we OVER-predicted)
#
#   With α = 0.9:
#     Under-prediction penalty = 0.9 × |error|  ← 9x heavier
#     Over-prediction penalty  = 0.1 × |error|  ← 1x lighter
#
# RESULT: The model is BIASED to predict higher, preventing food shortages.
# ─────────────────────────────────────────────────────────────────────────────
print("\n🏋️  Training model with Asymmetric Quantile Loss (α=0.9)...")

model = GradientBoostingRegressor(
    loss='quantile',       # ← ASYMMETRIC LOSS: quantile regression
    alpha=0.90,            # ← 90th percentile target (safety buffer!)
    n_estimators=200,      # Build 200 sequential decision trees
    max_depth=4,           # Each tree can have at most 4 levels of splits
    learning_rate=0.05,    # Small steps = better generalization (no overfitting)
    random_state=42        # Reproducibility
)

# .fit() is where the actual training happens — the model learns from data
model.fit(X_train, y_train)
print("✅ Model training complete!")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: EVALUATE THE MODEL on the held-out test set
# Mean Absolute Error (MAE): on average, how many students off is our prediction?
# Example: MAE=15 means "on average, we're 15 students off per day"
# ─────────────────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)  # Make predictions on test data
mae = mean_absolute_error(y_test, y_pred)  # Calculate average error
print(f"\n📈 Model Evaluation:")
print(f"   Mean Absolute Error (MAE): {mae:.2f} students/day")
print(f"   This means our predictions are off by ~{mae:.0f} students on average.")

# Show a few examples of predictions vs actuals
print(f"\n🔍 Sample predictions (first 5 test days):")
print(f"   {'Actual':>8} | {'Predicted':>10} | {'Error':>7}")
print(f"   {'-'*32}")
for actual, pred in zip(y_test.values[:5], y_pred[:5]):
    error = pred - actual
    print(f"   {actual:>8} | {pred:>10.1f} | {error:>+7.1f}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: SAVE THE TRAINED MODEL AND ENCODERS TO DISK
# joblib is the recommended way to save scikit-learn models.
# The saved .joblib files will be loaded by our FastAPI server on startup.
# ─────────────────────────────────────────────────────────────────────────────
model_dir = os.path.dirname(__file__)  # Save in same folder as this script

# Save the trained ML model
model_path = os.path.join(model_dir, 'model.joblib')
joblib.dump(model, model_path)
print(f"\n💾 Model saved to: {model_path}")

# Save each Label Encoder so we can encode new inputs at prediction time
encoder_path = os.path.join(model_dir, 'encoders.joblib')
joblib.dump({
    'weather': le_weather,    # Encoder for Weather
    'menu': le_menu,          # Encoder for Menu_Item
    'traffic': le_traffic     # Encoder for Delivery_Traffic
}, encoder_path)
print(f"💾 Encoders saved to: {encoder_path}")

print("\n" + "=" * 60)
print("🎉 Training pipeline complete! Ready to serve predictions.")
print("=" * 60)
