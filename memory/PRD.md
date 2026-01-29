# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images. The application must include a subscription system with different plans (Starter, Pro, Business) that limit team members and storage. An admin dashboard is required for the account owner to manage users, subscriptions, and view usage statistics.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based
- **Reverse Proxy**: httpx + BeautifulSoup (HTML rewriting)

## User Personas
1. **Account Owner** - Creates team, manages members, views stats
2. **Team Members** - Collaborate on projects, leave comments
3. **Guests** - External reviewers who can comment via name/email

## Core Requirements

### Authentication
- [x] JWT-based user registration and login
- [x] Guest commenting with name/email validation
- [x] Protected routes and API endpoints

### Project Management
- [x] Create projects from URLs, images, and PDFs
- [x] **Server-side reverse proxy** for external websites
- [x] HTML rewriting to route all URLs through proxy
- [x] Annotation script injection
- [x] Responsive viewport controls (Desktop/Tablet/Mobile)

### Reverse Proxy System (Markup.io-style)
- [x] External websites fetched server-side via httpx
- [x] All URLs rewritten to `/api/proxy?url=...`
- [x] Security headers (X-Frame-Options, CSP) stripped
- [x] Links, images, scripts, stylesheets all proxied
- [x] Navigation stays within iframe (same-origin)
- [x] Annotation script injected into every page
- [x] CSS url() references rewritten
- [x] Form actions proxied

### Pin-Based Commenting
- [x] Click on live website to create pins
- [x] Pin positions relative to canvas (scroll-aware)
- [x] Thread-based comments per pin
- [x] File attachments on comments
- [x] Pin status management (open/resolved)
- [x] Show/hide resolved pins toggle
- [x] Search and sort pins

### Admin Features
- [x] Team management (invite, remove members)
- [x] Usage statistics dashboard
- [x] Super Admin page (platform-wide stats)

### Subscription Plans (MOCKED)
- Starter: 5 members, 1GB storage
- Pro: 10 members, 5GB storage
- Business: 50 members, 20GB storage

## What's Been Implemented (as of Jan 29, 2026)

### Phase 1: Core Infrastructure ✅
- FastAPI backend with all routes prefixed /api
- MongoDB integration with Motor async driver
- JWT authentication system
- React frontend with Shadcn UI components
- File upload and serving system

### Phase 2: Reverse Proxy System ✅
- **Server-side website proxy** (`/api/proxy?url=...`)
- HTML parsing and URL rewriting using BeautifulSoup
- Security header removal for seamless iframe embedding
- Annotation script injection for cross-page persistence
- CSS url() rewriting for proper asset loading
- Form and link interception for navigation

### Phase 3: Pin-Based Comments ✅
- Pin creation by clicking on proxied website
- Position calculation relative to canvas element
- Comment threads per pin
- File attachment support
- Pin status (resolve/reopen)
- Show/hide resolved toggle

### Phase 4: Dashboard & UI ✅
- Project grid layout with thumbnails
- Project search and sorting
- Comment sidebar with search/sort
- Browse and Comment mode toggle
- Viewport size controls

## API Endpoints

### Reverse Proxy
- GET /api/proxy?url=<encoded_url> (proxy external pages)
- POST /api/proxy?url=<encoded_url> (handle form submissions)

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Teams
- GET /api/teams/me
- PUT /api/teams/plan
- POST /api/teams/invite
- GET /api/teams/members
- DELETE /api/teams/members/{id}

### Projects
- POST /api/projects (create)
- GET /api/projects (list)
- GET /api/projects/{id}
- DELETE /api/projects/{id}

### Pins & Comments
- POST /api/pins
- GET /api/pins/{project_id}
- PUT /api/pins/{pin_id}/status
- POST /api/comments
- POST /api/comments/with-attachment
- GET /api/comments/{pin_id}

### Admin
- GET /api/admin/stats
- GET /api/admin/guests
- GET /api/superadmin/teams
- GET /api/superadmin/users
- GET /api/superadmin/stats

## Database Schema

### users
```json
{
  "id": "uuid",
  "email": "string",
  "password_hash": "string",
  "name": "string",
  "role": "owner|member",
  "team_id": "uuid",
  "created_at": "datetime"
}
```

### projects
```json
{
  "id": "uuid",
  "name": "string",
  "team_id": "uuid",
  "type": "url|image|pdf",
  "content_url": "string|null",
  "file_path": "string|null",
  "created_by": "uuid",
  "created_at": "datetime"
}
```

### pins
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "x": "float (0-100%)",
  "y": "float (0-100%)",
  "status": "open|resolved",
  "created_by": "uuid",
  "created_at": "datetime"
}
```

## Test Credentials
- **User**: test@example.com / test123
- **Super Admin**: admin@markuply.com / admin123

## Known Limitations
1. **Cloudflare-protected sites** may block the proxy due to bot detection
2. Sites with strict CSP may have broken JavaScript
3. Some complex SPAs may not work perfectly through proxy
4. Stripe payment integration not implemented (MOCKED)

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- [ ] Shareable project links for guest review
- [ ] Real-time collaboration (WebSocket)
- [ ] Email notifications (integrate with SendGrid/Resend)

### P2 - Medium Priority
- [ ] Stripe payment integration
- [ ] Enforce plan limits (member count, storage)
- [ ] Advanced annotation tools (arrows, rectangles)

### P3 - Low Priority
- [ ] Export comments as PDF
- [ ] Bulk pin management
- [ ] Comment mentions (@user)

## Architecture Notes

### Reverse Proxy Flow
1. User creates project with target URL
2. Frontend generates proxy URL: `/api/proxy?url=<encoded_url>`
3. Backend fetches page via httpx with browser-like headers
4. BeautifulSoup parses HTML and rewrites all URLs
5. Security headers stripped from response
6. Annotation script injected into body
7. Modified HTML served from app domain
8. Navigation within iframe stays on app domain
9. Pins persist across page navigations
