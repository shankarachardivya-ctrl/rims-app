# RIMS Project — Kiro Session Context

Use this file to resume the project in a new Kiro session.
Paste this into the chat when starting a new session.

---

## What This Project Is

**Real3D Inventory Management System (RIMS)**
A React PWA (Progressive Web App) for Real3D Enterprises to manage 3D printing material inventory — filament spools and resin bottles.

---

## All Decisions Made

| Decision | Choice |
|---|---|
| Platform | React PWA (works on phone, laptop, any browser) |
| Hosting | Vercel (free) |
| Backend/Database | Google Sheets + Google Apps Script |
| Auth | Google OAuth + Email/Password |
| Filament unit | Spools (whole numbers) |
| Resin unit | Bottles (whole numbers) |
| Transaction types | Stock In / Sale / Internal Use only |
| BOM export | PDF + CSV |
| Materials | Both filaments and resins |
| Tech stack | React + Vite + TypeScript + Tailwind CSS + Zustand + Recharts |

---

## What Has Been Built (Complete)

All code is at: `D:\kiro files\real3D\rims-app\`
Also copied to: `D:\kiro files\rims-app\` (the GitHub repo clone)

### Pages Built
- **Login** — email/password + Google OAuth, demo credentials work
- **Dashboard** — KPI cards, pie chart (material distribution), 14-day bar chart (stock in/sales/internal use), low stock alerts, recent transactions
- **Search** — search by name/SKU, info card with stock, location, last transaction
- **Products** — full CRUD, filament + resin, admin only edit/delete
- **Transactions** — history list with filter
- **Suppliers** — full CRUD
- **Customers** — full CRUD
- **Reports & BOM** — auto low stock pull + manual pre-orders tab, PDF export + CSV export

### Components Built
- Scanner dialog (accessible from topbar) — QR/barcode mode, OCR text mode, manual SKU entry fallback
- Transaction modal — auto ID, product info, type selector, whole number quantity, timestamp, remarks
- Sidebar + mobile drawer navigation
- Role-based access (Admin / Warehouse Operator / Sales)
- Toast notifications

### Other Files
- `D:\kiro files\real3D\google-apps-script\Code.gs` — complete Google Apps Script backend
- `D:\kiro files\real3D\SETUP.md` — full setup guide
- `D:\kiro files\real3D\PRD_RIMS_v2.md` — full PRD v2

### Build Status
- TypeScript: ✅ zero errors
- Production build: ✅ successful (vite build passes)
- Demo login works: `admin@real3d.com` / `demo123`

---

## What Still Needs To Be Done

### Immediate (to get the app live)
1. **Push code to GitHub** — repo is `github.com/shankarachardivya-ctrl/rims-app`
   - Problem: Git is authenticated as wrong account (`divyashankarachar` instead of `shankarachardivya-ctrl`)
   - Fix options:
     - Use Personal Access Token from `shankarachardivya-ctrl` account
     - Or upload files manually via GitHub browser (Add file → Upload files)
     - Files to upload: everything in `D:\kiro files\rims-app` EXCEPT `node_modules` and `dist`

2. **Deploy on Vercel** — go to vercel.com, sign up with GitHub (`shankarachardivya-ctrl`), import repo, deploy

3. **Set up Google Sheets** — follow `SETUP.md`:
   - Create sheet with 6 tabs: Products, Transactions, Users, Suppliers, Customers, PreOrders
   - Add headers to each tab (detailed in SETUP.md)
   - Paste `Code.gs` into Apps Script, deploy as web app
   - Copy deployment URL into Vercel environment variable `VITE_APPS_SCRIPT_URL`

### Future Features (from PRD, not yet built)
- User Management page (`/users`) — listed in nav but page not created yet
- Offline mode / transaction queuing
- Push notifications for low stock
- PDF invoice generation

---

## File Structure

```
D:\kiro files\real3D\
├── rims-app\                  ← Original source
├── google-apps-script\
│   └── Code.gs                ← Paste into Google Apps Script
├── PRD_RIMS_v2.md
└── SETUP.md

D:\kiro files\rims-app\        ← GitHub repo clone (same code)
```

---

## Demo Credentials (for testing without Google Sheets)

| Role | Email | Password |
|---|---|---|
| Admin | admin@real3d.com | demo123 |
| Warehouse | warehouse@real3d.com | demo123 |
| Sales | sales@real3d.com | demo123 |

---

## GitHub Repo
`https://github.com/shankarachardivya-ctrl/rims-app`

---

*Generated from Kiro session — September 2026*
