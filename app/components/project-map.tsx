'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

type Project = { id?: string | number; title: string; location?: string; latitude?: number | string; longitude?: number | string; slug?: string; status?: string };

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';

export default function ProjectMap({ projects, className = '' }: { projects: Project[]; className?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const valid = projects.filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
    if (!valid.length) return;
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false }).setView([49.1, 14.4], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      valid.forEach((project) => {
        const point: [number, number] = [Number(project.latitude), Number(project.longitude)];
        bounds.extend(point);
        const icon = L.divIcon({ className: '', html: '<span class="project-map-pin" aria-hidden="true"></span>', iconSize: [28, 38], iconAnchor: [14, 38] });
        const slug = project.slug || slugify(project.title);
        L.marker(point, { icon, title: project.title }).addTo(map!).bindPopup(
          `<strong>${project.title.replace(/[<>]/g, '')}</strong><br>${(project.location || '').replace(/[<>]/g, '')}<br><a href="/projekty/${encodeURIComponent(slug)}/">Detail projektu</a>`,
        );
      });
      if (valid.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      else map.setView(bounds.getCenter(), 13);
    });
    return () => { cancelled = true; if (map) map.remove(); };
  }, [projects]);

  const hasPoints = projects.some((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  if (!hasPoints) return <div className={`flex items-center justify-center bg-navy/5 text-navy/50 ${className}`}>Souřadnice projektů zatím nejsou vyplněné.</div>;
  return <div ref={container} className={`relative z-0 ${className}`} aria-label="Mapa projektů" />;
}
