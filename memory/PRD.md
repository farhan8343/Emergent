# Markuply - Visual Markup & Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users can leave pin-based comments on live websites, PDFs, and images. The app includes a subscription system and an admin dashboard. The core architecture uses a server-side reverse proxy (Playwright) to load third-party websites within the application, bypassing security measures like Cloudflare.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + dayjs, port 3000
- **Backend**: FastAPI + Motor (async MongoDB) + Playwright + Pillow, port 8001
- **Database**: MongoDB (markuply_db)
- **Core Feature**: Playwright-based reverse proxy for loading external websites in iframe

## Key Files
- `/app/backend/server.py` - Monolithic backend (1950+ lines)
- `/app/frontend/src/pages/ProjectCanvas.js` - Main review UI (1730+ lines)
- `/app/frontend/src/pages/Dashboard.js` - Project dashboard
- `/app/frontend/src/App.js` - Routing (guest-friendly)

## Credentials
- Super Admin: admin@markuply.com / admin123
- Guest: No credentials, visit /project/:id directly

## What's Been Implemented
- User auth (register/login/JWT)
- Team management with plan-based limits
- Project creation (URL, image, PDF types)
- Playwright reverse proxy for external websites
- Pin-based commenting system with optimistic UI
- **Delete pin feature** (with cascade delete of comments)
- Guest access via public share links (no login required)
- Screenshot on pin creation (background task, Pillow pin marker, device-width matching)
- Screenshot loading state (spinner → View Screenshot button)
- File attachments on comments
- Device-specific pin visibility (desktop/tablet/mobile)
- Page-specific pin filtering
- Comments sidebar on LEFT with 100vh layout, scrollable list, sticky input
- Relative dates throughout (dayjs fromNow)
- Smaller pin number badges
- Dashboard with relative dates, comment counts, activity indicators
- Pause/resume comments for project owners
- Pin hover preview boxes
- Screenshot lightbox
- Guest projects page
- Improved proxy (lazy-loading, data-src, iframe support, CSP removal, longer JS wait)

## Recent Changes (March 10, 2026 - Session 2)
1. Added delete pin feature (DELETE /api/pins/{pin_id})
2. Cleared all old test pins/comments
3. Screenshot viewport matches device type (desktop=1920, tablet=768, mobile=375)
4. View Screenshot button with loading spinner while generating
5. Relative dates on comments (dayjs fromNow)
6. Smaller pin number badges (w-6 h-6)
7. Sidebar layout: 100vh, scrollable list, sticky Add Comment input
8. Replaced ScrollArea with native overflow-y-auto (fixes scroll lag)
9. Improved proxy for iframes/carousels (data-src, lazy loading, CSP removal, longer wait)

## Previous Session Fixes (March 10, 2026 - Session 1)
1. Stray </Button> tag causing complete frontend render failure
2. responsiveView undefined → viewportSize
3. Synchronous screenshot in comment creation removed
4. Pin screenshots with Pillow pin markers
5. Guest access with auth→public fallback
6. Proxy script passes actualUrl for page tracking

## Remaining Tasks
- [ ] P2: Super Admin dashboard - replace static data with real MongoDB aggregations
- [ ] P2: Refactor server.py into modules
- [ ] P2: Refactor ProjectCanvas.js into smaller components

## Future/Backlog
- [ ] Real-time updates (WebSockets)
- [ ] Email notifications for replies/mentions
- [ ] Stripe subscription & payment system
- [ ] Plan-based limits enforcement
- [ ] Advanced annotation tools (arrows, text boxes)
