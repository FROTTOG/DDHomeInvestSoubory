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
- URL: `/admin/login`
- uživatel: `honza2555`
- heslo: `AsD123+--+321DsA`

Doporučení: po prvním produkčním nasazení heslo změnit a nepoužívat ho veřejně v repozitáři.
