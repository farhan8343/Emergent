# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images. The application must include a subscription system with different plans (Starter, Pro, Business) that limit team members and storage. An admin dashboard is required for the account owner to manage users, subscriptions, and view usage statistics.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based

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
- [x] **Live website preview via iframe** (no screenshots needed)
- [x] Responsive viewport controls (Desktop/Tablet/Mobile)
- [x] Project search and sorting (newest, oldest, name)

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

## What's Been Implemented (as of Jan 25, 2026)

### Phase 1: Core Infrastructure ✅
- FastAPI backend with all routes prefixed /api
- MongoDB integration with Motor async driver
- JWT authentication system
- React frontend with Shadcn UI components
- File upload and serving system

### Phase 2: Live Website Preview ✅
- **Iframe-based live website embedding**
- Responsive viewport controls (Desktop 100%, Tablet 768px, Mobile 375px)
- Transparent overlay for pin placement in Comment mode
- Error detection for sites that block embedding
- "Open in New Tab" fallback for blocked sites

### Phase 3: Pin-Based Comments ✅
- Pin creation by clicking on live preview
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

## API Endpoints

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

### teams
```json
{
  "id": "uuid",
  "name": "string",
  "plan": "starter|pro|business|enterprise",
  "owner_id": "uuid",
  "member_count": "int",
  "storage_used_mb": "float",
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

### comments
```json
{
  "id": "uuid",
  "pin_id": "uuid",
  "author_type": "team|guest",
  "author_id": "uuid|null",
  "author_name": "string",
  "guest_email": "string|null",
  "content": "string",
  "attachment_path": "string|null",
  "created_at": "datetime"
}
```

## Test Credentials
- Email: test@example.com
- Password: test123

## Known Limitations
1. **Sites blocking iframes**: Many websites (including brandlume.com) block embedding via X-Frame-Options or CSP headers. These sites show an error message with "Open in New Tab" option.
2. Stripe payment integration not implemented (MOCKED)
3. Email notifications log to console only (MOCKED)
4. Plan limits enforced but not strictly validated

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
- [ ] Project versioning/history

### P3 - Low Priority
- [ ] Export comments as PDF
- [ ] Bulk pin management
- [ ] Comment mentions (@user)
- [ ] Keyboard shortcuts

## Architecture Notes

### Live Website Preview Flow
1. User creates project with URL
2. User opens project canvas
3. Iframe loads the live website directly
4. In Comment mode, transparent overlay captures clicks
5. Pin positions stored as percentage of canvas dimensions

### Important Security Note
The iframe uses `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` to allow website functionality while maintaining security.

### Pin Position Calculation
- Pins stored as percentage (0-100%) of canvas dimensions
- Position calculated relative to canvas element bounding box
- Pins render as absolute positioned elements over the iframe
