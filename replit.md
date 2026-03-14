# Workspace

## Overview

Gas Delivery Management Portal — a full-stack web app for recording and managing gas cylinder deliveries to customers with an eligibility tracking system.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TanStack Query, Wouter, React Hook Form, Tailwind CSS, Framer Motion
- **Excel export**: ExcelJS
- **File uploads**: Replit Object Storage (GCS-backed) + Uppy v5 (presigned PUT uploads)
- **Auth**: Session-based (express-session)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── gas-portal/         # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── object-storage-web/ # Uppy-based ObjectUploader component
├── scripts/
└── package.json
```

## Application Features

### Roles
- **Admin** (username: `admin`, password: `admin123`): Full access including Settings, Admin Panel, Excel export, delete records
- **Users** (username: `user1`–`user4`, password: `user123`): Can add delivery records and search customers

### Pages
- **Login** — Session-based authentication
- **Dashboard** — Summary stats (deliveries today, this month, recent records)
- **Add Delivery** — Record a gas delivery (consumer number, name, date). Mobile number auto-populated from previous records for known consumer numbers.
- **Search** — Search by consumer number, name, or mobile. Shows last delivery date, next eligible date, and color-coded eligibility status (green=eligible, red=not yet eligible)
- **Admin Panel** (admin only) — View/delete all records, Export to Excel, attach/delete files per delivery
- **Settings** (admin only) — Configure the waiting days between deliveries (default: 25 days)

### Business Logic
- **Next Eligible Date** = Delivery Date + Waiting Days (configurable, default 25)
- **Mobile number lookup**: If a consumer number already exists in the database, mobile number and name are auto-filled from the most recent delivery record
- **Excel export**: Downloads all records as a formatted .xlsx file
- **File attachments**: Each delivery can have image/PDF/Word files attached. Files uploaded via presigned GCS URLs (Uppy v5), served from `/api/storage/objects/*`. Admin can delete attachments; all users can view them from the Search page.

## Database Schema
- `users` — Stores user accounts (id, username, password, name, role)
- `deliveries` — Delivery records (consumer_number, customer_name, mobile_number, delivery_date, next_eligible_date, created_by)
- `settings` — Portal configuration (waiting_days, default 25)
- `delivery_files` — File attachments per delivery (delivery_id, file_name, file_type, file_size, object_path, uploaded_by)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/gas-portal run dev` — run the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client/Zod from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push schema changes to database
