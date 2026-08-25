'use client';
import { useEffect, useRef } from 'react';

// โหลด Leaflet + MarkerCluster จาก CDN ครั้งเดียว
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L && window.L.markerClusterGroup) { resolve(window.L); return; }
    const addCss = href => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = href;
      document.head.appendChild(css);
    };
    addCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    addCss('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => {
      const js2 = document.createElement('script');
      js2.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      js2.onload = () => resolve(window.L);
      document.head.appendChild(js2);
    };
    document.head.appendChild(js);
  });
}

// หมุดสีตามยุค (color = hex) — ไม่ระบุสี = ทอง
const pinIcon = (L, color = '#C9A84C') => L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:${color};border:2.5px solid #0F1B2D;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22],
});

// cluster=false → วางหมุดตรง ๆ ไม่รวมกลุ่ม (ใช้ตอนค้นหา ให้ popup เปิดได้ทุกหมุด)
// marker.open=true → เปิด popup ให้ทันที (เปิดพร้อมกันได้หลายอัน สูงสุด 10)
export default function LeafletMap({ markers = [], onPick, pickedPos, flyTo, height = '480px',
  center = [13.75, 100.5], zoom = 6, legend = null, cluster = true }) {
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
      // กลุ่มหมุด: ซูมสุดแล้วซ้อนกัน → กางเป็นพัด (spiderfy) เห็นครบทุกหมุด
      markerLayer.current = L.markerClusterGroup({
        maxClusterRadius: 42,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        spiderfyDistanceMultiplier: 1.6,
        iconCreateFunction: (cluster) => L.divIcon({
          className: '',
          html: `<div style="width:34px;height:34px;border-radius:50%;background:#0F1B2D;border:2.5px solid #C9A84C;color:#C9A84C;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${cluster.getChildCount()}</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17],
        }),
      }).addTo(map);
      if (onPick) map.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng));

      // แถบอธิบายสี (legend)
      if (legend) {
        const ctl = L.control({ position: 'bottomleft' });
        ctl.onAdd = () => {
          const div = L.DomUtil.create('div');
          div.innerHTML = legend;
          return div;
        };
        ctl.addTo(map);
      }
      renderMarkers(L);
    });
    return () => { cancelled = true; if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, []);

  useEffect(() => { if (window.L && mapObj.current) renderMarkers(window.L); }, [markers, cluster]);
  const plainLayer = useRef(null);

  useEffect(() => {
    if (window.L && mapObj.current && flyTo) {
      mapObj.current.flyTo([flyTo[0], flyTo[1]], flyTo[2] ?? 16, { duration: 1.2 });
    }
  }, [flyTo]);

  useEffect(() => {
    if (!window.L || !mapObj.current || !onPick) return;
    const L = window.L;
    if (pickMarker.current) { pickMarker.current.remove(); pickMarker.current = null; }
    if (pickedPos) pickMarker.current = L.marker(pickedPos, { icon: pinIcon(L) }).addTo(mapObj.current);
  }, [pickedPos]);

  function renderMarkers(L) {
    if (!markerLayer.current || !mapObj.current) return;
    const map = mapObj.current;
    markerLayer.current.clearLayers();
    if (!plainLayer.current) plainLayer.current = L.layerGroup().addTo(map);
    plainLayer.current.clearLayers();
    map.closePopup();
    const target = cluster ? markerLayer.current : plainLayer.current;
    const bounds = [], toOpen = [];
    markers.forEach(m => {
      if (m.lat == null || m.lng == null) return;
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon(L, m.color) });
      // ตอนค้นหา: popup หลายอันเปิดพร้อมกันได้ ไม่ปิดเมื่อคลิกแผนที่
      mk.bindPopup(m.popupHtml ?? '', { maxWidth: 260, autoClose: !m.open, closeOnClick: !m.open });
      if (m.tooltipHtml && !m.open) {
        mk.bindTooltip(m.tooltipHtml, { direction: 'top', offset: [0, -20], opacity: 1, className: 'thma-tooltip' });
      }
      target.addLayer(mk);
      if (m.open) toOpen.push(mk);
      bounds.push([m.lat, m.lng]);
    });
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: toOpen.length ? 14 : 12 });
    if (toOpen.length) {
      // รอให้แผนที่เลื่อนเสร็จก่อนค่อยเปิด ป้ายจะได้อยู่ในจอ
      setTimeout(() => { toOpen.slice(0, 10).forEach(mk => { try { mk.openPopup(); } catch (e) {} }); }, 350);
    }
  }

  return <div ref={mapRef} style={{ height, width: '100%', borderRadius: '8px', border: '1px solid var(--border)', zIndex: 0 }} />;
}
