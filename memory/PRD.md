# Markuply - Visual Markup & Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users can leave pin-based comments on live websites, PDFs, and images. The app includes a subscription system and an admin dashboard. Core architecture: server-side reverse proxy (Playwright) to load third-party websites.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + dayjs, port 3000
- **Backend**: FastAPI + Motor (async MongoDB) + Playwright + Pillow, port 8001
- **Database**: MongoDB (markuply_db)

## Key Files
- `/app/backend/server.py` - Monolithic backend (2000+ lines)
- `/app/frontend/src/pages/ProjectCanvas.js` - Main review UI (1850+ lines)
- `/app/frontend/src/pages/Dashboard.js` - Project dashboard
- `/app/frontend/src/components/Navbar.js` - Navigation with dynamic guest support

## Credentials
- Super Admin: admin@markuply.com / admin123
- Guest: No credentials, visit /project/:id directly

## What's Been Implemented
### Core Features
- User auth (register/login/JWT)
- Team management with plan-based limits
- Project creation (URL, image, PDF types)
- Playwright reverse proxy for external websites
- Pin-based commenting system with optimistic UI
- Delete pin feature (cascade deletes comments)
- Guest access via public share links
- Screenshot on pin creation (background task, Pillow pin marker, canvas-width matching)
- File attachments on comments

### UI/UX
- Comments sidebar on LEFT (20rem/320px wide)
- 100vh sidebar with scrollable comment list and sticky input
- Relative dates throughout (dayjs fromNow)
- Smaller pin number badges
- Member avatars in header with 2-letter initials + hover for full name
- @mention system works with all commenters (team + guests)
- Pin link sharing via URL query param (?pin=xxx)
- Screenshot loading state (Capturing... spinner → View Screenshot)
- Device-specific pin visibility (desktop/tablet/mobile)
- Guest header updates dynamically without refresh
- Optimized scroll performance (CSS containment)
- Improved proxy (lazy-loading, data-src, iframe support, CSP removal, scroll animations)

## Session 3 Changes (March 10, 2026)
1. @mention fixed - builds user list from all commenters not just team members
2. Member avatars in header bar near device controls
3. Sidebar reduced from 24rem to 20rem
4. Scroll performance improved with CSS containment
5. Screenshot captures at actual canvas viewport width
6. Screenshot polling fixed - persists and updates correctly
7. Pin link sharing via ?pin=xxx URL parameter
8. Guest header updates dynamically after popup login
9. Proxy improved for scroll animations and lazy loading
10. GuestPinCreate model fixed (canvas_width/canvas_height)

## Remaining Tasks
- [ ] P2: Super Admin dashboard - replace MOCKED static data with real MongoDB aggregations
- [ ] P2: Refactor server.py into modules
- [ ] P2: Refactor ProjectCanvas.js into smaller components

## Future/Backlog
- [ ] Real-time updates (WebSockets)
- [ ] Email notifications for replies/mentions
- [ ] Stripe subscription & payment system
- [ ] Plan-based limits enforcement
- [ ] Advanced annotation tools (arrows, text boxes)
