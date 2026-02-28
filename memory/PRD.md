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
3. **Sidebar on LEFT** - Comments panel moved to left side
4. **Guest Access** - Full viewing without login, popup only when adding pin/comment
5. **Instant Pin Creation** - Pin appears immediately, screenshot captured in background
6. **Auto Screenshot Capture** - Server-side Playwright captures viewport on pin creation
7. **User Mentions** - @ symbol triggers suggestions
8. **Pin Hover Preview** - Floating box to LEFT of pin with View Thread / Resolve buttons

### Bug Fixes (Feb 28, 2026) ✅
1. **Guest Link Access** - No redirect to login, full viewing allowed
2. **Login Popup Only When Needed** - Only appears when trying to add pin/comment
3. **Guest Info Stored** - Saved in localStorage for future visits
4. **Sidebar Moved to LEFT** - Complete restructure of layout
5. **Instant Pin Creation** - No blocking, async screenshot generation
6. **Screenshot Attached to Pin** - Background task saves screenshot path to pin record
7. **Thumbnail for Cloudflare Sites** - Stealth Playwright with custom headers

### Guest Flow
1. Guest accesses share link: `/project/{id}` → Project loads immediately
2. Guest can browse freely, scroll, switch modes
3. Guest clicks to add pin → "Join the conversation" dialog appears
4. Guest provides name + email (stored in localStorage)
5. Guest creates pin (instant) → Screenshot captured in background
6. Guest can add comments

### API Endpoints

#### Public Endpoints (No Auth Required)
- GET /api/projects/{id}/public - Project details for guests
- GET /api/projects/{id}/pins/public - Pins for guests
- POST /api/pins/guest - Create pin as guest

#### Protected Endpoints
- POST /api/pins - Create pin with background screenshot
- PUT /api/pins/{pin_id}/status - Update pin status

## Project Structure
```
/app/
├── backend/
│   ├── server.py        # All routes + Playwright proxy
│   └── uploads/         # Screenshots and thumbnails
└── frontend/
    └── src/
        ├── App.js       # Routes - /project/:id is PUBLIC
        ├── pages/
        │   └── ProjectCanvas.js - Sidebar LEFT, instant pin creation
        └── context/
            └── AuthContext.js
```

## Pending/Future Tasks
1. **P1**: Email notifications for replies/mentions
2. **P2**: Stripe subscription integration
3. **P2**: Plan-based limits enforcement
4. **P3**: Advanced annotation tools
