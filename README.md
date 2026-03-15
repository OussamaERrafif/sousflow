# SoussFlow — Smart Irrigation Platform

<p align="center">
  <img src="https://via.placeholder.com/400x100?text=SoussFlow" alt="SoussFlow Logo" />
</p>

> **SoussFlow** is a smart irrigation management platform designed specifically for olive farms in the Agadir region of Morocco. It provides real-time IoT sensor monitoring, AI-powered predictions, automated alerts, and WhatsApp integration to help farmers optimize water usage and crop yields.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Landing Page Setup](#landing-page-setup)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
- [Features](#features)
  - [IoT Monitoring](#iot-monitoring)
  - [AI Predictions](#ai-predictions)
  - [Smart Alerts](#smart-alerts)
  - [WhatsApp Integration](#whatsapp-integration)
  - [Chat with AI Assistant](#chat-with-ai-assistant)
- [API Documentation](#api-documentation)
- [Authentication & Roles](#authentication--roles)
- [Development](#development)
  - [Running Tests](#running-tests)
  - [Code Quality](#code-quality)
  - [Codegen](#codegen)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

SoussFlow is a comprehensive smart irrigation platform that enables olive farmers in the Agadir, Morocco region to:

- **Monitor** real-time soil moisture, temperature, and environmental conditions
- **Predict** irrigation needs using AI/ML models
- **Automate** alerts when conditions require attention
- **Integrate** with WhatsApp for remote notifications
- **Chat** with an AI assistant for insights and recommendations

The platform follows a farm-scoped, role-based access control model with three user roles: Super Admin, Farm Owner, and Farm Employee.

---

## Architecture

SoussFlow consists of three main components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Landing Page  │     │  Frontend App  │     │   Backend API  │
│   (Marketing)   │     │  (Dashboard)   │     │   (FastAPI)    │
│   Next.js 16   │     │   Next.js 16   │     │    Python      │
│    TypeScript  │     │    TypeScript   │     │    3.11+       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │   Supabase    │
                          │  (PostgreSQL) │
                          └───────────────┘
```

### Backend (`backend/`)
- **FastAPI** REST API with Python 3.11+
- **Supabase** PostgreSQL database
- **JWT** authentication with bcrypt password hashing
- **OpenAI** integration for AI chat and predictions
- **Wassender** API for WhatsApp messaging
- Built-in **IoT Simulator** for development/testing

### Frontend (`frontend/`)
- **Next.js 16** with App Router
- **Redux Toolkit** + RTK Query for state management
- **TypeScript** throughout
- **next-intl** for internationalization (Arabic/French)
- Auto-generated API types from OpenAPI schema

### Landing Page (`landingpage/`)
- **Next.js 16** marketing site
- **next-intl** for Arabic/French localization
- Responsive design with RTL support
- Mockup components showcasing the dashboard

---

## Tech Stack

| Component | Technology |
|----------|------------|
| Backend | FastAPI, Python 3.11+ |
| Frontend | Next.js 16, React, TypeScript |
| Landing Page | Next.js 16, TypeScript |
| Database | PostgreSQL (Supabase) |
| Authentication | JWT, bcrypt |
| AI/ML | OpenAI API |
| WhatsApp | Wassender API |
| State Management | Redux Toolkit, RTK Query |
| i18n | next-intl (ar, fr) |
| Styling | Tailwind CSS |
| Testing | pytest |

---

## Project Structure

```
sousflow/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── routes/           # API route handlers
│   │   │   ├── auth_routes.py
│   │   │   ├── admin_routes.py
│   │   │   ├── farm_routes.py
│   │   │   ├── iot_routes.py
│   │   │   ├── conversation_routes.py
│   │   │   ├── openai_routes.py
│   │   │   ├── whatsapp_routes.py
│   │   │   └── prediction_routes.py
│   │   ├── services/          # Business logic
│   │   │   ├── farm_service.py
│   │   │   ├── iot_service.py
│   │   │   ├── iot_simulator.py
│   │   │   ├── openai_service.py
│   │   │   ├── whatsapp_service.py
│   │   │   └── prediction_service.py
│   │   ├── schemas/           # Pydantic models
│   │   │   ├── auth.py
│   │   │   ├── farm.py
│   │   │   ├── iot.py
│   │   │   ├── openai_schemas.py
│   │   │   ├── prediction.py
│   │   │   └── whatsapp.py
│   │   ├── auth.py            # JWT authentication
│   │   ├── config.py          # Settings management
│   │   ├── database.py        # Supabase connection
│   │   ├── supabase_client.py
│   │   └── logging_config.py
│   ├── main.py               # Application entry point
│   ├── requirements.txt
│   ├── supabase_schema_v2.sql # Database schema
│   ├── supabase_seed.sql     # Seed data
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── frontend/                  # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/     # Internationalized routes
│   │   │   │   ├── page.tsx  # Main dashboard
│   │   │   │   └── layout.tsx
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── components/
│   │   │   ├── pages/         # Page components
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── ZonesPage.tsx
│   │   │   │   ├── PumpsPage.tsx
│   │   │   │   ├── AlertsPage.tsx
│   │   │   │   ├── ReportsPage.tsx
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   └── AIAssistancePage.tsx
│   │   │   ├── ui/            # Reusable UI components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ZoneGrid.tsx
│   │   │   ├── StatsRow.tsx
│   │   │   ├── AlertPanel.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── store/        # Redux store
│   │   │   │   ├── apiSlice.ts
│   │   │   │   ├── slices/
│   │   │   │   │   ├── authSlice.ts
│   │   │   │   │   └── iotSlice.ts
│   │   │   │   ├── generated/
│   │   │   │   │   └── api.ts  # Auto-generated
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   └── utils.ts
│   │   ├── i18n/             # Internationalization
│   │   └── middleware.ts
│   ├── messages/             # Translation files
│   │   ├── ar.json
│   │   └── fr.json
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│
├── landingpage/               # Marketing landing page
│   ├── src/
│   │   ├── app/
│   │   │   └── [locale]/
│   │   ├── components/
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── Testimonials.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── FAQ.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── mockups/     # Dashboard mockups
│   │   └── i18n/
│   ├── package.json
│   └── next.config.ts
│
├── CLAUDE.md                 # AI development guide
├── IMPLEMENTATION_PLAN.md    # Detailed implementation plan
└── README.md                 # This file
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|------------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |
| Supabase Account | - |

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # Linux/Mac
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

5. **Configure your environment variables** (see [Configuration](#configuration))

6. **Run the backend server:**
   ```bash
   python main.py
   # or
   uvicorn main:app --reload
   ```

The backend will be available at `http://localhost:8000`

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Debug Dashboard**: http://localhost:8000/dashboard

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure the API URL:**
   Ensure `NEXT_PUBLIC_API_URL=http://localhost:8000` in your `.env`

5. **Run the development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`

### Landing Page Setup

1. **Navigate to the landing page directory:**
   ```bash
   cd landingpage
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

The landing page will be available at `http://localhost:3001`

---

## Configuration

### Environment Variables

#### Backend (`backend/.env`)

```env
# Supabase Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET_KEY=your_jwt_secret_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# WhatsApp (Wassender)
WASSENDER_ENABLED=true
WASSENDER_API_KEY=your_wassender_api_key
WASSENDER_DEVICE_ID=your_device_id

# IoT Simulator
IOT_SIMULATOR_ENABLED=true
IOT_SIMULATOR_ZONES=4
IOT_SIMULATOR_INTERVAL=30
IOT_SIMULATOR_FARM_ID=your_farm_id
```

#### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Database Setup

1. **Create a Supabase project** at https://supabase.com

2. **Run the schema** (in Supabase SQL Editor):
   ```bash
   # First, run the schema
   backend/supabase_schema_v2.sql

   # Then, run the seed data
   backend/supabase_seed.sql
   ```

3. **Default Credentials** (from seed):
   - Username: `admin`
   - Password: `admin123`

---

## Features

### IoT Monitoring

- **Real-time sensor data** collection from multiple zones
- **Historical data** storage and visualization
- **Zone-based monitoring** with individual controls
- **Pump status** tracking and control

### AI Predictions

- **Irrigation recommendations** based on soil moisture, weather, and crop needs
- **7-day forecast** predictions
- **ML-powered insights** for optimal watering schedules

### Smart Alerts

- **Threshold-based alerts** for critical conditions
- **Customizable rules** per zone
- **Alert history** tracking

### WhatsApp Integration

- **Automated notifications** to farmers
- **Critical alerts** delivered via WhatsApp
- **Two-way communication** capability

### Chat with AI Assistant

- **Natural language queries** about farm data
- **Context-aware responses** using farm-specific sensor data
- **Conversation history** persistence

---

## API Documentation

Once the backend is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/profile` | Get user profile |
| GET | `/api/farms` | List farms |
| GET | `/api/iot/readings` | Get IoT readings |
| POST | `/api/iot/readings` | Create reading |
| GET | `/api/predictions` | Get predictions |
| POST | `/api/chat` | Chat with AI |
| POST | `/api/whatsapp/send` | Send WhatsApp message |

---

## Authentication & Roles

SoussFlow uses a **role-based access control (RBAC)** system:

| Role | Description | Access Level |
|------|-------------|--------------|
| `superadmin` | App developer | Full system access via backend dashboard |
| `farm_owner` | Farm business owner | Full CRUD on their farm's data, employees, alerts |
| `farm_employee` | Farm worker | Read data; write IoT readings |

### Auth Flow

1. **Login**: User provides username/password
2. **JWT Token**: Backend issues a JWT token
3. **Profile Fetch**: Frontend calls `/api/auth/profile` to get role and farm context
4. **Farm Selection**: Users with multiple farms can switch between them
5. **Request Headers**: Each API request includes `X-Farm-ID` header

### Permissions (Farm Employees)

```json
{
  "read": true,
  "write_readings": true,
  "manage_alerts": false,
  "manage_employees": false
}
```

---

## Development

### Running Tests

**Backend:**
```bash
cd backend
pytest
pytest --cov=app tests/
```

### Code Quality

**Backend:**
```bash
cd backend
black .
isort .
flake8
mypy .
```

**Frontend:**
```bash
cd frontend
npm run lint
```

### Codegen

> ⚠️ **Important**: After any backend API changes, you must regenerate the frontend API types.

```bash
# Ensure backend is running first
cd backend
python main.py

# In another terminal, run codegen
cd frontend
npm run codegen
```

This regenerates `src/lib/store/generated/api.ts` with updated RTK Query hooks.

---

## Deployment

### Backend (Vercel)

The backend includes Vercel configuration:

```bash
cd backend
vercel deploy
```

### Frontend (Vercel)

```bash
cd frontend
vercel deploy
```

### Docker

```bash
# Backend only
cd backend
docker-compose up --build

# Or build individually
docker build -t sousflow-backend .
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

For security vulnerabilities, please read our [Security Policy](SECURITY.md).

---

<p align="center">
  Built with ❤️ for Moroccan Olive Farmers
</p>
