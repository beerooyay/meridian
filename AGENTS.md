# verification

- use pnpm; the next.js app is the workspace root and shared logic is in packages/core.
- run `pnpm exec tsc --noEmit`, `pnpm --filter @meridian/core test`, and `pnpm run build`.
- browser regression tests: start `pnpm run dev`, then run `pnpm run test:browser`. set `MERIDIAN_TEST_URL` to test another running instance.
- install the browser runtime with `pnpm exec playwright install chromium` if needed. screenshots go in ignored test-results/.
- browser tests mock signup; do not create live accounts or send confirmation emails during tests.
- the app router has no styled-jsx registry. shell and gameplay styles use ordinary react style elements; verify computed styles, not just successful http responses.

# supabase

- public config accepts NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with NEXT_PUBLIC_SUPABASE_ANON_KEY as a legacy fallback.
- privileged server config accepts SUPABASE_SECRET_KEY or legacy SUPABASE_SERVICE_ROLE_KEY. never expose either through a NEXT_PUBLIC_ variable.
- local configuration belongs in git-ignored .env.local. do not print private credentials or commit them.
- obtain confirmation before applying migrations to the hosted project. public connectivity does not prove the migrations have been applied.
