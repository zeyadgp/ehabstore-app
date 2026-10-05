import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * خريطة تفاعلية (OpenStreetMap) لاختيار الموقع يدويًا بالضغط أو سحب المؤشر.
 * تُحمَّل ديناميكيًا في المتصفح فقط.
 */
export default function MapPicker({
  latitude,
  longitude,
  onChange,
  zoom = 13,
}: {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  zoom?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!boxRef.current || mapRef.current || typeof window === "undefined") return;
    let isMounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!isMounted || !boxRef.current) return;

      const map = L.map(boxRef.current, { attributionControl: false }).setView(
        [latitude, longitude],
        zoom,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:hsl(var(--primary));border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([latitude, longitude], { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        cb.current(p.lat, p.lng);
      });
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        cb.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 200);
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), zoom));
  }, [latitude, longitude, zoom]);

  return <div ref={boxRef} className="h-56 w-full rounded-xl" style={{ zIndex: 0 }} />;
}
