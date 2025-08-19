# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    ## DebateTab (Vite + React + Supabase)

    This app is wired to Supabase (Postgres + RLS). Follow the steps below to run locally and connect to your Supabase project.

    ### 1) Prerequisites

    - Node.js 18+ and npm
    - A Supabase project (URL + anon key)

    ### 2) Environment variables

    Copy `.env.example` to `.env` and fill in your Supabase values. This repo already ignores `.env` so secrets won't be committed.

    Keys used by the app:

    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`

    The Supabase client is created in `src/config/supabase.ts` and consumed by components (e.g., `SupabaseStatus`).

    ### 3) Create database schema in Supabase

    Open Supabase Dashboard → SQL Editor → paste and run `supabase.schema.sql` from the project root. The script:

    - Creates tables: users, tournaments, teams, members, speakers, rounds, matches, match_teams, results
    - Enables Row Level Security and read-only select policies for public browsing tables

    You can re-run the script safely; it uses `IF NOT EXISTS` guards.

    Note: Never use the database password in the frontend. Only the public anon key belongs in `.env` for the web app.

    ### 4) Install and run

    ```powershell
    npm install
    npm run dev
    ```

    Open the printed local URL. You should see “Supabase: Connected” if the schema exists and the env vars are correct.

    For a production build:

    ```powershell
    npm run build
    npm run preview
    ```

    ### 5) Deploy (GitHub Pages)

    This repo is set up to deploy the static build to GitHub Pages. Ensure the environment variables are set for your hosting workflow (for purely static hosting with client-side Supabase, `.env` is only used at build time).

    ```powershell
    npm run deploy
    ```

    ### Troubleshooting

    - Missing env vars: check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
    - RLS errors: confirm you ran `supabase.schema.sql` and the select policies exist for the tables you query.
    - CORS or network errors: verify the Supabase project URL matches your Dashboard.
