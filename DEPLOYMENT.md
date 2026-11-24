# Production Deployment Guide

This guide covers deploying the EMC Talent Acquisition Portal as a production webapp.

## Architecture

| Layer | Recommended host | Why |
|---|---|---|
| Frontend (Vite/React SPA) | Vercel | Static SPA, fast CDN, simple env/build config |
| Backend (Express + Prisma + schedulers) | Render / Railway / Fly.io / Azure App Service / VPS | Needs persistent Node process, DB connections, background schedulers, secure file handling |
| Database | Neon PostgreSQL / managed Postgres | Prisma-managed relational data |
| File storage | AWS S3 / Cloudflare R2 / DigitalOcean Spaces / Filebase | Production file uploads; local storage is not production-safe |
| Email | Resend or SMTP provider | Invitation/OTP/notification delivery |

> Vercel is recommended for the **frontend**. The current backend is a long-running Express server and should be deployed to a persistent Node host.

---

## 1. Credentials / Secrets Required

### A. Vercel (Frontend)

| Credential | Required | Where to get it | How to use |
|---|---:|---|---|
| Vercel account | Yes | https://vercel.com/signup | Create/import project |
| GitHub repo access | Yes | GitHub repo settings/collaborators | Let Vercel import `Talent-Acquisation-Portal-for-EMC` |
| `VERCEL_TOKEN` (CLI/CI only) | Optional | Vercel → Avatar → Account Settings → Tokens → Create | `vercel login` or CI deploy |

**Vercel Project Settings**
- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

**Vercel Frontend Environment Variables**

| Variable | Required | Example | Where to get/set |
|---|---:|---|---|
| `VITE_API_BASE_URL` | Yes | `https://api.yourdomain.com/api/v1` | Backend deployed HTTPS URL |
| `VITE_CAREER_SITE_URL` | Yes | `https://your-frontend.vercel.app/careers.html` | Deployed frontend/career URL |
| `VITE_APP_NAME` | Optional | `EMC Talent Acquisition Portal` | Product name |
| `VITE_SUPPORT_EMAIL` | Optional | `hr@yourdomain.com` | Support mailbox |

Set in: Vercel Project → Settings → Environment Variables.

---

### B. Backend Host (Render/Railway/Fly/VPS)

| Credential | Required | Where to get it | How to use |
|---|---:|---|---|
| Hosting account | Yes | Provider signup/dashboard | Create Node web service |
| Deploy token/API key (CI) | Optional | Provider account/API settings | Automated deployments |
| Custom domain/DNS access | Recommended | Domain registrar/DNS provider | Point `api.yourdomain.com` to backend |

**Backend build/start**
```bash
npm ci
npm run build
npm --workspace backend run db:deploy
npm --workspace backend run start
```

Health check: `GET /api/v1/health`

---

### C. Database (PostgreSQL / Neon)

| Credential | Required | Where to get it | How to use |
|---|---:|---|---|
| `DATABASE_URL` | Yes | Neon: https://neon.tech → Project → Connect → Connection string | Backend env var |
| DB user/password | Included | Neon connection details | Part of `DATABASE_URL` |
| DB name | Included | Neon connection details | Part of `DATABASE_URL` |

**Recommended format**
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require&schema=emc_talent"
```

**Steps (Neon)**
1. Create Neon account/project.
2. Create database (or use default).
3. Open **Connect** and copy pooled connection string.
4. Add `sslmode=require&schema=emc_talent`.
5. Set as backend `DATABASE_URL`.
6. Run migrations: `npm --workspace backend run db:deploy`.

---

### D. Backend Security/Auth Secrets

| Credential | Required | Where to get it | How to use |
|---|---:|---|---|
| `JWT_SECRET` | Yes | Generate locally | Signs auth tokens; 64+ random chars |
| `TOTP_ENCRYPTION_KEY` | Yes | Generate locally | Encrypts HR TOTP secrets at rest (base64 32 bytes) |
| `SEED_SUPER_ADMIN_EMAIL` | Yes | Your HR admin email | Initial super admin seed |
| `SEED_SUPER_ADMIN_NAME` | Yes | Name | Seed display name |
| `SEED_IT_ADMIN_EMAIL` | Yes | IT admin email | Initial IT admin seed |
| `SEED_IT_ADMIN_PASSWORD` | Yes | Create strong password | Seed IT admin password; rotate after first login |

**Generate secrets**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### E. Backend URL/CORS Config

| Variable | Required | Example |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Host-dependent | `4000` or platform-provided |
| `APP_URL` | Yes | `https://your-frontend.vercel.app` |
| `API_URL` | Yes | `https://api.yourdomain.com` |
| `PUBLIC_API_URL` | Yes | `https://api.yourdomain.com` |
| `CAREER_SITE_URL` | Yes | `https://your-frontend.vercel.app/careers.html` |
| `TRACK_APPLICATION_URL` | Yes | `https://your-frontend.vercel.app/track-application.html` |
| `CORS_ORIGINS` | Yes | `https://your-frontend.vercel.app` |

