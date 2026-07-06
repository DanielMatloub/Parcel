# Parcel

Look up zoning laws and restrictions for any location in San Francisco.

**Live demo:** https://parcel-chi-six.vercel.app

## What it does

Click anywhere on the map to instantly see:
- The zoning code and district name for that location
- A plain-English explanation of what you can build or do there
- A link to the official San Francisco Planning Code

## Tech stack

- **Frontend:** React, Leaflet.js
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL + PostGIS (Supabase)
- **AI:** Anthropic Claude API
- **Deployment:** Railway (backend), Vercel (frontend)

## How it works

1. User clicks a location on the map
2. Frontend sends lat/lng to the FastAPI backend
3. Backend queries PostGIS using `ST_Intersects` to find the matching zoning district
4. Zone code is passed to Claude which returns a plain-English interpretation
5. Result is displayed in the sidebar

## Running locally

**Prerequisites:** Python 3.11+, Node.js, Docker

```bash
# Start PostGIS
docker run --name zoning-db --platform linux/amd64 \
  -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=zoning \
  -p 5432:5432 -d postgis/postgis

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
```

Add a `.env` file in `backend/` with:
```bash
ANTHROPIC_API_KEY=your-key-here
```
## Data

Zoning data sourced from [DataSF](https://data.sfgov.org/Geographic-Locations-and-Boundaries/Zoning-Map-Zoning-Districts/3i4a-hu95) — 10,617 zoning districts covering all of San Francisco.