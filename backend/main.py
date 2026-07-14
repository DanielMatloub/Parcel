from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import anthropic
import stripe
import json
import requests
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FREE_LIMIT = 30

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        host="localhost", dbname="zoning", user="postgres", password="pass"
    )

def init_cache():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS zone_cache (
            zone_code TEXT PRIMARY KEY,
            interpretation TEXT
        )
    """)
    conn.commit()
    conn.close()

def get_cached_interpretation(zone_code: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT interpretation FROM zone_cache WHERE zone_code = %s", (zone_code,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def cache_interpretation(zone_code: str, interpretation: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO zone_cache (zone_code, interpretation)
        VALUES (%s, %s)
        ON CONFLICT (zone_code) DO NOTHING
    """, (zone_code, interpretation))
    conn.commit()
    conn.close()

def interpret_zone(zone_code: str, district_name: str) -> str:
    cached = get_cached_interpretation(zone_code)
    if cached:
        return cached
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are a zoning assistant. A user clicked a location in San Francisco and wants to understand what they can do with that land.

Zone code: {zone_code}
District name: {district_name}

Respond in exactly this format, no markdown headers, no tips, no extra commentary:

One sentence summarizing what this zone is for.

What you can build or do here: [2-3 specific examples]

Key restrictions: [2-3 specific limits]"""
            }
        ]
    )
    interpretation = message.content[0].text
    cache_interpretation(zone_code, interpretation)
    return interpretation
def get_property_details(lat: float, lng: float) -> dict:
    try:
        url = "https://data.sfgov.org/resource/wv5m-vpq2.json"
        params = {
            "$where": f"within_circle(the_geom,{lat},{lng},100)",
            "$order": "closed_roll_year DESC",
            "$limit": 1
        }
        headers = {
            "X-App-Token": os.getenv("DATASF_APP_TOKEN", "")
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        if not data:
            return None
        p = data[0]
        return {
            "assessed_land_value": float(p.get("assessed_land_value", 0)),
            "assessed_improvement_value": float(p.get("assessed_improvement_value", 0)),
            "assessed_total_value": float(p.get("assessed_land_value", 0)) + float(p.get("assessed_improvement_value", 0)),
            "year_built": p.get("year_property_built"),
            "use_definition": p.get("use_definition"),
            "property_area": p.get("property_area"),
            "lot_area": p.get("lot_area"),
            "bedrooms": p.get("number_of_bedrooms"),
            "bathrooms": p.get("number_of_bathrooms"),
            "stories": p.get("number_of_stories"),
            "neighborhood": p.get("assessor_neighborhood"),
            "last_sale_date": p.get("current_sales_date", "").split("T")[0] if p.get("current_sales_date") else None,
            "data_year": p.get("closed_roll_year"),
            "block": p.get("block"),
            "lot": p.get("lot")
        }
    except Exception as e:
        print(f"Property details error: {type(e).__name__}: {e}")
        return None

def get_building_permits(block: str, lot: str) -> list:
    try:
        url = "https://data.sfgov.org/resource/i98e-djp9.json"
        params = {
            "$where": f"block='{block}' AND lot='{lot}'",
            "$order": "filed_date DESC",
            "$limit": 5
        }
        headers = {
            "X-App-Token": os.getenv("DATASF_APP_TOKEN", "")
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        if not data:
            return []
        permits = []
        for p in data:
            permits.append({
                "permit_number": p.get("permit_number"),
                "type": p.get("permit_type_definition"),
                "description": p.get("description", "")[:150],
                "status": p.get("status"),
                "filed_date": p.get("filed_date", "").split("T")[0],
                "estimated_cost": float(p.get("estimated_cost", 0)) if p.get("estimated_cost") else None,
            })
        return permits
    except Exception as e:
        print(f"Permits error: {type(e).__name__}: {e}")
        return []

def get_environmental_risks(lat: float, lng: float) -> dict:
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM seismic_hazard_zones
            WHERE ST_Intersects(
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                geometry
            )
        """, (lng, lat))
        in_seismic_zone = cur.fetchone()[0] > 0
        conn.close()

        risks = {
            "seismic_hazard_zone": in_seismic_zone,
        }
        return risks
    except Exception as e:
        print(f"Environmental risks error: {type(e).__name__}: {e}")
        return None

def get_ip_usage(ip: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT search_count, paid FROM rate_limits WHERE ip = %s", (ip,))
    row = cur.fetchone()
    conn.close()
    return row if row else (0, False)

def increment_ip_usage(ip: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO rate_limits (ip, search_count)
        VALUES (%s, 1)
        ON CONFLICT (ip) DO UPDATE
        SET search_count = rate_limits.search_count + 1,
            updated_at = NOW()
    """, (ip,))
    conn.commit()
    conn.close()

@app.on_event("startup")
def startup():
    init_cache()

@app.get("/zone")
def get_zone(request: Request, lat: float, lng: float):
    ip = request.headers.get("x-forwarded-for", request.client.host)

    search_count, paid = get_ip_usage(ip)
    if search_count >= FREE_LIMIT and not paid:
        return {
            "error": "limit_reached",
            "message": f"You've used all {FREE_LIMIT} free searches. Unlock unlimited searches for $5."
        }

    if not (37.63 <= lat <= 37.93 and -122.53 <= lng <= -122.33):
        return {"error": "out_of_bounds", "message": "Parcel currently only covers San Francisco. More cities coming soon!"}

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT zoning_sim, districtna, url
        FROM zoning_districts
        WHERE ST_Intersects(
            ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            geometry
        )
        LIMIT 1
    """, (lng, lat))
    row = cur.fetchone()
    conn.close()

    if not row:
        return {"error": "not_found", "message": "No zoning district found here. Try clicking on a building or lot rather than a street."}

    increment_ip_usage(ip)
    interpretation = interpret_zone(row[0], row[1])
    property_details = get_property_details(lat, lng)
    environmental_risks = get_environmental_risks(lat, lng)

    permits = []
    if property_details and property_details.get("block"):
        permits = get_building_permits(property_details["block"], property_details["lot"])

    return {
        "zone_code": row[0],
        "district_name": row[1],
        "url": row[2],
        "interpretation": interpretation,
        "property_details": property_details,
        "permits": permits,
        "environmental_risks": environmental_risks,
        "searches_remaining": FREE_LIMIT - search_count - 1
    }

@app.post("/create-checkout-session")
async def create_checkout_session(request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host)
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": "Parcel — Unlimited Searches"},
                "unit_amount": 500,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url="https://parcel-chi-six.vercel.app?payment=success&ip=" + ip,
        cancel_url="https://parcel-chi-six.vercel.app?payment=cancelled",
    )
    return {"url": session.url}

@app.post("/payment-success")
async def payment_success(request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO rate_limits (ip, search_count, paid)
        VALUES (%s, 0, TRUE)
        ON CONFLICT (ip) DO UPDATE SET paid = TRUE
    """, (ip,))
    conn.commit()
    conn.close()
    return {"success": True}