> In production, these must be deployed HTTPS URLs; no localhost.

---

### F. Email Provider

Use **one** option.

#### Option 1: Resend (recommended)

| Credential | Required | Where to get it |
|---|---:|---|
| `RESEND_API_KEY` | Yes | Resend → API Keys → Create API Key |
| `MAIL_FROM` | Yes | Verified sender/domain in Resend |
| `MAIL_REPLY_TO` | Recommended | HR mailbox |

**Steps**
1. Create account: https://resend.com.
2. Verify domain (DNS records) for production delivery to any recipient.
3. Create API key.
4. Set `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`.

#### Option 2: SMTP

| Credential | Required | Where to get it |
|---|---:|---|
| `SMTP_HOST` | Yes | Mail provider SMTP settings |
| `SMTP_PORT` | Yes | Provider docs (587/465) |
| `SMTP_SECURE` | Yes | `true` for 465, usually `false` for 587 STARTTLS |
| `SMTP_USER` | Yes | SMTP username/account |
| `SMTP_PASS` | Yes | SMTP password/app password/token |
| `MAIL_FROM` | Yes | Approved sender |
| `MAIL_REPLY_TO` | Recommended | HR mailbox |

---

### G. File Storage (S3-compatible, production)

| Credential | Required | Where to get it |
|---|---:|---|
| `STORAGE_PROVIDER=s3` | Yes | env config |
| `STORAGE_ALLOW_LOCAL=false` | Yes | env config |
| `S3_ENDPOINT` | Yes | Provider endpoint (AWS/R2/Spaces/Filebase) |
| `S3_REGION` | Yes | Provider region (`auto` for some providers) |
| `S3_BUCKET` | Yes | Create bucket in provider console |
| `S3_ACCESS_KEY_ID` | Yes | Provider IAM/access keys |
| `S3_SECRET_ACCESS_KEY` | Yes | Provider IAM/access keys |
| `S3_FORCE_PATH_STYLE` | Provider-dependent | `true` often for Filebase/MinIO; check provider |

**Steps**
1. Create bucket.
2. Create access key with least-privilege read/write/delete for that bucket.
3. Set backend env vars.
4. Test upload/download through app.

---

## 2. Frontend Deployment (Vercel)

1. Push code to GitHub.
2. Vercel → **Add New Project** → Import repo.
3. Set **Root Directory** to `frontend`.
4. Confirm build: `npm run build`, output `dist`.
5. Add frontend env vars (`VITE_API_BASE_URL` etc.).
6. Deploy.
7. Verify SPA routes; `frontend/vercel.json` includes rewrite to `index.html`.

**CLI**
```bash
npm i -g vercel
vercel login
cd frontend
vercel --prod
```

---

## 3. Backend Deployment (Persistent Node Host)

1. Create web service from same repo.
2. Set all backend env vars.
3. Build command: `npm ci && npm run build`
4. Start command: `npm --workspace backend run start`
5. Pre-deploy/release command: `npm --workspace backend run db:deploy`
6. Configure health check: `/api/v1/health`.
7. Ensure HTTPS and custom domain.

---

## 4. Post-Deploy Checklist

- [ ] `GET /api/v1/health` returns OK.
- [ ] Frontend loads and can call backend (`VITE_API_BASE_URL` correct).
- [ ] CORS allows frontend domain only.
- [ ] HR login/TOTP enrollment works.
- [ ] DB migrations applied.
- [ ] File upload/download works (S3).
- [ ] Email send works (Resend/SMTP, verified sender).
- [ ] Reports CSV/Excel/PDF download works.
- [ ] Secrets rotated if ever exposed in chat/logs.
- [ ] `npm audit` reviewed; critical/high issues addressed.

---

## 5. Centralized API Base

All backend APIs are mounted under `/api/v1`.

| Module | Base path |
|---|---|
| Health | `/api/v1/health` |
| Auth | `/api/v1/auth/*` |
| Users/RBAC | `/api/v1/users/*` |
| Departments | `/api/v1/departments/*` |
| Designations | `/api/v1/designations/*` |
| Programs | `/api/v1/programs/*` |
| Employment Types | `/api/v1/employment-types/*` |
| Employees | `/api/v1/employees/*` |
| Candidates | `/api/v1/candidates/*` |
| Openings | `/api/v1/openings/*` |
| Applications | `/api/v1/applications/*` |
| AI Screening | `/api/v1/ai-screening/*` |
| Interviews | `/api/v1/interviews/*` |
| Offers | `/api/v1/offers/*` |
| Documents | `/api/v1/documents/*` |
| Dashboard | `/api/v1/dashboard/*` |
| Reports | `/api/v1/reports/*` |
| Notifications | `/api/v1/notifications/*` |
| Settings | `/api/v1/settings/*` |
| Files | `/api/v1/files/*` |
| Public career portal | `/api/v1/public/*` and public routes in server mount |
| Employee invitations/databank | `/api/v1/employee-invitations/*` and related routes |

For exact endpoint contracts, check `backend/src/modules/*.ts` and dev Swagger at `/api/v1/docs`.
