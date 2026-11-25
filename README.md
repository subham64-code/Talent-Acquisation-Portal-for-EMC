# ECOMETRIX CONSULTANTS PVT. LTD. (EMC) - CORPORATE WEBSITE

Official production-ready corporate website for **Ecometrix Consultants Pvt. Ltd. (EMC)**, strictly adhering to approved UI reference designs in `/UI` and company profile specifications.

---

## Architecture & Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom design system with CSS tokens & Google Fonts), Vanilla JavaScript (Modular ES6 architecture).
- **Backend**: Python (Flask REST API architecture).
- **Database**: PostgreSQL (NeonDB hosted database support) with automatic local SQLite fallback (`emc_database.db`).
- **Features**:
  - 11 Complete Corporate Pages matching UI mockups.
  - Accessible Unified Dynamic Modal System (Team profiles, Service details, Tabbed Project Portfolios, Job applications, Global Search).
  - Category filters for Teams, Projects, Insights, and Careers.
  - Interactive Contact Form with backend API validation and success feedback.
  - SEO best practices (Meta tags, OpenGraph, `robots.txt`, `sitemap.xml`).

---

## Project Structure

```
EMC New Website/
├── frontend/
│   ├── index.html          # Home Page
│   ├── about.html          # About Us Page
│   ├── vision.html         # Vision Page
│   ├── mission.html        # Mission Page
│   ├── leadership.html     # Leadership Page
│   ├── teams.html          # Our Teams Page
│   ├── services.html       # Our Services Page
│   ├── projects.html       # Project Portfolio Page
│   ├── insights.html       # Insights & Publications Page
│   ├── careers.html        # Careers Page
│   ├── contact.html        # Contact Us Page
│   ├── robots.txt          # SEO Crawl Directive
│   ├── sitemap.xml         # XML Sitemap
│   ├── css/                # Global & Page-Specific Stylesheets
│   ├── js/                 # Modular JavaScript Interactivity
│   └── assets/             # Brand Logos & Stock Assets
├── backend/
│   ├── app.py              # Flask Application Server Entry Point
│   ├── config.py           # Configuration & DB Connection URI
│   ├── database.py         # SQLAlchemy Setup
│   ├── init_db.py          # Database Seeding Script
│   ├── models/             # SQLAlchemy Database Schema Models
│   └── routes/             # REST API Blueprints (/api/*)
├── requirements.txt        # Python Dependencies
├── .env.example            # Environment Setup Template
└── README.md               # Documentation
```

---

## Running the Project

### Option A: Local Flask Server (Recommended)
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Seed the Database:
   ```bash
   python backend/init_db.py
   ```
3. Run the Flask Server:
   ```bash
   python backend/app.py
   ```
4. Open your browser at `http://localhost:5000`

### Option B: NeonDB / PostgreSQL Setup
Set `DATABASE_URL` in your `.env` file:
```env
DATABASE_URL=postgresql://username:password@ep-sample-123456.us-east-2.aws.neon.tech/emcdb?sslmode=require
```
Then run `python backend/init_db.py` to seed NeonDB.

---

## Deployed + local setup

### Current final state (verified 2026-11-25)

- Backend: `https://talent-acquisation-portal-for-emc-production.up.railway.app` — health `200 {"status":"ok","service":"EMC Talent Acquisition Portal"}`; Brevo REST email working; storage fallback/local plus production S3 variables set; CORS cleaned; rate limiting removed.
- Websites:
  - Main: `https://emc-website-7v6.pages.dev` (alias: `https://emc-website.emc-website-7v6.pages.dev`)
  - HR/Admin: `https://emc-hr-frontend.pages.dev`
  - HR portal: `https://emc-talent-portal-bbd.pages.dev` (branch alias: `https://emc-new-website.emc-talent-portal-bbd.pages.dev`)
  - Main App: `https://emc-one.subhambehera2023.workers.dev`
- API base: `https://talent-acquisation-portal-for-emc-production.up.railway.app/api/v1`
- Endpoint groups from that base: system, auth/hr, employee, career, submissions, users/access, master data, employees, candidates, openings, applications, AI, interviews, offers, documents, dashboard, reports, notifications, settings, files.
- Career apply verified end-to-end through the Pages proxy: `POST /api/career/apply` → `201`, reference `EMC202611J22/A5` (dummy verification record).
- Last completed actions: storage fallback saved/redeployed → health OK; production `PUBLIC_API_URL` and `BYPASS_AUTH` values saved/redeployed → health OK; rate limiting removed → build/test/deploy → health OK.

### Local setup

- Local Live Server: `http://127.0.0.1:5500/EMC%20New%20Website/EMC/frontend/about.html`. All pages use the same files, CSS, JS and images as the deployed site. When opened locally, API calls are sent to the deployed Pages API proxy, so UI, UX and functionality match the deployed site.
- Credentials and links: copy `.env.example` to `.env` and fill in only the secrets you have. The deployed URLs and the cleaned CORS origin list are already filled in.
- HR backend CORS: the Railway HR service uses the three cleaned origins from `.env.example`. Do not add `localhost` there; local Live Server is handled by the Pages proxy.
- Flask-only routes: set `FLASK_API_ORIGIN` in Cloudflare Pages (`emc-website` → Settings → Environment variables) if contact/search/newsletter/chat APIs are needed. The careers listing and apply flow work without it.
- S3 credentials: images are already linked to the Neon S3 bucket; keys are required for uploading new assets and for HR CV uploads. Production has valid S3 credentials plus `STORAGE_ALLOW_LOCAL=true` as a fallback.
