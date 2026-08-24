-- 0002 – přihlášení, které se vejde do CPU limitu Cloudflare Workers
--
-- Proč: PBKDF2-SHA256 s 210 000 iteracemi spotřebuje ~40 ms CPU. Cloudflare
-- Pages Functions mají na free plánu limit 10 ms CPU na požadavek, takže
-- /api/login končilo chybou (Worker exceeded CPU time limit / 500).
-- 25 000 iterací je ~5 ms CPU a do limitu se vejde.
--
-- Heslo zůstává stejné jako v 0001 (viz CLOUDFLARE-SETUP.md), jen se přepočítá
-- hash s novou solí a nižším počtem iterací. Na placeném plánu lze počet
-- iterací zvýšit proměnnou ADMIN_PBKDF2_ITERATIONS – kód při úspěšném
-- přihlášení hash automaticky posílí.
--
-- Spuštění na produkci:
--   npx wrangler d1 execute ddhomeinvest --remote --file=migrations/0002_login_cpu_safe.sql

UPDATE admin_users
SET
  password_hash = 'c6478af73d373b8f7af8580580046cc46fa5d566df8c2331d9f21c43c8f47f58',
  password_salt = 'ae7bae85c5d35028b2037b2efeae8ed3',
  iterations = 25000
WHERE username = 'honza2555';

-- Pokud by uživatel chyběl (např. když 0001 proběhla jen zčásti), založíme ho.
INSERT INTO admin_users (username, password_hash, password_salt, iterations)
VALUES (
  'honza2555',
  'c6478af73d373b8f7af8580580046cc46fa5d566df8c2331d9f21c43c8f47f58',
  'ae7bae85c5d35028b2037b2efeae8ed3',
  25000
)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  iterations = excluded.iterations;
