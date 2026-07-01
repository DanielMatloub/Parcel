import geopandas as gpd
from sqlalchemy import create_engine

DB_URL = "postgresql://postgres:pass@localhost:5432/zoning"

print("Reading shapefile...")
gdf = gpd.read_file("../data/sf_zoning.shp")
gdf = gdf.to_crs(epsg=4326)

print("Connecting to PostGIS...")
engine = create_engine(DB_URL)

print("Writing to PostGIS...")
gdf.to_postgis("zoning_districts", engine, if_exists="replace", index=False)

print("Done! Rows written:", len(gdf))