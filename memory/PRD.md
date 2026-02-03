# Markuply - Visual Markup and Review SaaS

## Original Problem Statement
Build a SaaS web application called "Markuply" for visual markup and review. Users (Owners, Team Members, and Guests) should be able to leave pin-based comments on live website URLs, PDFs, and images.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT-based
- **Reverse Proxy**: Playwright + BeautifulSoup (HTML rewriting, Cloudflare bypass)

## What's Been Implemented

### Core Features ✅
1. **Reverse Proxy with Cloudflare Bypass** - Playwright renders pages, BeautifulSoup rewrites URLs
2. **Pin-based Commenting** - Click to create pins, threaded comments with optimistic UI
3. **Sidebar always visible** - Comments panel stays mounted in all modes
4. **Scrolling in both modes** - Proxy overlay allows scroll passthrough
5. **Page URL grouping** - Comments organized by URL with filter dropdown
6. **User mentions** - @ symbol triggers user suggestions
7. **Guest comments** - Name/email dialog for non-authenticated users

### NEW Features (Feb 3, 2026) ✅
1. **Pin Hover Preview Box**
   - Hovering over a pin shows a floating preview box
   - Displays comment text, author name, and comment count
   - Contains "View Thread" and "Resolve" buttons
   - Clicking "Resolve" marks the pin as resolved directly from the preview
   
2. **Auto-generated Website Thumbnails**
   - URL projects automatically capture hero section screenshots
   - Background task generates thumbnails after project creation
   - Dashboard displays thumbnails instead of placeholder icons
   - Refresh button available on hover to regenerate thumbnail
   - Thumbnails stored persistently in uploads/screenshots/

### API Endpoints
- GET/POST /api/proxy?url=<encoded_url> - Reverse proxy with Playwright
- POST /api/pins - Create pin with page_url, scroll_x, scroll_y
- PUT /api/pins/{pin_id}/status - Update pin status (open/resolved)
- GET /api/pins/{project_id}?page_url=<url> - Filter pins by page
- GET /api/projects/{id}/pages - Get unique page URLs
- GET /api/projects/{id}/users - Get team + guest commenters
- POST /api/projects/{id}/refresh-thumbnail - Regenerate thumbnail on demand

## Test Credentials
- **User**: testuser_1770157573@example.com / password123
- **Super Admin**: admin@markuply.com / admin123

## Project Structure
```
/app/
├── backend/
│   ├── server.py        # All API routes + Playwright proxy
│   ├── .env             # MongoDB connection, JWT secret
│   └── uploads/         # Screenshots and thumbnails
└── frontend/
    └── src/
        ├── pages/
        │   ├── ProjectCanvas.js  # Pin hover preview implementation
        │   ├── Dashboard.js      # Thumbnail display + refresh
        │   └── ...
        └── context/
            └── AuthContext.js    # localStorage key: 'token'
```

## Pending/Future Tasks
1. **P1**: Shareable links for projects to enable guest workflow
2. **P1**: Email notifications for comment replies and mentions
3. **P2**: Stripe subscription integration
4. **P2**: Plan-based limits enforcement (team members, storage)
5. **P3**: Advanced annotation tools (arrows, text boxes)
6. **P3**: Refactor server.py into separate route files

## Known Limitations
1. Complex SPAs may have JavaScript issues through proxy
2. Some interactive elements may not work perfectly
3. Stripe payment integration not implemented (placeholder)
