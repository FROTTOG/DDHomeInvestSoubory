# Cloudflare nasazení pro D&D HOMEINVEST (Cloudflare **Pages**)

Web je nasazený jako **Cloudflare Pages** projekt (statický export webu přímo z kořene
repozitáře + Cloudflare Pages Functions pro dynamické části).

## Co projekt umí
- statický web (Next.js export) se servíruje přímo z kořene repozitáře
- **login** na `/admin/login` – statická stránka s formulářem, ověření na serveru přes D1 (PBKDF2 hash)
- **administrace** na `/admin` – ukládání obsahu webu a vzhledu do **D1**, upload obrázků do **R2**
- dynamický chunk `_next/static/chunks/580.*.js` se generuje na požadování z D1 –
  změny z administrace se tak okamžitě projeví na veřejném webu i v administraci
- kontaktní formulář na úvodní stránce ukládá zprávy do D1 (skript `dd-contact.js` → `/api/contact`)
- obrázky z R2 se servírují na `/media/...`

## Struktura
| Soubor/složka | Účel |
|---|---|
| `wrangler.toml` | konfigurace Pages projektu (bindingy D1 + R2, build output) |
| `functions/_middleware.js` | Pages Function – zachytí `/api/*`, `/media/*` a chunk 580, zbytek nechá projít na statické soubory |
| `src/admin-api.js` | logika API (login, obsah, vzhled, upload, kontakty) – sdílená s testy |
| `src/default-content.js` | výchozí obsah webu a vzhledu (použité, když D1 je prázdné) |
| `admin/login/index.html` | nová login stránka (statická, volá `/api/login`) |
| `dd-contact.js` | skript kontaktního formuláře pro úvodní stránku |
| `migrations/0001_initial.sql` | schéma D1 + administrátorský uživatel `honza2555` |
| `tests/admin-api.test.js` | testy API (přihlášení, oprávnění, chunk, upload, kontakty) |

## Build configuration (Cloudflare Pages)
V nastavení Pages projektu (Settings → Build & deployments → Build configuration):

| Políčko | Hodnota |
|---|---|
| Framework preset | `None` |
| Build command | *(nechat prázdné)* |
| Build output directory | `/` (kořen repozitáře – tam leží `index.html`) |
| Root directory | *(prázdné)* |
| Production branch | `main` |

Důležité:
- Konfiguraci (bindingy) řídí **`wrangler.toml` v kořeni repozitáře** – je zdroj pravdy
  a v dashboardi se už pole neupravují. Vyžaduje **V2 build systém** (default pro nové
  projekty; u starého projektu přepněte build image na V2).
- Bindingy v `wrangler.toml`:
  - D1 `DB` → databáze `ddhomeinvest` (id `a03e6e5b-4b46-4334-b344-baef9986c48e`)
  - R2 `MEDIA` → bucket `ddhomeinvestbucket`
- Preview deploymenty (jiné branch) používají **stejné** D1/R2 jako produkce
  (jediná databáze administrace).

## První nasazení / údržba
1. Nainstalujte závislosti:
   ```bash
   npm install
   ```
2. Přihlaste se do Cloudflare (pokud ještě nejste):
   ```bash
   npx wrangler login
   ```
3. Připravte D1 databázi (přihlášení admina, tabulky obsahu a zpráv):
   ```bash
   npm run db:migrate:remote
   ```
   (poprvé po vytvoření projektu; později jen při změně migrací)
4. Push do `main` spustí produkční deployment. Nebo ručně:
   ```bash
   npm run deploy
   ```

## Lokální vývoj
```bash
npm install
npm run db:migrate:local   # jednou – lokalní emulace D1
npm run dev                # wrangler pages dev (http://localhost:8788)
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

## Poznámky k bezpečnosti
- Staré „přihlášení pouze v prohlížeči" bylo odstraněno – jeho funkce `verify()`
  byla jen stub (vždy vracela `false`), takže se nikdy nedalo přihlásit.
  Přihlášení je nyní ověřováno výhradně na serveru (D1).
- Session token: 64 hex znaků, v D1 uložen jako SHA-256 hash, platnost 7 dní.
- Login stránka i `/admin` mají `noindex`.
