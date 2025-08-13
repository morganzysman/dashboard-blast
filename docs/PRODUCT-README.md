### OlaClick Workforce & Management Suite
A modern, mobile‑first Workforce and Management platform for restaurant and retail teams. Built as a PWA with real‑time analytics, shift planning, QR‑based clocking, and role‑aware notifications that keep admins informed and employees engaged.

## Who this is for
- Operations leaders who want reliable sales insights and clear payroll.
- Managers who need simple shift planning and punctuality oversight.
- Employees who want a frictionless timesheet, shift visibility, and in‑app clocking.

## Core Features

- **Role‑aware navigation**
  - **Management Suite (Admin/Super‑Admin)**: Dashboard, Payroll, Shifts Calendar, Companies, Payment/Utility Costs, Notifications Admin.
  - **Workforce (Employee)**: My Timesheet, Clock, Weekly Shifts.
  - Employees do not see Dashboard/Notifications/Rentability.

- **Shifts**
  - **Admin shift editor**: Define weekly shifts per employee and per account; guardrails for company scope; responsive table editor plus live weekly preview.
  - **Admin Shifts Calendar**: Weekly calendar per account to visualize all employees’ shifts; quick week navigation and account selector.
  - **Employee Weekly Shifts**: “My Shifts (This Week)” calendar with account name and hours; mobile‑first and readable on small screens.

- **Payroll**
  - **Pay periods**: 1–15 and 16–end of month.
  - **Entries**: Clocked and manual; allow decimals for Amount; records account per entry.
  - **Shift vs Clocked analytics**: Show “Shift Time”, “Clocked Time”, and “Variation” (+/‑%) with color cues.
  - **Mark as Paid**: Locks entries as paid for the period and snapshots totals.
  - **Employee Timesheet**: Period navigation (Prev/Next), recap (entries/time/earned), friendly account names, mobile‑first table.

- **Clocking (in‑app QR scanner)**
  - QR code encodes secure clock URL with HTTPS base.
  - In‑app scanner opens by default; validates secret and account; guides employee through clock‑in/out.
  - Late detection: If clock‑in is >10 minutes after scheduled shift start, employee is informed and flagged in notifications.
  - Post clock: Immediate redirect to Timesheet with a friendly confirmation.

- **Analytics**
  - Sales KPIs with account profitability; consistent gain calculation in KPIs and tooltips; mobile‑aware dashboards.

- **PWA**
  - Installable on iOS/Android/Desktop.
  - iOS add‑to‑home instructions with intuitive icons.
  - Push notifications with multi‑device support and user‑configured frequency (for admins).

- **Security & Access**
  - Sessions and role‑based auth: employee, admin, super‑admin.
  - Scoped admin actions (admins restricted to own company; super‑admins are global).
  - API guarded; server‑side checks for sensitive actions.

- **User Management**
  - Create/edit users, update hourly rates and roles.
  - Admin tools: reset password, manage shifts.
  - Super‑admins don’t see “Shifts” button for user cards.

- **Responsive Design**
  - All key views are mobile‑first: payroll, shifts calendars, timesheets, admin cards, action bars.

## Notifications Overview

- Web Push with VAPID; multi‑device per user with frequency control.
- Logs and de‑duplication to prevent spam.
- Tailored delivery by role: employees vs admins.

### Employee Notifications

- **New Shift Ready**
  - Trigger: Manual (admin clicks “Notify” for a specific employee after shift changes).
  - Message: “New Shift ready, check it”
  - Target: Only the selected employee (all their active devices).
  - Intent: Prompt the employee to review their updated weekly schedule.

- **Payroll Paid**
  - Trigger: Manual (when admin marks payroll as paid for the period).
  - Filter: Only employees with total amount > 0 for that period.
  - Message: “You have been paid xxx {currency}”
  - Target: Each qualifying employee (all devices).
  - Intent: Confirm payment status and amount for transparency.

### Admin Notifications

- **Sales Report (Frequency‑based)**
  - Trigger: Automatic, based on per‑device Notification Frequency setting.
  - Cadence options: 30, 60, 240, 480 minutes.
  - Content: Aggregated payments and totals across assigned accounts (currency‑aware).
  - De‑dup: Respects “last notification time” per user; only sends when due.

- **Late Employee Alert**
  - Trigger: Automatic, every 10 minutes the system checks scheduled shifts.
  - Condition: An employee’s shift started >10 minutes ago and they have not clocked in any entry for today on the assigned account.
  - Message: “{Employee Name} is late”
  - Target: Company admins (and super‑admins); scoped to the employee’s company.
  - De‑dup: One notification per late employee per day (no repeats every 10 minutes).

### Subscription & Delivery

- **Opt‑in flow**
  - Authenticated users can enable push; test notification confirms capability.
  - Frequency can be tuned by admins via settings.

- **Multi‑device**
  - Each device tracked separately (name, user agent, last sent time).
  - Sends to all active devices for the target user.

- **Error handling**
  - Invalid endpoints are pruned automatically.
  - Failures are logged with helpful diagnostics.

## How Payroll Works

- **Periods**: Fixed as 1–15 and 16–end of month; default period selected automatically.
- **Rates & Earnings**: Amounts computed using employee hourly rates and time deltas; manual amounts supported with decimals.
- **Mark as Paid**: Creates/updates period snapshots and locks entries as paid; triggers employee notifications.

## How Shifts Work

- **Admin definition**: Per employee, per account, day of week, start/end times.
- **Templates vs reality**: Shifts inform late detection and provide target shift spans; actual timesheet remains the source of truth.
- **Visual calendars**: Admins get an account‑scoped calendar of all employees; employees get a personal weekly view.

## Clocking Flow

- **QR generation**: Admin/super‑admin can generate account QR with secure secret and HTTPS base URL.
- **Scan in app**: In‑app scanner launches by default on the Clock page; validates secret, opens clock UI.
- **Late notice**: If the employee clocks in >10 min after the scheduled shift start, they see a clear “You are late” message.
- **Post action**: Instant redirect to Timesheet with a friendly summary; optional late note.

## Technology Highlights

- **Frontend**: Vue 3, Pinia, Vue Router, Tailwind CSS; PWA with offline support.
- **Backend**: Node/Express, PostgreSQL, web‑push, cron‑based schedulers.
- **Data**: Structured migrations, robust indexes, snapshots for payroll, detailed notification logs.
- **Deployment**: Docker‑ready; Railway compatible; environment‑driven configuration.

## Configuration

- **Environment**
  - `APP_BASE_URL`: Used in generated QR links; auto‑normalized to include https:// if missing.
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`: Web Push keys.
  - Database: `DATABASE_URL` or individual `DB_*` variables.

- **Notifications**
  - Admin device frequency: 30/60/240/480 minutes.
  - Sales reports: generated per frequency; timezone and currency aware.
  - Late alerts: every 10 minutes with de‑duplication.

## Why Companies Choose This

- **Drive punctuality**: Automated late alerts prevent missed openings and understaffed rushes.
- **Operational clarity**: Clear shift planning and side‑by‑side shift vs clocked time for coaching and compliance.
- **Faster payroll**: Half‑month cadence, one‑click mark‑as‑paid, employee confirmations.
- **On‑device engagement**: A true app‑like PWA with push notifications keeps everyone aligned.
- **Mobile‑first**: Designed for phones first; admins and employees can work from anywhere.

## Privacy & Security

- **Scoped access**: Employees only see their data; admins limited to their company; super‑admins for global.
- **Secure QR**: Account secrets protected; URL base normalized to HTTPS.
- **Auditability**: Notification logs, session management, and safe deactivation of invalid subscriptions.


