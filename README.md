# 🍱 AI-Powered Mess Demand Forecasting System

> **Hackathon MVP** — Reducing food waste in college mess halls using Machine Learning

## 🏗️ Architecture

```
┌─────────────────┐     HTTP      ┌─────────────────┐     HTTP      ┌──────────────────┐
│  React Frontend │  ──────────▶  │  Node.js Backend│  ──────────▶  │  Python FastAPI  │
│  (Port 3000)    │  ◀──────────  │  (Port 3001)    │  ◀──────────  │  ML Microservice │
└─────────────────┘               └────────┬────────┘               │  (Port 8000)     │
                                           │                         └──────────────────┘
                                     SQLite DB
                                    (mess.db)
```

## 🚀 Quick Start (Run All 3 Servers)

### Step 1 — Python ML Service
```bash
cd ml-service
pip install -r requirements.txt
python generate_data.py      # Generate training data
python train_model.py        # Train the model (saves model.joblib)
uvicorn main:app --reload --port 8000   # Start FastAPI server
```

### Step 2 — Node.js Backend (new terminal)
```bash
cd backend
npm install
node server.js               # Start Express on port 3001
```

### Step 3 — React Frontend (new terminal)
```bash
cd frontend
npm install
npx tailwindcss init         # Init Tailwind (if not done)
npm start                    # Start React on port 3000
```

## 🧮 The AI — Asymmetric Quantile Loss

The core innovation is training with **Quantile Loss (α = 0.90)**:

| Scenario | Standard Model | Our Model |
|---|---|---|
| Under-predict by 50 | Penalty = 50 | **Penalty = 0.9 × 50 = 45** |
| Over-predict by 50 | Penalty = 50 | **Penalty = 0.1 × 50 = 5** |

This makes our model **9× more afraid of predicting too low** than too high → automatic safety buffer.

## 📁 File Structure

```
Hackathon-Project-2/
├── ml-service/
│   ├── generate_data.py   # Synthetic dataset generator (365 days)
│   ├── train_model.py     # Model training with quantile loss
│   ├── main.py            # FastAPI prediction API
│   └── requirements.txt
├── backend/
│   ├── server.js          # Express API (SQLite + ML proxy)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.js         # All React components (Student + Dashboard)
    │   └── index.js
    └── package.json
```
