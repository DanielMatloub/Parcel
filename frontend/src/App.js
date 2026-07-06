import { useState } from "react";
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

export default function App() {
  const [marker, setMarker] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  async function handleMapClick({ lat, lng }) {
    setMarker({ lat, lng });
    setLoading(true);
    setResult(null);
    setPanelOpen(true);
    const res = await fetch(`https://parcel-production-970b.up.railway.app/zone?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 1000 }}>
        <div>
          <span style={{ fontWeight: "700", fontSize: "18px" }}>Parcel</span>
          <span style={{ fontSize: "13px", color: "#888", marginLeft: "8px" }}>SF Zoning Lookup</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[37.7749, -122.4194]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onMapClick={handleMapClick} />
          {marker && (
            <Marker position={[marker.lat, marker.lng]}>
              <Popup>{result?.zone_code || "Loading..."}</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Hint */}
        {!panelOpen && (
          <div style={{
            position: "absolute", bottom: "24px", left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)", color: "#fff", padding: "10px 18px",
            borderRadius: "24px", fontSize: "14px", zIndex: 1000, whiteSpace: "nowrap"
          }}>
            Tap anywhere on the map
          </div>
        )}

        {/* Bottom sheet */}
        {panelOpen && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "#fff", borderRadius: "16px 16px 0 0",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            padding: "16px", maxHeight: "55vh", overflowY: "auto",
            zIndex: 1000
          }}>
            {/* Drag handle */}
            <div style={{ width: "40px", height: "4px", background: "#ddd", borderRadius: "2px", margin: "0 auto 16px" }} onClick={() => setPanelOpen(false)} />

            {loading && <p style={{ color: "#888", textAlign: "center" }}>Looking up zoning...</p>}

            {result && !loading && (
              result.error ? (
                <p style={{ color: "#888", textAlign: "center" }}>{result.error}</p>
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
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}