# DigiShule SaaS — System Architecture & Documentation

## 1. System Overview
DigiShule is a robust, production-grade, multi-tenant SaaS application designed specifically for Kenyan secondary schools. It provides a complete digital ecosystem for school administration, academic tracking, financial management, and parent-student communication.

**Core Philosophies:**
- **Multi-Tenancy:** One unified database serves thousands of schools. Data is strictly isolated.
- **Offline-First:** Designed for rural connectivity. Teachers can take attendance and marks offline; the system syncs automatically when the internet returns.
- **Performance:** Heavy aggregations are offloaded to Postgres RPCs. Static assets are cached locally via Progressive Web App (PWA) Service Workers.

---

## 2. Technology Stack
- **Frontend Framework:** React 18 (Vite)
- **Styling:** CSS Modules / Vanilla CSS with Lucide React icons
- **Backend/Database:** Supabase (PostgreSQL, Go-based Auth, Edge Functions)
- **Offline Engine:** `idb` (IndexedDB Wrapper) and `vite-plugin-pwa`
- **Analytics & PDF Export:** Recharts, jsPDF, jspdf-autotable, SheetJS (XLSX)
- **SMS Gateway:** Africa's Talking API (via Supabase Edge Functions)

---

## 3. Multi-Tenant Architecture
DigiShule achieves multi-tenancy at the frontend API layer rather than complex Postgres RLS.
- **Global Table Structure:** Almost all tables (e.g., `students`, `teachers`, `invoices`) contain a `school_id` foreign key.
- **The Wrapper (`api.js`):** The React frontend never queries Supabase directly. It routes through `fetchTable(tableName)` and `upsertRow(tableName, payload)`.
- **Automatic Injection:** The wrapper reads the current user's active `school_id` from local storage and automatically injects `.eq('school_id', _schoolId)` into every single read, and `{ school_id: _schoolId }` into every single write.
- **Developer Bypass:** The system includes a hidden Developer Portal (`Ctrl+Shift+A` + Master Password) that bypasses `api.js` to perform global `supabase.from()` raw queries, granting a God-Mode view across the SaaS.

---

## 4. Offline-First Synchronization Engine
To protect against intermittent internet connections:
1. **App Shell Caching:** `vite-plugin-pwa` registers a Service Worker that permanently caches the HTML, CSS, JavaScript, and fonts. The app loads instantly even on Airplane Mode.
2. **Read Caching:** When `api.js` fetches data (like a student roster), it saves a copy to IndexedDB via `offlineSync.js`. If the user reloads the page while offline, the API layer falls back to the IndexedDB cache.
3. **Mutation Queuing:** If a teacher submits grades or attendance while offline, the `upsertRow` function intercepts the `Failed to fetch` network error. Instead of crashing, it places the JSON payload into an IndexedDB `mutationQueue`.
4. **Auto-Flush:** The app listens for `window.addEventListener('online')`. The exact millisecond the connection is restored, `flushSyncQueue()` empties the queue to Supabase in the background.

---

## 5. Core Modules

### A. Authentication & Roles
Supabase handles user identity. Users are assigned one of the following roles upon registration:
- **Principal / Admin:** Full access to settings, staff welfare, analytics, and global finances.
- **Teacher:** Scoped access to assigned classes (Timetables, Gradebook, Attendance).
- **Student:** View-only access to their specific grades, timetable, and library loans.
- **Parent:** Access to their linked child's fee statements, disciplinary records, and report cards.

### B. Analytics & KNEC Report Cards
- **Backend Aggregation:** The `get_academic_analytics` Postgres RPC processes thousands of JSONB student scores securely on the server, returning calculated averages to the frontend to prevent memory leaks.
- **PDF Generation:** Using `jspdf-autotable`, the system generates Ministry-standard KNEC Report Cards. It dynamically calculates CBC / 8-4-4 grades, plots Value Addition, and includes physical signature/stamp blocks.

### C. NEMIS Export
- Generates compliant CSV exports containing UPI numbers, birth certificates, and parent contact information, instantly formatted for upload to the Ministry of Education's NEMIS portal.

### D. File Storage & Media Gallery
- **Supabase Storage:** Files (like Admission PDFs and Gallery Photos) are not stored in the database. They are uploaded to the `eduone-files` bucket.
- **cPanel-Style Management:** The Media Manager in the Admin Dashboard allows bulk uploads and deletion of images.
- **CDN Rendering:** The Gallery viewer pulls secure, temporary `getSignedUrl()` links to stream images efficiently without slowing down the React application.

### E. SMS Broadcast Engine
- **Africa's Talking:** Deployed as a Supabase Edge Function (`/send-sms`).
- **Logging:** Every SMS sent by a school is physically logged to the `sms_logs` table for auditing and billing purposes.

---

## 6. Database Schema Overview
*The most critical tables in the PostgreSQL database:*

- `schools`: The root tenant table. Contains configuration JSONs (fee structures, grade boundaries).
- `profiles`: The user table linked to `auth.users`. Contains `role` and `school_id`.
- `students`: Linked to `schools`.
- `staff`: Stores specific operational data (departments, basic pay) for employees.
- `file_metadata`: Stores pointers and descriptions for objects residing in the Supabase Storage bucket.
- `invoices` & `finance_payments`: The core accounting tables handling KES billing and fee tracking.
