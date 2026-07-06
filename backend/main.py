from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import anthropic
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    import os
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        host="localhost", dbname="zoning", user="postgres", password="pass"
    )

def interpret_zone(zone_code: str, district_name: str) -> str:
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
    return message.content[0].text

@app.get("/zone")
def get_zone(lat: float, lng: float):
    # SF bounding box check
    if not (37.63 <= lat <= 37.93 and -122.53 <= lng <= -122.33):
        return {"error": "Parcel currently only covers San Francisco. More cities coming soon!"}

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
        return {"error": "No zoning district found here. Try clicking on a building or lot rather than a street."}

    interpretation = interpret_zone(row[0], row[1])

    return {
        "zone_code": row[0],
        "district_name": row[1],
        "url": row[2],
        "interpretation": interpretation
    }