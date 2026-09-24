# FinSutra

**Your business money, understood automatically.**
Record. Track. Invoice. Collect. Understand.

FinSutra is an offline-first business finance app for Indian SMBs, founders, freelancers and agencies. It answers four questions instantly: **How much money do I have? Who owes me? Who do I owe? What happened to my money?**

## Highlights

- **Offline-first** — your device is the source of truth (IndexedDB via Dexie). Everything works with no internet.
- **Installable PWA** — add to home screen, full-screen, works offline. Mobile-first UI (bottom nav, bottom sheets, camera receipt capture).
- **On-device AI** — natural-language transaction capture ("Paid ₹18,500 to ABC Printers for brochures"), receipt/PDF extraction, and an **AI CFO** that answers questions from your ledger. No external API, fully offline.
- **Invoicing** — dynamic line items, tax/discount, live totals, PDF export, payments that recompute balances and receivables aging.
- **Dashboard & Reports** — cash flow, receivables/payables, category breakdowns, CSV/JSON/PDF export.
- **Google Drive sync** — real OAuth (configurable Client ID) with a clearly-labelled **Demo Sync** fallback. Local DB stays authoritative; Drive is backup/sync only.

## Tech stack

React + TypeScript · Vite · Tailwind CSS · Dexie (IndexedDB) · jsPDF · vite-plugin-pwa · custom SVG charts.

## Getting started

```bash
npm install
npm run dev      # dev server
npm run build    # production build (PWA)
npm run preview  # preview the production build
```

Open the app, click **Explore Demo** to load a sample business (TalentRayz Technologies), or **Create My Business** to start fresh.

## Google Drive (optional)

Paste a Google OAuth **Web Client ID** (scope `drive.file`, with the app's origin allow-listed) in **Settings → Google Drive**. Without one, FinSutra uses a local **Demo Sync** — never presented as a real Google connection.

---

Offline-first MVP · data stays on your device.
