# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based
- **Reverse Proxy**: Playwright + BeautifulSoup (HTML rewriting, Cloudflare bypass)

## What's Been Implemented (as of Feb 2, 2026)

### Reverse Proxy with Cloudflare Bypass ✅
- Server-side website proxy using **Playwright** (handles Cloudflare/bot protection)
- HTML parsing and URL rewriting using BeautifulSoup
- Security headers stripped for seamless iframe embedding
- Annotation script injection
- All assets (CSS, JS, images) proxied correctly

### Fixed Issues ✅
1. **Sidebar always visible** - Comments panel stays mounted when switching modes
2. **Cloudflare sites work** - Playwright renders pages like a real browser
3. **Scrolling in both modes** - Main content scrollable, overlay only intercepts clicks
4. **Optimistic UI updates** - Comments appear immediately, server sync in background
5. **Page URL grouping** - Comments organized by URL with filter dropdown
6. **User mentions** - @ symbol triggers user suggestions
7. **Guest comments** - Name/email dialog for non-authenticated users

### API Endpoints
- GET/POST /api/proxy?url=<encoded_url> - Reverse proxy with Playwright
- POST /api/pins - Create pin with page_url, scroll_x, scroll_y
- GET /api/pins/{project_id}?page_url=<url> - Filter pins by page
- GET /api/projects/{id}/pages - Get unique page URLs
- GET /api/projects/{id}/users - Get team + guest commenters

## Test Credentials
- **User**: test@example.com / test123
- **Super Admin**: admin@markuply.com / admin123

## Known Limitations
1. Very complex SPAs may have JavaScript issues through proxy
2. Some interactive elements may not work perfectly
3. Stripe payment integration not implemented (MOCKED)
