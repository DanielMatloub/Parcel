# Parcel

Look up zoning laws and restrictions for any location in San Francisco.

![Parcel desktop UI](screenshots/desktop.png)

**Live demo:** https://parcel-chi-six.vercel.app

## Features

- Address search with map flyTo
- Click anywhere on the map
- Plain-English zoning interpretations powered by Claude
- Responsive — desktop sidebar and mobile bottom sheet
- 30 free searches per user, then $5 for unlimited via Stripe
- Interpretation caching to minimize API costs
- PostGIS spatial index for fast lookups
- SF bounds detection

## What it does

Click anywhere on the map or search an address to instantly see:

- The zoning code and district name for that location
- A plain-English explanation of what you can build or do there
- A link to the official San Francisco Planning Code

## Tech stack

- **Frontend:** React, Leaflet.js
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL + PostGIS (Supabase)
- **AI:** Anthropic Claude API
- **Payments:** Stripe
- **Deployment:** Railway (backend), Vercel (frontend)

## How it works

1. User searches an address or clicks a location on the map
2. Frontend sends lat/lng to the FastAPI backend
3. Backend checks IP-based rate limit against the database
4. PostGIS runs an `ST_Intersects` query to find the matching zoning district
5. Zone code is checked against the interpretation cache — if cached, returns instantly
6. If not cached, Claude generates a plain-English interpretation and caches it
7. Result is displayed in the sidebar (desktop) or bottom sheet (mobile)

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
python3 ingest.py
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
```

Add a `.env` file in `backend/` with:
```bash
ANTHROPIC_API_KEY=your-key-here
STRIPE_SECRET_KEY=your-key-here
```
## Data

Zoning data sourced from [DataSF](https://data.sfgov.org/Geographic-Locations-and-Boundaries/Zoning-Map-Zoning-Districts/3i4a-hu95) — 10,617 zoning districts covering all of San Francisco.