'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSiteContent } from '../lib/use-content';
import ProjectMap from '../components/project-map';

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';
const track = (event: string, projectId = '') => fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, projectId, path: location.pathname }), keepalive: true }).catch(() => {});

export default function ProjectDetailPage() {
  const { content, loaded } = useSiteContent();
  const [image, setImage] = useState(0);
  const projects = useMemo(() => [...(content.currentProjects || []), ...(content.soldProjects || [])], [content]);
  const pathSlug = typeof window !== 'undefined' ? decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '') : '';
  const querySlug = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('slug') || '' : '';
  const slug = pathSlug === 'projekty' ? querySlug : pathSlug;
  const project = projects.find((p: any) => (p.slug || slugify(p.title)) === slug);

  useEffect(() => {
    if (!project) return;
    document.title = `${project.title} | D&D HOMEINVEST s.r.o.`;
    track('project_view', String(project.id));
  }, [project]);

  if (!loaded) return <main className="min-h-screen bg-navy text-white flex items-center justify-center">Načítám projekt…</main>;
  if (!project) return <main className="min-h-screen bg-off-white text-navy flex flex-col items-center justify-center gap-5 p-6"><h1 className="font-heading text-4xl">Projekt nebyl nalezen</h1><Link href="/#galerie" className="bg-brass px-6 py-3 rounded-full font-semibold">Zpět na projekty</Link></main>;

  const images: string[] = project.images || [];
  const timeline = Array.isArray(project.timeline) ? project.timeline : [];
  const schema = { '@context': 'https://schema.org', '@type': 'Apartment', name: project.title, description: project.descriptionLong || project.description, address: project.address || project.location, floorSize: project.area ? { '@type': 'QuantitativeValue', value: project.area } : undefined, image: images.map((src) => new URL(src, 'https://ddhomeinvest.cz').href), url: `https://ddhomeinvest.cz/projekty/${project.slug || slugify(project.title)}/` };

  return <div className="min-h-screen bg-off-white text-navy">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="bg-navy text-white">
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3"><Image src="/logo.svg" alt="D&D HOMEINVEST" width={44} height={44}/><span className="font-heading font-bold">D&D HOMEINVEST</span></Link>
        <Link href="/#galerie" className="text-brass hover:text-brass-light">← Všechny projekty</Link>
      </nav>
    </header>

    <main>
      <section className="bg-navy text-white pb-16">
        <div className="max-w-7xl mx-auto px-6 pt-10 grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <div><p className="text-brass uppercase tracking-[.2em] text-xs mb-4">{project.status}</p><h1 className="font-heading text-4xl md:text-6xl font-bold mb-4">{project.title}</h1><p className="text-white/65 text-lg">{project.location}</p></div>
          <div className="lg:text-right"><p className="text-white/50 text-sm">Cena</p><p className="font-heading text-3xl text-brass font-bold">{project.price || 'Na dotaz'}</p></div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="aspect-[16/9] bg-navy/10 relative">
            {images[image] ? <img src={images[image]} alt={`${project.title} – fotografie ${image + 1}`} className="w-full h-full object-cover" fetchPriority="high"/> : <div className="h-full flex items-center justify-center text-navy/30">Fotografie bude doplněna</div>}
            {images.length > 1 && <><button onClick={() => setImage((image - 1 + images.length) % images.length)} aria-label="Předchozí fotografie" className="absolute left-4 top-1/2 -translate-y-1/2 bg-navy/80 text-white w-11 h-11 rounded-full">←</button><button onClick={() => setImage((image + 1) % images.length)} aria-label="Další fotografie" className="absolute right-4 top-1/2 -translate-y-1/2 bg-navy/80 text-white w-11 h-11 rounded-full">→</button></>}
          </div>
          {images.length > 1 && <div className="p-3 flex gap-3 overflow-x-auto">{images.map((src, i) => <button key={src} onClick={() => setImage(i)} className={`w-24 h-16 rounded-lg overflow-hidden flex-none border-2 ${i === image ? 'border-brass' : 'border-transparent'}`}><img src={src} alt="" className="w-full h-full object-cover" loading="lazy"/></button>)}</div>}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-[1.4fr_.8fr] gap-12">
        <div><h2 className="font-heading text-3xl font-bold mb-6">O projektu</h2><p className="text-gray leading-8 whitespace-pre-line">{project.descriptionLong || project.description}</p>
          {project.features?.length > 0 && <div className="mt-10"><h3 className="font-heading text-2xl font-bold mb-4">Vybavení a přednosti</h3><ul className="grid sm:grid-cols-2 gap-3">{project.features.map((f: string) => <li key={f} className="flex gap-2"><span className="text-brass">✓</span>{f}</li>)}</ul></div>}
        </div>
        <aside className="bg-white p-7 rounded-2xl shadow-sm h-fit"><h2 className="font-heading text-2xl font-bold mb-6">Základní informace</h2><dl className="space-y-4">{[['Dispozice', project.disposition], ['Plocha', project.area], ['Podlaží', project.floor], ['Vlastnictví', project.ownership], ['PENB', project.penb], ['Dokončení', project.completionDate]].filter(([,v]) => v).map(([k,v]) => <div key={k} className="flex justify-between gap-4 border-b border-gray-light pb-3"><dt className="text-gray">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>)}</dl><a href="/#kontakt" onClick={() => track('contact_click', String(project.id))} className="mt-7 flex justify-center bg-brass py-3.5 rounded-xl font-semibold">Kontaktovat nás</a></aside>
      </section>

      {timeline.length > 0 && <section className="bg-navy text-white py-16"><div className="max-w-5xl mx-auto px-6"><p className="text-brass uppercase tracking-[.2em] text-xs mb-3">Aktuální projekt</p><h2 className="font-heading text-3xl md:text-4xl font-bold mb-10">Průběh rekonstrukce</h2><ol className="grid md:grid-cols-3 gap-6">{timeline.map((step: any, i: number) => <li key={i} className={`rounded-2xl p-6 border ${step.status === 'done' ? 'border-emerald-500/40 bg-emerald-500/5' : step.status === 'current' ? 'border-brass bg-brass/10' : 'border-white/10'}`}><span className="text-brass text-sm">{String(i + 1).padStart(2, '0')}</span><h3 className="font-heading text-xl font-bold my-3">{step.title}</h3><p className="text-white/60 text-sm leading-6">{step.description}</p></li>)}</ol></div></section>}

      {Number.isFinite(Number(project.latitude)) && <section className="max-w-7xl mx-auto px-6 py-16"><h2 className="font-heading text-3xl font-bold mb-6">Lokalita</h2><p className="text-gray mb-5">{project.address || project.location}</p><ProjectMap projects={[project]} className="h-[420px] rounded-2xl overflow-hidden"/></section>}
    </main>
    <footer className="bg-navy text-white/50 text-center p-8"><Link href="/" className="hover:text-brass">D&D HOMEINVEST s.r.o.</Link></footer>
  </div>;
}
