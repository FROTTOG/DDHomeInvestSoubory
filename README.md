# D&D HOMEINVEST s.r.o. – Next.js web

Moderní webové stránky pro rodinnou firmu D&D HOMEINVEST specializující se na
rekonstrukce bytů a domů v jižních Čechách.

## Technologie

- **Framework**: Next.js 14 (App Router), statický export
- **Styling**: Tailwind CSS
- **Jazyk**: TypeScript
- **Hosting**: Cloudflare Pages
- **Backend**: Cloudflare Pages Functions (D1 databáze, R2 úložiště)

## Jak web funguje

Next.js se builduje do statického exportu (`out/`), který Cloudflare Pages
servíruje jako statické soubory. Dynamiku (obsah, administraci, kontaktní
formulář, obrázky) obsluhují Pages Functions:

- veřejný web si obsah načítá za běhu z `GET /api/content` (D1) – **změny
  z administrace se projeví okamžitě, bez rebuildů**
- administrace na `/admin` (login na `/admin/login`) umí upravovat texty,
  tým, projekty (včetně uploadů obrázků do R2) a číst zprávy z formuláře
- kontaktní formulář ukládá zprávy do D1 přes `POST /api/contact`

## Struktura projektu

```
/
├── app/                    # Next.js App Router
│   ├── admin/              # Administrace (/admin) + login (/admin/login)
│   ├── builder/            # Přesměrování na /admin (historická URL)
│   ├── lib/use-content.ts  # Hook na načítání obsahu z /api/content
│   ├── obchodni-podminky/  # Obchodní podmínky
│   ├── pravni-informace/   # Právní informace a GDPR
│   ├── layout.tsx          # Root layout (SEO, fonty)
│   └── page.tsx            # Úvodní stránka
├── public/                 # Statické soubory (loga, obrázky, _headers, sw.js)
├── src/
│   ├── admin-api.js        # Logika API (sdílená s testy)
│   └── default-content.js  # Výchozí obsah webu
├── functions/
│   └── _middleware.js      # Cloudflare Pages Function (/api/*, /media/*)
├── migrations/             # D1 migrace
└── tests/                  # Testy API
```

## Vývoj

```bash
npm install

# jen frontend (bez API, s výchozím obsahem):
npm run dev            # http://localhost:3000

# kompletní web včetně API/D1/R2 (jako na produkci):
npx wrangler d1 execute ddhomeinvest --local --file=migrations/0001_initial.sql  # jednou
npm run preview        # http://localhost:8788

# testy
npm test

# produkční build (výstup ve složce out/)
npm run build
```

## Nasazení

Detailní návod: [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md).

Stručně: push do `main` → Cloudflare Pages spustí `npm run build` a nasadí
`out/` + `functions/`. Bindingy D1/R2 jsou definované ve `wrangler.toml`.

## API (Cloudflare Pages Functions)

- `POST /api/login` – přihlášení (heslo, volitelně uživatelské jméno)
- `POST /api/logout` – odhlášení
- `GET /api/content` – obsah webu (veřejné)
- `PUT /api/content` – uložení obsahu (vyžaduje přihlášení)
- `GET /api/theme` / `PUT /api/theme` – vzhled webu
- `POST /api/upload` – upload obrázků do R2 (vyžaduje přihlášení)
- `POST /api/contact` – odeslání kontaktního formuláře
- `GET /api/contact-messages` – zprávy z formuláře (vyžaduje přihlášení)
- `GET /media/...` – obrázky z R2

## Bezpečnost

- Hesla: PBKDF2 (SHA-256, 210 000 iterací), hash v D1
- Session: náhodný token, v D1 jako SHA-256 hash, platnost 7 dní
- `/admin` a `/builder` jsou noindex (public/_headers)

## Licence

Private – všechna práva vyhrazena D&D HOMEINVEST s.r.o.
