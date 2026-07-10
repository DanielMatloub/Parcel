import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ReactMarkdown from "react-markdown";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

const searchBarStyle = {
  input: { flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px" },
  button: { padding: "8px 14px", borderRadius: "8px", background: "#222", color: "#fff", border: "none", cursor: "pointer", fontSize: "14px" },
  wrapper: { display: "flex", gap: "8px" }
};

export default function App() {
  const [marker, setMarker] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handleMapClick({ lat, lng }) {
    setMarker({ lat, lng });
    setLoading(true);
    setResult(null);
    setShowPropertyDetails(false);
    setPanelOpen(true);
    const res = await fetch(`https://parcel-production-970b.up.railway.app/zone?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", San Francisco, CA")}`
    );
    const data = await res.json();
    if (data.length === 0) {
      setResult({ error: "not_found", message: "Address not found. Try a more specific address." });
      setPanelOpen(true);
      return;
    }
    const { lat, lon } = data[0];
    if (mapRef.current) {
      mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 16);
    }
    handleMapClick({ lat: parseFloat(lat), lng: parseFloat(lon) });
  }

  async function handleCheckout() {
    const res = await fetch("https://parcel-production-970b.up.railway.app/create-checkout-session", {
      method: "POST"
    });
    const data = await res.json();
    window.location.href = data.url;
  }

  const PropertyDetails = ({ details }) => (
    <div style={{ marginTop: "16px" }}>
      <button
        onClick={() => setShowPropertyDetails(!showPropertyDetails)}
        style={{
          background: "none", border: "1px solid #ddd", borderRadius: "8px",
          padding: "8px 14px", fontSize: "13px", cursor: "pointer",
          width: "100%", textAlign: "left", color: "#333"
        }}
      >
        {showPropertyDetails ? "▾" : "▸"} Property Details
      </button>
      {showPropertyDetails && (
        <div style={{
          background: "#f9f9f9", borderRadius: "8px", padding: "12px 16px",
          marginTop: "8px", fontSize: "13px", lineHeight: "1.8"
        }}>
          {details.assessed_total_value > 0 && (
            <div><span style={{ color: "#888" }}>Assessed value</span><span style={{ float: "right", fontWeight: "600" }}>${details.assessed_total_value.toLocaleString()}</span></div>
          )}
          {details.assessed_land_value > 0 && (
            <div><span style={{ color: "#888" }}>Land value</span><span style={{ float: "right" }}>${details.assessed_land_value.toLocaleString()}</span></div>
          )}
          {details.assessed_improvement_value > 0 && (
            <div><span style={{ color: "#888" }}>Improvement value</span><span style={{ float: "right" }}>${details.assessed_improvement_value.toLocaleString()}</span></div>
          )}
          {details.use_definition && (
            <div><span style={{ color: "#888" }}>Use type</span><span style={{ float: "right" }}>{details.use_definition}</span></div>
          )}
          {details.year_built && details.year_built !== "0" && (
            <div><span style={{ color: "#888" }}>Year built</span><span style={{ float: "right" }}>{details.year_built}</span></div>
          )}
          {details.lot_area && parseFloat(details.lot_area) > 0 && (
            <div><span style={{ color: "#888" }}>Lot area</span><span style={{ float: "right" }}>{parseFloat(details.lot_area).toLocaleString()} sq ft</span></div>
          )}
          {details.stories && parseFloat(details.stories) > 0 && (
            <div><span style={{ color: "#888" }}>Stories</span><span style={{ float: "right" }}>{details.stories}</span></div>
          )}
          {details.neighborhood && (
            <div><span style={{ color: "#888" }}>Neighborhood</span><span style={{ float: "right" }}>{details.neighborhood}</span></div>
          )}
          {details.last_sale_date && (
            <div><span style={{ color: "#888" }}>Last sale</span><span style={{ float: "right" }}>{details.last_sale_date}</span></div>
          )}
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#aaa" }}>
            Data from SF Assessor-Recorder, {details.data_year}
          </div>
        </div>
      )}
    </div>
  );

  const ResultPanel = () => (
    <>
      {loading && <p style={{ color: "#888", textAlign: "center" }}>Looking up zoning...</p>}
      {result && !loading && (
        result.error === "limit_reached" ? (
          <div style={{ textAlign: "center", padding: "16px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
            <p style={{ fontWeight: "600", fontSize: "16px", marginBottom: "8px" }}>You've used your 30 free searches</p>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>Unlock unlimited searches for a one-time payment of $5.</p>
            <button
              onClick={handleCheckout}
              style={{
                background: "#222", color: "#fff", border: "none",
                padding: "12px 24px", borderRadius: "8px", fontSize: "15px",
                cursor: "pointer", width: "100%"
              }}
            >
              Unlock unlimited searches — $5
            </button>
          </div>
        ) : result.error ? (
          <p style={{ color: "#888", textAlign: isMobile ? "center" : "left" }}>{result.message || result.error}</p>
        ) : (
          <>
            <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px 16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>Zone code</div>
              <div style={{ fontSize: "22px", fontWeight: "700" }}>{result.zone_code}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{result.district_name}</div>
            </div>
            <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#333", marginBottom: "12px" }}>
              <ReactMarkdown>{result.interpretation}</ReactMarkdown>
            </div>
            {result.url && (
              <a href={result.url} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "#0066cc" }}>
                View official planning code →
              </a>
            )}
            {result.property_details && (
              <PropertyDetails details={result.property_details} />
            )}
            {result.searches_remaining !== undefined && result.searches_remaining <= 5 && (
              <p style={{ color: "#888", fontSize: "12px", marginTop: "12px" }}>
                {result.searches_remaining} free {result.searches_remaining === 1 ? "search" : "searches"} remaining.
              </p>
            )}
          </>
        )
      )}
    </>
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif" }}>
        <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #ddd", zIndex: 1000 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: "700", fontSize: "18px" }}>Parcel</span>
            <span style={{ fontSize: "13px", color: "#888", marginLeft: "8px" }}>SF Zoning Lookup</span>
          </div>
          <div style={searchBarStyle.wrapper}>
            <input
              type="text"
              placeholder="Search an address in SF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={searchBarStyle.input}
            />
            <button onClick={handleSearch} style={searchBarStyle.button}>Go</button>
          </div>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[37.7749, -122.4194]} zoom={13} style={{ height: "100%", width: "100%" }} ref={mapRef}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickHandler onMapClick={handleMapClick} />
            {marker && (
              <Marker position={[marker.lat, marker.lng]}>
                <Popup>{result?.zone_code || "Loading..."}</Popup>
              </Marker>
            )}
          </MapContainer>
          {!panelOpen && (
            <div style={{
              position: "absolute", bottom: "24px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)", color: "#fff", padding: "10px 18px",
              borderRadius: "24px", fontSize: "14px", zIndex: 1000, whiteSpace: "nowrap"
            }}>
              Tap anywhere on the map
            </div>
          )}
          {panelOpen && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "#fff", borderRadius: "16px 16px 0 0",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
              padding: "16px", maxHeight: "55vh", overflowY: "auto", zIndex: 1000
            }}>
              <div style={{ width: "40px", height: "4px", background: "#ddd", borderRadius: "2px", margin: "0 auto 16px", cursor: "pointer" }} onClick={() => setPanelOpen(false)} />
              <ResultPanel />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ flex: 1 }}>
        <MapContainer center={[37.7749, -122.4194]} zoom={13} style={{ height: "100%" }} ref={mapRef}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onMapClick={handleMapClick} />
          {marker && (
            <Marker position={[marker.lat, marker.lng]}>
              <Popup>{result?.zone_code || "Loading..."}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <div style={{ width: "380px", padding: "24px", overflowY: "auto", background: "#f9f9f9", borderLeft: "1px solid #ddd" }}>
        <h2 style={{ marginTop: 0 }}>Parcel</h2>
        <div style={{ ...searchBarStyle.wrapper, marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Search an address in SF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={searchBarStyle.input}
          />
          <button onClick={handleSearch} style={searchBarStyle.button}>Go</button>
        </div>
        <p style={{ color: "#666", fontSize: "14px" }}>Or click anywhere on the map.</p>
        <ResultPanel />
      </div>
    </div>
  );
}