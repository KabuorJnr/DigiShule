# Bulk data import

Populate DigiShule with real school data (students, teachers, staff, parents)
from CSV files instead of typing everything by hand.

## How it works

`scripts/import.mjs` reads the CSV files in this folder and writes them to the
Supabase database. It:

- upserts the **students**, **teachers** and **staff** data rows,
- creates **login accounts** (Supabase Auth) for students, teachers and parents,
- links each **parent** (and student) account to the correct student record.

It is **idempotent** — re-running updates existing records (matched by admission
number / id / username) instead of creating duplicates, so you can fix a CSV and
run it again safely.

It uses the service-role key and therefore must be run from a trusted machine
(never the browser).

## Run it

1. Copy each template to its real filename and fill in your data:

   ```bash
   cd data-import
   cp students.example.csv students.csv
   cp teachers.example.csv teachers.csv
   cp staff.example.csv    staff.csv
   cp parents.example.csv  parents.csv
   ```

   The real `*.csv` files are gitignored (they hold personal data); only the
   `*.example.csv` templates are committed. You can import only the files you
   provide — missing ones are skipped.

2. From the `digiSchool/` folder, with the same `.env` used for seeding
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

   ```bash
   set -a && . ./.env && set +a
   node scripts/import.mjs                 # reads ./data-import
   node scripts/import.mjs ./some-folder   # custom folder
   ```

Set a default password for any account whose `password` column is blank:

```bash
IMPORT_DEFAULT_PASSWORD='Start@123' node scripts/import.mjs
```

If `IMPORT_DEFAULT_PASSWORD` is not set, blank passwords fall back to
`changeme` — tell users to change it on first login.

## File formats

Headers are case-insensitive; column order doesn't matter; extra columns are
ignored. Wrap any value containing a comma in double quotes.

### students.csv
`name,adm,class,gender,username,password`

- `adm` (admission number) is the unique key — re-importing the same `adm`
  updates that student.
- `class` is the stream, e.g. `1A`, `2B`, `3A`, `4B`.
- `username`/`password` are optional. Blank `username` defaults to the
  admission number; blank `password` uses the default password.
- Grades are managed in the Gradebook, so imported students start with no
  scores.

### teachers.csv
`name,subject,department,status,username,password`

- `status` defaults to `active`. Blank `username` defaults to a slug of the
  name (e.g. `johnouma`).

### staff.csv
`name,role,dept,status` (optional extra column: `id`)

- Non-teaching/HR records used for staff attendance. These get **no** login
  account. `status` defaults to `Present`.
- Re-import matches an existing staff member by **name** (so updating a row is
  safe). If you have two staff with the same name, add an `id` column and give
  each a unique value (e.g. `s101`) to control updates explicitly.

### parents.csv
`name,username,password,child_adm`

- `child_adm` must match a student's admission number. Import students first
  (or in the same run — students are processed before parents).
- One row per parent/guardian login.

## Example

The `*.example.csv` files show the exact format with a few sample rows. Copy
them to `*.csv` (see "Run it" above) and replace the rows with your real data.
