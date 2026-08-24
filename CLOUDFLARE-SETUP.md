# Cloudflare nasazení pro D&D HOMEINVEST (Cloudflare **Pages**)

Web je **Next.js aplikace** (App Router) nasazená na Cloudflare Pages:
`next build` vygeneruje statický export do `out/` a dynamické části
(API, administrace, obrázky) obsluhují **Cloudflare Pages Functions**
(`functions/_middleware.js`) s D1 a R2.

## Jak to funguje
- Next.js stránky (`app/`) se buildují do `out/` a servírují se staticky
- veřejný web si obsah načítá za běhu z `GET /api/content` (D1) –
  změny z administrace jsou vidět **okamžitě, bez rebuildů**
- **login** na `/admin/login` – ověření na serveru přes D1 (PBKDF2 hash)
- **administrace** na `/admin` – editace textů, týmu a projektů, upload
  obrázků do **R2**, prohlížení zpráv z kontaktního formuláře
- kontaktní formulář na úvodní stránce ukládá zprávy do D1 (`POST /api/contact`)
- obrázky z R2 se servírují na `/media/...`

## Struktura
| Soubor/složka | Účel |
|---|---|
| `app/` | Next.js aplikace (úvodní stránka, administrace, právní stránky) |
| `app/lib/use-content.ts` | hook – načítání obsahu webu z `/api/content` |
| `wrangler.toml` | konfigurace Pages projektu (bindingy D1 + R2, build output `./out`) |
| `functions/_middleware.js` | Pages Function – zachytí `/api/*` a `/media/*`, zbytek nechá projít na statické soubory |
| `src/admin-api.js` | logika API (login, obsah, upload, kontakty) – sdílená s testy |
| `src/default-content.js` | výchozí obsah webu (použije se, když je D1 prázdné) |
| `public/_headers` | bezpečnostní hlavičky (u statického exportu nefungují headers() z next.config.js) |
| `migrations/0001_initial.sql` | schéma D1 + administrátorský uživatel |
| `migrations/0002_login_cpu_safe.sql` | hash hesla s 25 000 iteracemi (vejde se do CPU limitu Workers) |
| `tests/admin-api.test.js` | testy API (přihlášení, oprávnění, obsah, upload, kontakty) |

## Build configuration (Cloudflare Pages)
V nastavení Pages projektu (Settings → Build & deployments → Build configuration):

| Políčko | Hodnota |
|---|---|
| Framework preset | `Next.js (Static HTML Export)` (nebo None) |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | *(prázdné)* |
| Production branch | `main` |

Důležité:
- Bindingy řídí **`wrangler.toml` v kořeni repozitáře** (vyžaduje V2 build systém):
  - D1 `DB` → databáze `ddhomeinvest` (id `a03e6e5b-4b46-4334-b344-baef9986c48e`)
  - R2 `MEDIA` → bucket `ddhomeinvestbucket`
- Preview deploymenty (jiné branch) používají **stejné** D1/R2 jako produkce.

## První nasazení / údržba
1. Nainstalujte závislosti:
   ```bash
   npm install
   ```
2. Přihlaste se do Cloudflare (pokud ještě nejste):
   ```bash
   npx wrangler login
   ```
3. Připravte D1 databázi (tabulky obsahu, zpráv a přihlášení admina).
   **Bez tohoto kroku `/admin/login` hlásí chybu** – tabulky v D1 nevzniknou samy:
   ```bash
   npx wrangler d1 execute ddhomeinvest --remote --file=migrations/0001_initial.sql
   npx wrangler d1 execute ddhomeinvest --remote --file=migrations/0002_login_cpu_safe.sql
   ```
   (poprvé po vytvoření projektu; později jen při změně migrací)
4. Stav ověříte na `https://ddhomeinvest.cz/api/health` – vypíše bindingy,
   tabulky a počet administrátorů. `{"ok":true}` znamená, že je vše připraveno.
5. Push do `main` spustí produkční deployment.

## Lokální vývoj
```bash
npm install

# jen frontend (bez API – web zobrazí výchozí obsah):
npm run dev                # next dev, http://localhost:3000

# kompletní web včetně API, D1 a R2 (stejně jako na produkci):
npx wrangler d1 execute ddhomeinvest --local --file=migrations/0001_initial.sql       # jednou
npx wrangler d1 execute ddhomeinvest --local --file=migrations/0002_login_cpu_safe.sql
npm run preview            # next build + wrangler pages dev out/, http://localhost:8788
```

Testy:
```bash
npm test
```

## Admin
- URL: `https://<projekt>.pages.dev/admin/login` (nebo na custom doméně `https://ddhomeinvest.cz/admin/login`)
- uživatel: `honza2555`
- heslo: `AsD123+--+321DsA`
  (heslo je uloženo jako PBKDF2 hash v D1 tabulce `admin_users`, viz `migrations/0001_initial.sql`)

Doporučení: po prvním produkčním nasazení heslo změnit (nový hash vytvořte např. přes
`npx wrangler d1 execute` s vlastním PBKDF2 hashem) a nepoužívat ho veřejně v repozitáři.

### Custom doména
1. Cloudflare → Workers & Pages → `ddhomeinvest` → **Custom domains** → *Set up domain*
2. Přidejte `ddhomeinvest.cz` (+ `www`, pokud ji používáte) a v DNS nastavte CNAME, který Cloudflare vygeneruje.

## Řešení problémů

### `/admin/login` hlásí chybu při přihlášení
1. Otevřete `https://ddhomeinvest.cz/api/health`:
   - `chybí tabulky: ...` → spusťte obě migrace (krok 3 výše)
   - `Chybí D1 binding DB` → v Cloudflare Pages → Settings → Functions přiřaďte
     D1 `ddhomeinvest` jako `DB` a R2 `ddhomeinvestbucket` jako `MEDIA`
     (bindingy řídí `wrangler.toml`, projekt musí používat V2 build systém)
   - `{"ok":true}` → databáze je v pořádku, problém je jinde (viz `wrangler tail`)
2. Chybová hláška z API se zobrazuje přímo na přihlašovací stránce – obsahuje
   přesnou příčinu (`message`) i návod (`hint`).

### Přihlášení trvá dlouho / padá na CPU limit
Cloudflare Pages Functions mají na free plánu **10 ms CPU na požadavek**.
PBKDF2 proto používá 25 000 iterací (~5 ms CPU). Hodnotu lze změnit proměnnou
`ADMIN_PBKDF2_ITERATIONS` (např. na placeném plánu), při dalším úspěšném
přihlášení se hash v D1 automaticky přepočítá.

### Zprávy z kontaktního formuláře nechodí na e-mail
Formulář ukládá zprávy do D1 (záložka **Zprávy** v administraci) a zároveň je
přeposílá na Formspree – ID se nastavuje v administraci (Kontakt a firemní
údaje → *Formspree ID*, výchozí `mrerbaqr`, tj. https://formspree.io/f/mrerbaqr).
Prázdné pole = přeposílání vypnuté. Aktuální efektivní ID ukazuje `/api/health`.

## Poznámky k bezpečnosti
- Přihlášení je ověřováno výhradně na serveru (D1, PBKDF2-SHA256, 25 000 iterací –
  viz výše; hash se při přihlášení automaticky posiluje).
- Ochrana proti hádání hesla: 10 neúspěšných pokusů z jedné IP → `429` na 15 minut.
- Session token: 64 hex znaků, v D1 uložen jako SHA-256 hash, platnost 7 dní.
- `/admin` i `/builder` mají `X-Robots-Tag: noindex` (viz `public/_headers`).
