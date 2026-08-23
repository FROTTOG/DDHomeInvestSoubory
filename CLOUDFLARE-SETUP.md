# Cloudflare nasazení pro D&D HOMEINVEST

## Co je přidané
- `wrangler.toml` pro Cloudflare Worker + statické assety z tohoto repozitáře
- D1 databáze přes binding `DB`
- R2 bucket přes binding `MEDIA`
- serverová administrace s loginem `honza2555`
- ukládání obsahu webu do D1
- upload obrázků do R2 a veřejné servírování přes `/media/...`
- ukládání kontaktů z formuláře do D1

## Důležité
Repozitář obsahuje statický export webu. Administrace a API proto běží přes Cloudflare Worker, který:
1. obslouží existující statický web,
2. doplní API,
3. generuje datový chunk pro veřejný web i administraci z D1.

## První nasazení
1. Nainstalujte závislosti:
   ```bash
   npm install
   ```
2. Přihlaste se do Cloudflare (pokud ještě nejste):
   ```bash
   npx wrangler login
   ```
3. Aplikujte migraci do D1:
   ```bash
   npx wrangler d1 migrations apply ddhomeinvest --remote
   ```
4. Nasazení workeru:
   ```bash
   npm run deploy
   ```

## Lokální vývoj
```bash
npm run dev
```

## Admin
- Administrace (a celé API) běží **pouze na Cloudflare Workeru** — adresa nasazení:
  `https://ddhomeinvest-<subdomena-účtu>.workers.dev/admin/login`
  (adresu najdete v Cloudflare: Workers & Pages → ddhomeinvest → Overview)
- uživatel: `honza2555`
- heslo: `AsD123+--+321DsA`
  (heslo je uloženo jako PBKDF2 hash v D1 tabulce `admin_users`, viz `migrations/0001_initial.sql`)

Doporučení: po prvním produkčním nasazení heslo změnit a nepoužívat ho veřejně v repozitáři.

### Důležité: statické nasazení (např. Endora) administraci NEobsahuje
Statický export v tomto repozitáři umí servírovat pouze veřejné stránky. Na statickém hostingu:
- `/admin/login` zobrazuje informační stránku (přihlášení zde není — staré „přihlášení v prohlížeči"
  s hardcoded heslem bylo z bezpečnostních důvodů odstraněno),
- `/api/*` neexistuje, takže administrace ani formulář kontaktů tam nefungují.

Pro plnou funkcionalitu na hlavní doméně `ddhomeinvest.cz` nastavte Workeru custom domain:
1. Cloudflare → Workers & Pages → `ddhomeinvest` → **Domains & Routes** → *Add* → Custom domain
2. Přidejte `ddhomeinvest.cz` (+ `www`, pokud ji používáte) a v DNS nastavte CNAME, který Cloudflare vygeneruje
3. Potom `https://ddhomeinvest.cz/admin/login` slouží skutečné přihlášení s D1/R2 backing.
