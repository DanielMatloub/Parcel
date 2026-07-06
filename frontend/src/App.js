import { useState } from "react";
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import ReactMarkdown from "react-markdown";

// Fix default marker icon
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

  async function handleMapClick({ lat, lng }) {
    setMarker({ lat, lng });
    setLoading(true);
    setResult(null);
    const res = await fetch(`https://parcel-production-970b.up.railway.app/zone?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ flex: 1 }}>
        <MapContainer center={[37.7749, -122.4194]} zoom={13} style={{ height: "100%" }}>
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
        <h2 style={{ marginTop: 0 }}>SF Zoning Lookup</h2>
        <p style={{ color: "#666", fontSize: "14px" }}>Click anywhere on the map to look up zoning information for that location.</p>

        {loading && <p>Looking up zoning...</p>}

        {result && !loading && (
          <div>
            {result.error ? (
              <p style={{ color: "#888" }}>No zoning district found here. Try clicking on a building or lot rather than a street.</p>
            ) : (
              <>
                <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Zone code</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold" }}>{result.zone_code}</div>
                  <div style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{result.district_name}</div>
                </div>

                <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#333", marginBottom: "16px" }}>
			<ReactMarkdown>{result.interpretation}</ReactMarkdown>
		</div>

                {result.url && (
                  <a href={result.url} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "#0066cc" }}>
                    View official planning code →
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}