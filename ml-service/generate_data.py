"""
=============================================================================
FILE: generate_data.py
PURPOSE: Generates a realistic synthetic dataset of 365 days of mess
         attendance records. This is used to TRAIN our ML model.

WHY SYNTHETIC DATA?
  In a real system, you'd collect months of historical mess data.
  For a hackathon MVP, we simulate it with logical rules that mirror
  real-world patterns (rain = more students eat in, bad menu = fewer eat in).
=============================================================================
"""

import pandas as pd   # For creating and saving tabular data (like Excel in Python)
import numpy as np    # For numerical operations and random number generation
import os             # For file path operations

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Set a "random seed" so our data is reproducible.
# Every time we run this script, we'll get the SAME random numbers.
# This is essential for debugging and fair evaluation.
# ─────────────────────────────────────────────────────────────────────────────
np.random.seed(42)  # 42 is just a convention (from "Hitchhiker's Guide to the Galaxy")

# Total number of days to simulate (1 full academic year)
NUM_DAYS = 365

# Total number of students enrolled in the mess
TOTAL_STUDENTS = 500

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Generate the WEATHER column.
# We simulate realistic weather: 70% of days are Clear, 30% are Rainy.
# np.random.choice picks randomly from a list, with specified probabilities.
# ─────────────────────────────────────────────────────────────────────────────
weather = np.random.choice(
    ['Clear', 'Rain'],          # The two possible weather states
    size=NUM_DAYS,              # Generate one value per day
    p=[0.70, 0.30]              # 70% Clear, 30% Rain (Mumbai-like climate)
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Generate the MENU_ITEM column.
# We alternate between 'Paneer' (popular) and 'Tori' (less popular).
# This simulates how menu affects student turnout.
# ─────────────────────────────────────────────────────────────────────────────
menu_item = np.random.choice(
    ['Paneer', 'Tori'],         # Paneer = rich curry, Tori = bottle gourd (less liked)
    size=NUM_DAYS,
    p=[0.50, 0.50]              # Served equally often, but impact on attendance differs
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Generate the DELIVERY_TRAFFIC column.
# This is our PROXY for student disposable income / tendency to eat out.
# High traffic on Zomato/Swiggy = students ordering food = absent from mess.
# Low traffic = students are broke or staying in = present at mess.
# ─────────────────────────────────────────────────────────────────────────────
delivery_traffic = np.random.choice(
    ['Low', 'Medium', 'High'],  # Three levels of delivery app usage
    size=NUM_DAYS,
    p=[0.40, 0.35, 0.25]        # More Low days (students usually eat in mess)
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Calculate ACTUAL_ATTENDANCE using domain-logic rules.
# This is the core of our simulation — we define HOW each variable affects
# student attendance, creating patterns for the ML model to learn.
#
# BASE ATTENDANCE: Start with 75% baseline (375 out of 500 students).
# ─────────────────────────────────────────────────────────────────────────────
base_attendance = np.full(NUM_DAYS, 375)  # Start everyone at 375

# --- WEATHER EFFECT ---
# Rain: Students don't want to go out to restaurants, so MORE come to mess.
# We add up to +30 students on rainy days.
weather_effect = np.where(
    weather == 'Rain',
    np.random.randint(15, 30, NUM_DAYS),   # Rainy: big boost to attendance
    np.random.randint(-20, 5, NUM_DAYS)    # Clear: some students eat out, slight drop
)

# --- MENU EFFECT ---
# Paneer: Popular dish → more students come. Tori: Unpopular → students skip.
menu_effect = np.where(
    menu_item == 'Paneer',
    np.random.randint(20, 50, NUM_DAYS),   # Paneer day: big draw
    np.random.randint(-40, -10, NUM_DAYS)  # Tori day: students flee to Zomato
)

# --- DELIVERY TRAFFIC EFFECT ---
# High delivery traffic = students eating out = FEWER in mess.
# Low delivery traffic = students eating in = MORE in mess.
traffic_effect = np.where(
    delivery_traffic == 'High',
    np.random.randint(-60, -30, NUM_DAYS),  # High traffic: big drop (students eating out)
    np.where(
        delivery_traffic == 'Medium',
        np.random.randint(-20, 10, NUM_DAYS),  # Medium: moderate effect
        np.random.randint(10, 30, NUM_DAYS)    # Low traffic: students staying in mess
    )
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Combine all effects and add NOISE.
# Real data is never perfectly predictable — students are unpredictable!
# We add Gaussian (bell-curve) noise with mean=0, std=15.
# np.clip ensures attendance stays between 200 and 500 (realistic bounds).
# ─────────────────────────────────────────────────────────────────────────────
noise = np.random.normal(0, 15, NUM_DAYS)  # Random noise ~ Normal(mean=0, std=15)

actual_attendance = base_attendance + weather_effect + menu_effect + traffic_effect + noise

# Clip: attendance can never be below 200 or above 500 (the total enrolled)
actual_attendance = np.clip(actual_attendance, 200, TOTAL_STUDENTS).astype(int)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Bundle everything into a Pandas DataFrame (like a Python spreadsheet)
# and save it as a CSV file that our training script will read.
# ─────────────────────────────────────────────────────────────────────────────
data = pd.DataFrame({
    'Weather': weather,                        # 'Clear' or 'Rain'
    'Menu_Item': menu_item,                    # 'Paneer' or 'Tori'
    'Delivery_Traffic': delivery_traffic,      # 'Low', 'Medium', or 'High'
    'Actual_Attendance': actual_attendance     # The TARGET we want to predict
})

# Save to CSV in the same directory as this script
output_path = os.path.join(os.path.dirname(__file__), 'mess_data.csv')
data.to_csv(output_path, index=False)  # index=False: don't write row numbers

print(f"✅ Dataset generated: {NUM_DAYS} days of data saved to '{output_path}'")
print(f"📊 Attendance stats:")
print(f"   Min: {actual_attendance.min()} students")
print(f"   Max: {actual_attendance.max()} students")
print(f"   Mean: {actual_attendance.mean():.1f} students")
print(data.head(10).to_string())  # Print first 10 rows for verification
