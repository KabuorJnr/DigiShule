# DigiShule (EduOne)

DigiShule (also known as EduOne) is a comprehensive, offline-first school management system. It provides role-based portals for students, parents, teachers, and administrators to track attendance, grades, finances, discipline, and parent-teacher meetings.

## Features

- **Role-Based Portals**: Tailored interfaces for Principal, Registrar, Finance, Teachers, Students, and Parents.
- **Offline Support**: PWA with IndexedDB offline caching and background sync when connection is restored.
- **Database Backend**: Powered by Supabase (PostgreSQL) with strict Row Level Security (RLS) policies.
- **Communications**: Automated messaging and SMS broadcast system for notices.
- **Grade Tracking**: CBC-aligned and numerical grade computation with PDF report card generation.

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm or yarn
- Supabase account (for database and auth)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/KabuorJnr/DigiShule.git
   cd DigiShule
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Copy the example environment file and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
   *Note: Never commit your real `.env` file containing secrets!*

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## Scripts & Tools

All utility scripts for database seeding, testing, and RPC checks are located in the `scripts/` directory.

- `npm run lint`: Run ESLint across the codebase.
- `npm run test`: Run the Vitest test suite.
- `npm run build`: Build the frontend for production.

## Project Structure

- `/src/components`: Reusable UI widgets and layout components.
- `/src/views`: The main portal views (e.g., `StudentPortal`, `AdminDashboard`).
- `/src/data`: Static lookup data and configuration constants.
- `/src/lib`: Supabase client and offline sync logic.
- `/src/tests`: Vitest unit and integration tests.
- `/api`: Serverless functions (e.g., Vercel API routes for email sending).
- `/scripts`: Debugging and database seeding tools.
- `/supabase`: SQL migrations and database schema setup.
