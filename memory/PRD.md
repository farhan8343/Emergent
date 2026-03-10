# Markuply - Visual Markup & Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users can leave pin-based comments on live websites, PDFs, and images. The app includes a subscription system and an admin dashboard. The core architecture uses a server-side reverse proxy (Playwright) to load third-party websites within the application, bypassing security measures like Cloudflare.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI, port 3000
- **Backend**: FastAPI + Motor (async MongoDB) + Playwright, port 8001
- **Database**: MongoDB (markuply_db)
- **Core Feature**: Playwright-based reverse proxy for loading external websites in iframe

## Key Files
- `/app/backend/server.py` - Monolithic backend (1850+ lines)
- `/app/frontend/src/pages/ProjectCanvas.js` - Main review UI (1650+ lines)
- `/app/frontend/src/pages/Dashboard.js` - Project dashboard
- `/app/frontend/src/App.js` - Routing (guest-friendly)
- `/app/frontend/src/components/Navbar.js` - Navigation with guest support

## Credentials
- Super Admin: admin@markuply.com / admin123
- Guest: No credentials, visit /project/:id directly

## What's Been Implemented
- User auth (register/login/JWT)
- Team management with plan-based limits
- Project creation (URL, image, PDF types)
- Playwright reverse proxy for external websites
- Pin-based commenting system
- Guest access via public share links
- Screenshot on pin creation (background task with Pillow marker)
- File attachments on comments
- Device-specific pin visibility (desktop/tablet/mobile)
- Page-specific pin filtering
- Comments sidebar on the LEFT
- Optimistic UI for pin/comment creation
- Relative dates on dashboard
- Project stats (comment counts, activity indicators)
- Pause/resume comments for project owners
- Pin hover preview boxes
- Screenshot lightbox
- Admin panel & Super Admin dashboard
- Guest projects page

## P0 Bugs Fixed (March 10, 2026)
1. Stray `</Button>` tag causing complete frontend render failure
2. `responsiveView` undefined variable → fixed to `viewportSize`
3. Synchronous screenshot in comment creation removed (was blocking)
4. Pin screenshots now include Pillow-drawn pin markers
5. Guest access improved with auth→public fallback
6. Proxy script now passes actualUrl for page tracking

## Remaining P1/P2 Tasks
- [ ] P2: Super Admin dashboard - replace static data with real MongoDB aggregations
- [ ] P2: Refactor server.py into modules (routes, models, proxy)
- [ ] P2: Refactor ProjectCanvas.js into smaller components

## Future/Backlog
- [ ] Real-time updates (WebSockets)
- [ ] Email notifications for replies/mentions
- [ ] Stripe subscription & payment system
- [ ] Plan-based limits enforcement
- [ ] Advanced annotation tools (arrows, text boxes)
