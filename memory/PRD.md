# Markuply - Visual Markup and Review SaaS

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python, Playwright (reverse proxy)
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based

## What's Been Implemented

### Core Features ✅
1. **Reverse Proxy with Cloudflare Bypass** - Playwright renders pages with stealth settings
2. **Pin-based Commenting** - Click to create pins, instant creation
3. **Sidebar on LEFT** - Comments panel on left side
4. **Guest Access** - Full viewing without login, popup only when adding pin/comment
5. **Screenshot on Pin Creation** - Background task captures viewport
6. **Pause Comments** - Host can pause new comments for guests
7. **Page-specific Pins** - Only show pins for current page on canvas
8. **Pin Navigation** - Click pin in list to navigate to page and scroll position
9. **Loading Indicators** - Show loading when navigating within proxy
10. **View Screenshot Lightbox** - Click "View Screenshot" to open fullscreen

### Recent Fixes (Mar 1, 2026) ✅
1. Guest redirect fixed - no longer redirects to homepage
2. File attachment error fixed - background screenshot generation
3. Sidebar moved to LEFT side
4. Pin creation is instant (screenshot in background)
5. "View Screenshot" link opens lightbox
6. Pause/Resume comments toggle for hosts
7. Loading overlay when navigating pages
8. Page URL tracking for page-specific pins

### API Endpoints

#### Public Endpoints (No Auth)
- GET /api/projects/{id}/public
- GET /api/projects/{id}/pins/public
- POST /api/pins/guest

#### Protected Endpoints
- POST /api/pins - Create pin with background screenshot
- POST /api/projects/{id}/toggle-comments - Pause/resume comments

## Guest Flow
1. Guest accesses share link → Project loads immediately
2. Guest can browse freely, scroll, switch modes
3. Guest clicks to add pin → "Join the conversation" dialog
4. Guest provides name + email (stored in localStorage)
5. Guest creates pin (instant) → Screenshot captured in background

## Pending Tasks
1. Email notifications for replies/mentions
2. Stripe subscription integration
