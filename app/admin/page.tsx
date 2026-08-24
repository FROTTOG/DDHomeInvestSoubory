'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Tab = 'obsah' | 'tym' | 'projekty' | 'zpravy';

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-[#0a1020] border border-white/10 text-white text-sm focus:outline-none focus:border-brass/60 focus:ring-1 focus:ring-brass/30 transition-colors placeholder:text-white/25';
const labelCls = 'block text-white/50 text-xs font-medium tracking-wide uppercase mb-1.5';
const cardCls = 'bg-[rgba(14,24,43,0.88)] border border-white/10 rounded-2xl p-6';
const btnPrimary =
  'inline-flex items-center gap-2 bg-brass text-navy px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brass-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'inline-flex items-center gap-2 border border-white/15 text-white/70 px-4 py-2 rounded-lg text-sm hover:border-brass/50 hover:text-brass transition-colors';
const btnDanger =
  'inline-flex items-center gap-1.5 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/10 transition-colors';

function Field({
  label,
  value,
  onChange,
  textarea = false,
  rows = 3,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea className={inputCls} rows={rows} value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputCls} type="text" value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ImageUpload({
  token,
  directory,
  onUploaded,
}: {
  token: string;
  directory: string;
  onUploaded: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', directory);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nahrání se nepodařilo.');
      onUploaded(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nahrání se nepodařilo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="inline-flex items-center gap-2 border border-brass/30 text-brass px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-brass/10 transition-colors">
        {busy ? 'Nahrávám…' : 'Nahrát obrázek'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('obsah');
  const [content, setContent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // ---- auth + initial load -------------------------------------------------
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('dd_admin_session') : null;
    if (!stored) {
      router.replace('/admin/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // ověření session na serveru (endpoint vyžaduje autorizaci)
        const res = await fetch('/api/contact-messages', {
          headers: { authorization: `Bearer ${stored}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('dd_admin_session');
          router.replace('/admin/login');
          return;
        }
        const msgs = res.ok ? await res.json() : [];

        const contentRes = await fetch('/api/content', { cache: 'no-store' });
        const contentData = contentRes.ok ? await contentRes.json() : null;

        if (!cancelled) {
          setToken(stored);
          setMessages(Array.isArray(msgs) ? msgs : []);
          setContent(contentData);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setChecking(false);
          setSaveStatus({ type: 'error', text: 'Nepodařilo se spojit s API. Administrace vyžaduje běžící Cloudflare Functions (produkce nebo `npm run preview`).' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const update = useCallback((path: string[], value: any) => {
    setContent((prev: any) => {
      const next = structuredClone(prev);
      let target = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      return next;
    });
    setDirty(true);
    setSaveStatus(null);
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/content', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (res.status === 401) {
        localStorage.removeItem('dd_admin_session');
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Uložení se nepodařilo.');
      setDirty(false);
      setSaveStatus({ type: 'ok', text: 'Změny byly uloženy a jsou ihned vidět na webu.' });
    } catch (e) {
      setSaveStatus({ type: 'error', text: e instanceof Error ? e.message : 'Uložení se nepodařilo.' });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore */
    }
    localStorage.removeItem('dd_admin_session');
    router.replace('/admin/login');
  };

  // ---- helpers for arrays --------------------------------------------------
  const updateArrayItem = (key: string, index: number, field: string, value: any) => {
    const arr = [...(content[key] || [])];
    arr[index] = { ...arr[index], [field]: value };
    update([key], arr);
  };

  const removeArrayItem = (key: string, index: number) => {
    const arr = [...(content[key] || [])];
    arr.splice(index, 1);
    update([key], arr);
  };

  const addProject = (key: 'currentProjects' | 'soldProjects') => {
    const arr = [...(content[key] || [])];
    arr.push({
      id: Date.now(),
      title: 'Nový projekt',
      location: '',
      description: '',
      status: key === 'currentProjects' ? 'Připravujeme' : 'Prodáno',
      area: '',
      price: '',
      penb: '',
      images: [],
      tags: [],
    });
    update([key], arr);
  };

  const moveProject = (from: 'currentProjects' | 'soldProjects', index: number) => {
    const to = from === 'currentProjects' ? 'soldProjects' : 'currentProjects';
    const fromArr = [...(content[from] || [])];
    const [item] = fromArr.splice(index, 1);
    const toArr = [...(content[to] || []), { ...item, status: to === 'soldProjects' ? 'Prodáno' : item.status }];
    setContent((prev: any) => ({ ...prev, [from]: fromArr, [to]: toArr }));
    setDirty(true);
  };

  // ---- render ----------------------------------------------------------------
  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a1020] flex items-center justify-center p-4">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#c9a84c] animate-spin mx-auto mb-4" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-white/40 text-sm">Kontrola přihlášení…</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-[#0a1020] flex items-center justify-center p-4">
        <div className={`${cardCls} max-w-lg text-center`}>
          <p className="text-white/70 text-sm mb-4">
            {saveStatus?.text || 'Obsah se nepodařilo načíst z API.'}
          </p>
          <Link href="/" className={btnGhost}>Zpět na web</Link>
        </div>
      </div>
    );
  }

  const projectEditor = (key: 'currentProjects' | 'soldProjects', title: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-heading text-lg font-semibold">{title}</h3>
        <button className={btnGhost} onClick={() => addProject(key)}>+ Přidat projekt</button>
      </div>
      {(content[key] || []).length === 0 && (
        <p className="text-white/30 text-sm">Žádné projekty.</p>
      )}
      {(content[key] || []).map((project: any, i: number) => (
        <div key={project.id ?? i} className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Název" value={project.title} onChange={(v) => updateArrayItem(key, i, 'title', v)} />
            <Field label="Lokalita" value={project.location} onChange={(v) => updateArrayItem(key, i, 'location', v)} />
            <Field label="Stav (např. Připravujeme / V prodeji / Prodáno)" value={project.status} onChange={(v) => updateArrayItem(key, i, 'status', v)} />
            <Field label="Cena" value={project.price} onChange={(v) => updateArrayItem(key, i, 'price', v)} />
            <Field label="Plocha (např. 67m2)" value={project.area} onChange={(v) => updateArrayItem(key, i, 'area', v)} />
            <Field label="PENB" value={project.penb} onChange={(v) => updateArrayItem(key, i, 'penb', v)} />
          </div>
          <div className="mt-4">
            <Field label="Popis" textarea value={project.description} onChange={(v) => updateArrayItem(key, i, 'description', v)} />
          </div>
          <div className="mt-4">
            <label className={labelCls}>Obrázky</label>
            <div className="flex flex-wrap gap-3 items-start">
              {(project.images || []).map((img: string, imgIdx: number) => (
                <div key={imgIdx} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-24 h-24 object-cover rounded-lg border border-white/10" />
                  <button
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      const images = [...(project.images || [])];
                      images.splice(imgIdx, 1);
                      updateArrayItem(key, i, 'images', images);
                    }}
                    aria-label="Odstranit obrázek"
                  >
                    ×
                  </button>
                </div>
              ))}
              <ImageUpload
                token={token}
                directory={key === 'currentProjects' ? 'gallery/aktualni' : 'gallery/prodane'}
                onUploaded={(path) => updateArrayItem(key, i, 'images', [...(project.images || []), path])}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/5">
            <button className={btnGhost} onClick={() => moveProject(key, i)}>
              {key === 'currentProjects' ? 'Přesunout do prodaných' : 'Přesunout do aktuální nabídky'}
            </button>
            <button className={btnDanger} onClick={() => removeArrayItem(key, i)}>Smazat projekt</button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1020]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1020]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 flex-shrink-0 border border-brass/30 rounded-lg flex items-center justify-center bg-brass/10 text-brass font-bold text-sm">DD</span>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">Administrace webu</p>
              <p className="text-white/40 text-xs truncate">D&D HOMEINVEST</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus && (
              <span className={`hidden md:inline text-xs ${saveStatus.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {saveStatus.text}
              </span>
            )}
            <button className={btnPrimary} onClick={save} disabled={saving || !dirty}>
              {saving ? 'Ukládám…' : dirty ? 'Uložit změny' : 'Uloženo'}
            </button>
            <Link href="/" className={btnGhost} target="_blank">Web</Link>
            <button className={btnGhost} onClick={logout}>Odhlásit</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {([
            ['obsah', 'Texty webu'],
            ['tym', 'Tým'],
            ['projekty', 'Projekty'],
            ['zpravy', `Zprávy (${messages.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? 'border-brass text-brass' : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {saveStatus && (
          <p className={`md:hidden text-sm ${saveStatus.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{saveStatus.text}</p>
        )}

        {tab === 'obsah' && (
          <>
            <div className={cardCls}>
              <h3 className="text-white font-heading text-lg font-semibold mb-4">Úvod (hero)</h3>
              <div className="space-y-4">
                <Field label="Hlavní titulek" value={content.heroContent?.title} onChange={(v) => update(['heroContent', 'title'], v)} />
                <Field label="Podtitulek" value={content.heroContent?.subtitle} onChange={(v) => update(['heroContent', 'subtitle'], v)} />
                <Field label="Popis" textarea value={content.heroContent?.description} onChange={(v) => update(['heroContent', 'description'], v)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Text hlavního tlačítka" value={content.heroContent?.ctaText} onChange={(v) => update(['heroContent', 'ctaText'], v)} />
                  <Field label="Text druhého tlačítka" value={content.heroContent?.secondaryCtaText} onChange={(v) => update(['heroContent', 'secondaryCtaText'], v)} />
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <h3 className="text-white font-heading text-lg font-semibold mb-4">O nás</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nadpis sekce" value={content.aboutContent?.sectionTitle} onChange={(v) => update(['aboutContent', 'sectionTitle'], v)} />
                  <Field label="Podnadpis" value={content.aboutContent?.sectionSubtitle} onChange={(v) => update(['aboutContent', 'sectionSubtitle'], v)} />
                </div>
                <Field label="Úvodní text (může obsahovat HTML odkazy)" textarea rows={6} value={content.aboutContent?.intro} onChange={(v) => update(['aboutContent', 'intro'], v)} />
                <Field label="Text nad týmem" textarea value={content.aboutContent?.teamDescription} onChange={(v) => update(['aboutContent', 'teamDescription'], v)} />
              </div>
            </div>

            <div className={cardCls}>
              <h3 className="text-white font-heading text-lg font-semibold mb-4">Filozofie</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nadpis sekce" value={content.philosophyContent?.sectionTitle} onChange={(v) => update(['philosophyContent', 'sectionTitle'], v)} />
                  <Field label="Podnadpis" value={content.philosophyContent?.sectionSubtitle} onChange={(v) => update(['philosophyContent', 'sectionSubtitle'], v)} />
                </div>
                <Field
                  label="Text (jeden odstavec na řádek)"
                  textarea
                  rows={5}
                  value={(content.philosophyContent?.paragraphs || []).join('\n')}
                  onChange={(v) => update(['philosophyContent', 'paragraphs'], v.split('\n').filter(Boolean))}
                />
                <div>
                  <label className={labelCls}>Čísla / statistiky</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(content.philosophyContent?.highlights || []).map((h: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className={`${inputCls} !w-24`}
                          value={h.number || ''}
                          placeholder="20+"
                          onChange={(e) => {
                            const highlights = [...content.philosophyContent.highlights];
                            highlights[i] = { ...highlights[i], number: e.target.value };
                            update(['philosophyContent', 'highlights'], highlights);
                          }}
                        />
                        <input
                          className={inputCls}
                          value={h.label || ''}
                          placeholder="Popisek"
                          onChange={(e) => {
                            const highlights = [...content.philosophyContent.highlights];
                            highlights[i] = { ...highlights[i], label: e.target.value };
                            update(['philosophyContent', 'highlights'], highlights);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <h3 className="text-white font-heading text-lg font-semibold mb-4">Kontakt a firemní údaje</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Telefon" value={content.siteConfig?.phone} onChange={(v) => update(['siteConfig', 'phone'], v)} />
                <Field label="E-mail" value={content.siteConfig?.email} onChange={(v) => update(['siteConfig', 'email'], v)} />
                <Field label="Adresa" value={content.siteConfig?.address} onChange={(v) => update(['siteConfig', 'address'], v)} />
                <Field label="IČO" value={content.siteConfig?.ico} onChange={(v) => update(['siteConfig', 'ico'], v)} />
                <Field label="Nadpis kontaktní sekce" value={content.contactContent?.sectionSubtitle} onChange={(v) => update(['contactContent', 'sectionSubtitle'], v)} />
                <Field label="Popis kontaktní sekce" value={content.contactContent?.description} onChange={(v) => update(['contactContent', 'description'], v)} />
              </div>
            </div>
          </>
        )}

        {tab === 'tym' && (
          <div className="space-y-4">
            {(content.teamMembers || []).map((member: any, i: number) => (
              <div key={i} className={cardCls}>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center gap-3 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.image} alt={member.name} className="w-28 h-36 object-cover object-top rounded-xl border border-white/10" />
                    <ImageUpload token={token} directory="images/team" onUploaded={(path) => updateArrayItem('teamMembers', i, 'image', path)} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Jméno" value={member.name} onChange={(v) => updateArrayItem('teamMembers', i, 'name', v)} />
                      <Field label="Role" value={member.role} onChange={(v) => updateArrayItem('teamMembers', i, 'role', v)} />
                      <Field label="Podtitulek" value={member.subtitle} onChange={(v) => updateArrayItem('teamMembers', i, 'subtitle', v)} />
                      <Field label="E-mail" value={member.email} onChange={(v) => updateArrayItem('teamMembers', i, 'email', v)} />
                    </div>
                    <Field label="Popis" textarea value={member.description} onChange={(v) => updateArrayItem('teamMembers', i, 'description', v)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'projekty' && (
          <div className="space-y-10">
            {projectEditor('currentProjects', 'Aktuální nabídka')}
            {projectEditor('soldProjects', 'Historie prodejů')}
          </div>
        )}

        {tab === 'zpravy' && (
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className={`${cardCls} text-center`}>
                <p className="text-white/40 text-sm">Zatím žádné zprávy z kontaktního formuláře.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cardCls}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <p className="text-white font-semibold text-sm">{msg.name}</p>
                  <p className="text-white/30 text-xs">{msg.created_at}</p>
                </div>
                <p className="text-brass text-xs mb-1">
                  <a href={`mailto:${msg.email}`} className="hover:underline">{msg.email}</a>
                  {msg.phone ? <span className="text-white/40"> · {msg.phone}</span> : null}
                </p>
                <p className="text-white/70 text-sm whitespace-pre-wrap mt-3">{msg.message}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
