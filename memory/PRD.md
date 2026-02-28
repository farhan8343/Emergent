# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, html2canvas
- **Backend**: FastAPI, Python, Playwright (reverse proxy)
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based

## What's Been Implemented

### Core Features ✅
1. **Reverse Proxy with Cloudflare Bypass** - Playwright renders pages, BeautifulSoup rewrites URLs
2. **Pin-based Commenting** - Click to create pins, threaded comments with optimistic UI
3. **Sidebar always visible** - Comments panel stays mounted in all modes
4. **Scrolling in both modes** - Proxy overlay allows scroll passthrough
5. **Page URL grouping** - Comments organized by URL with filter dropdown
6. **User mentions** - @ symbol triggers user suggestions
7. **Guest comments** - Name/email dialog for non-authenticated users
8. **Pin Hover Preview** - Floating box with comment preview and Resolve button

### Bug Fixes (Feb 28, 2026) ✅
1. **Playwright Browser Path Error**
   - Added auto-symlink creation on backend startup
   - Dynamically detects installed browser versions
   - No longer requires manual symlink creation

2. **Pin Scroll Lag Fixed**
   - Changed from interval-based to requestAnimationFrame polling
   - Uses CSS transforms for GPU-accelerated positioning
   - Only updates state when scroll position changes

3. **Screenshot on Pin Creation**
   - New endpoint: POST /api/pins/with-screenshot
   - Captures visible viewport using html2canvas
   - Stores screenshot alongside pin for context

4. **Auto-generated Website Thumbnails**
   - Background task generates thumbnails on project creation
   - Dashboard displays real website screenshots
   - Refresh button available to regenerate

### API Endpoints
- GET/POST /api/proxy?url=<encoded_url> - Reverse proxy with Playwright
- POST /api/pins - Create pin (basic)
- POST /api/pins/with-screenshot - Create pin with viewport screenshot
- PUT /api/pins/{pin_id}/status - Update pin status (open/resolved)
- POST /api/projects/{id}/refresh-thumbnail - Regenerate thumbnail
- GET /api/projects/{id}/pages - Get unique page URLs

## Project Structure
```
/app/
├── backend/
│   ├── server.py        # All routes + Playwright proxy + auto-symlink
│   ├── .env             # MongoDB connection, JWT secret
│   └── uploads/         # Screenshots and thumbnails
└── frontend/
    └── src/
        ├── pages/
        │   ├── ProjectCanvas.js  # Pin hover, screenshot capture
        │   └── Dashboard.js      # Thumbnail display
        └── context/
            └── AuthContext.js    # localStorage key: 'token'
```

## Pending/Future Tasks
1. **P1**: Shareable links for guest workflow
2. **P1**: Email notifications for replies/mentions
3. **P2**: Stripe subscription integration
4. **P2**: Plan-based limits enforcement
5. **P3**: Advanced annotation tools (arrows, text boxes)

## Known Limitations
1. Complex SPAs may have JavaScript issues through proxy
2. Some interactive elements may not work perfectly
3. Stripe payment integration not implemented (placeholder)
