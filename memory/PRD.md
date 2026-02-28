# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python, Playwright (reverse proxy)
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based

## What's Been Implemented

### Core Features ✅
1. **Reverse Proxy with Cloudflare Bypass** - Playwright renders pages with stealth settings
2. **Pin-based Commenting** - Click to create pins, threaded comments
3. **Sidebar always visible** - Comments panel stays mounted
4. **Scrolling in both modes** - Wheel events forwarded to iframe in comment mode
5. **Page URL grouping** - Comments organized by URL with filter
6. **User mentions** - @ symbol triggers suggestions
7. **Pin Hover Preview** - Floating box to LEFT of pin with Resolve button

### Bug Fixes (Feb 28, 2026) ✅
1. **Thumbnail for Cloudflare Sites** - Stealth Playwright with custom headers
2. **Screenshot on Pin Creation** - Server-side capture via background task
3. **Scrolling in Comment Mode** - onWheel handler forwards to iframe
4. **Share Link Guest Access** - Project route is public, no redirect to login
5. **Pin Hover Box** - Positioned LEFT with no gap, hoverable
6. **Guest Pin Creation** - /api/pins/guest endpoint allows guests to add pins

### API Endpoints

#### Public Endpoints (No Auth Required)
- GET /api/projects/{id}/public - Project details for guests
- GET /api/projects/{id}/pins/public - Pins for guests
- GET /api/projects/{id}/comments/public - Comments for guests
- POST /api/pins/guest - Create pin as guest
- GET /api/proxy?url=<encoded_url> - Reverse proxy

#### Protected Endpoints
- POST /api/pins/with-screenshot - Create pin with screenshot
- PUT /api/pins/{pin_id}/status - Update pin status
- POST /api/projects/{id}/refresh-thumbnail - Regenerate thumbnail

## Guest Flow
1. Guest accesses share link: `/project/{id}`
2. Project loads (no login redirect)
3. Guest clicks in Comment mode
4. Dialog appears: "Join the conversation"
5. Guest provides name + email (stored in localStorage)
6. Guest can now create pins and add comments

## Project Structure
```
/app/
├── backend/
│   ├── server.py        # All routes + Playwright proxy
│   ├── tests/           # pytest test files
│   └── uploads/         # Screenshots and thumbnails
└── frontend/
    └── src/
        ├── App.js       # Routes - /project/:id is PUBLIC
        ├── pages/
        │   ├── ProjectCanvas.js
        │   └── Dashboard.js
        └── context/
            └── AuthContext.js
```

## Pending/Future Tasks
1. **P1**: Email notifications for replies/mentions
2. **P2**: Stripe subscription integration
3. **P2**: Plan-based limits enforcement
4. **P3**: Advanced annotation tools (arrows, text boxes)
