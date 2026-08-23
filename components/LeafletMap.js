'use client';
import { useEffect, useRef } from 'react';

// โหลด Leaflet จาก CDN ครั้งเดียว
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(window.L); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });
}

const goldIcon = (L) => L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#C9A84C;border:2.5px solid #0F1B2D;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22],
});

export default function LeafletMap({ markers = [], onPick, pickedPos, height = '480px', center = [13.75, 100.5], zoom = 6 }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const pickMarker = useRef(null);
  const markerLayer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || mapObj.current) return;
      const map = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      mapObj.current = map;
      markerLayer.current = L.layerGroup().addTo(map);
      if (onPick) {
        map.on('click', (e) => {
          onPick(e.latlng.lat, e.latlng.lng);
        });
      }
      renderMarkers(L);
    });
    return () => { cancelled = true; if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, []);

  useEffect(() => {
    if (window.L && mapObj.current) renderMarkers(window.L);
  }, [markers]);

  useEffect(() => {
    if (!window.L || !mapObj.current || !onPick) return;
    const L = window.L;
    if (pickMarker.current) { pickMarker.current.remove(); pickMarker.current = null; }
    if (pickedPos) {
      pickMarker.current = L.marker(pickedPos, { icon: goldIcon(L) }).addTo(mapObj.current);
    }
  }, [pickedPos]);

  function renderMarkers(L) {
    if (!markerLayer.current) return;
    markerLayer.current.clearLayers();
    const bounds = [];
    markers.forEach(m => {
      if (m.lat == null || m.lng == null) return;
      const mk = L.marker([m.lat, m.lng], { icon: goldIcon(L) });
      mk.bindPopup(m.popupHtml ?? '', { maxWidth: 260 });
      if (m.tooltipHtml) {
        mk.bindTooltip(m.tooltipHtml, { direction: 'top', offset: [0, -20], opacity: 1, className: 'thma-tooltip' });
      }
      markerLayer.current.addLayer(mk);
      bounds.push([m.lat, m.lng]);
    });
    if (bounds.length > 0) mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }

  return <div ref={mapRef} style={{ height, width: '100%', borderRadius: '8px', border: '1px solid var(--border)', zIndex: 0 }} />;
}
