import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ws = new WebSocket("ws://localhost:8080/ws?userID=" + Math.random().toString(36).substring(7));

export default function App() {
  const [users, setUsers] = useState({});
  const [myLocation, setMyLocation] = useState(null);

  const mapRef = useRef();

  // Send location to server every 5 seconds
  useEffect(() => {
    const updateLocation = () => {
      navigator.geolocation.watchPosition((pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setMyLocation(loc);
        ws.readyState === 1 && ws.send(JSON.stringify(loc));
      });
    };

    updateLocation();
    const interval = setInterval(updateLocation, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for location updates from others
  useEffect(() => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data)
      setUsers(data); // whole user map from server
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MapContainer
        center={[20.5937, 78.9629]} // Default to India
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {myLocation && (
          <AnimatedMarker position={myLocation} icon={userIcon("You")}> 
            <Popup>Your Location</Popup>
          </AnimatedMarker>
        )}

        {Object.entries(users).map(([id, loc]) => (
          <AnimatedMarker key={id} position={loc} icon={userIcon(id)}>
            <Popup>
              User: {id}
              {loc.level !== undefined && (
                <div>Level: {loc.level}</div>
              )}
            </Popup>
          </AnimatedMarker>
        ))}
      </MapContainer>
    </div>
  );
}

// Custom icon with avatar
function userIcon(label) {
  // Use a simple SVG avatar as a marker
  const avatarSvg = `
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="14" r="8" fill="#1976d2" stroke="#fff" stroke-width="2"/>
      <ellipse cx="20" cy="30" rx="14" ry="8" fill="#1976d2" stroke="#fff" stroke-width="2"/>
      <text x="20" y="19" text-anchor="middle" fill="#fff" font-size="10" font-family="Arial" dy=".3em">${label === "You" ? "🧑" : "👤"}</text>
    </svg>
  `;
  return L.divIcon({
    html: `<div style="transform: translate(-50%, -100%);">${avatarSvg}</div>`
  });
}

// Helper for animated marker
function AnimatedMarker({ position, icon, children }) {
  const [currentPos, setCurrentPos] = useState(position);
  const animationRef = useRef();

  useEffect(() => {
    if (!position) return;
    let start;
    const duration = 500; // ms
    const from = currentPos;
    const to = position;
    if (!from) {
      setCurrentPos(to);
      return;
    }
    function animate(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const lat = from.lat + (to.lat - from.lat) * progress;
      const lng = from.lng + (to.lng - from.lng) * progress;
      setCurrentPos({ lat, lng });
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [position]);

  return <Marker position={currentPos} icon={icon}>{children}</Marker>;
}
