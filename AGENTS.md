# verification

- use pnpm; the next.js app is the workspace root and shared logic is in packages/core.
- run `pnpm exec tsc --noEmit`, `pnpm test:core`, and `pnpm build`.
- browser regression tests: start `pnpm start` (after build) or `pnpm dev`, then run `pnpm test:browser`. set `MERIDIAN_TEST_URL` to test another running instance.
- install the browser runtime with `pnpm exec playwright install chromium` if needed. screenshots go in ignored test-results/.
- browser tests mock signup; do not create live accounts or send confirmation emails during tests.
- the design-system test asserts at most three font sizes, two text colors, one nav button height, and body lowercase. keep it green.

# design system

- all styles live in app/meridian.css. no inline style blocks, no styled-jsx, no tailwind.
- three type sizes only: --t1 display, --t2 heading, --t3 text. two text colors only: --ink and --ink-2. no accent colors on text.
- one control height --h. every button is `.btn` (+ `.ghost`, `.quiet`, `.wide`) or `.chip`. inputs are `.field`. containers are `.card`.
- all sizing is fluid via clamp() so phone, tablet, and desktop share the same proportions.
- body is text-transform lowercase; write copy in lowercase in source too. inputs keep user casing.
- correct/wrong feedback uses fill and strikethrough, never color.
- avoid box-shadow transitions and backdrop-filter; animate transform and opacity only.

# supabase

- public config accepts NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with NEXT_PUBLIC_SUPABASE_ANON_KEY as a legacy fallback.
- privileged server config accepts SUPABASE_SECRET_KEY or legacy SUPABASE_SERVICE_ROLE_KEY. never expose either through a NEXT_PUBLIC_ variable.
- local configuration belongs in git-ignored .env.local. do not print private credentials or commit them.
- migrations live in supabase/migrations and are applied with `supabase db push` after `supabase link`. avoid postgres reserved words as column names.
- the rate limiter is a security-definer rpc (`ratelimit`) and soft-fails open when SUPABASE_SECRET_KEY is absent.

# deploy

- production is vercel project `meridian`, aliased at https://meridian-world.vercel.app. deploy with `vercel --prod`.
- env vars are managed with `vercel env add <NAME> production` (name first, value on stdin or prompt).
