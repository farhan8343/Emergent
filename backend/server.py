from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import aiofiles
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, quote, unquote
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Set Playwright browsers path before importing playwright
PLAYWRIGHT_PATH = os.environ.get('PLAYWRIGHT_BROWSERS_PATH', '/pw-browsers')
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = PLAYWRIGHT_PATH

# Fix Playwright browser symlinks on startup
def setup_playwright_browsers():
    """Create symlinks for Playwright browser versions to handle version mismatches"""
    pw_path = Path(PLAYWRIGHT_PATH)
    if not pw_path.exists():
        return
    
    # Find actual chromium directory
    actual_chromium = None
    for item in pw_path.iterdir():
        if item.is_dir() and 'chromium' in item.name and not item.is_symlink():
            actual_chromium = item
            break
    
    if not actual_chromium:
        return
    
    # Create symlinks for common version variations
    versions_to_link = [
        'chromium_headless_shell-1200',
        'chromium_headless_shell-1208',
        'chromium-1200',
        'chromium-1208',
    ]
    
    for version in versions_to_link:
        symlink_path = pw_path / version
        if not symlink_path.exists():
            try:
                symlink_path.symlink_to(actual_chromium.name)
            except Exception:
                pass

# Run browser setup
setup_playwright_browsers()

from playwright.async_api import async_playwright
from PIL import Image
import io

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

PLANS = {
    'starter': {'member_limit': 5, 'storage_limit_mb': 1000},
    'pro': {'member_limit': 10, 'storage_limit_mb': 5000},
    'business': {'member_limit': 50, 'storage_limit_mb': 20000},
    'enterprise': {'member_limit': 999, 'storage_limit_mb': 100000}
}

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / 'projects').mkdir(exist_ok=True)
(UPLOAD_DIR / 'attachments').mkdir(exist_ok=True)
(UPLOAD_DIR / 'screenshots').mkdir(exist_ok=True)

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    team_id: Optional[str] = None
    created_at: str

class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    plan: str
    owner_id: str
    member_count: int
    member_limit: int
    storage_used_mb: float
    storage_limit_mb: int
    created_at: str

class ProjectCreate(BaseModel):
    name: str
    type: str
    content_url: Optional[str] = None

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    team_id: str
    type: str
    content_url: Optional[str] = None
    file_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    screenshot_path: Optional[str] = None
    created_by: str
    created_at: str

class PinCreate(BaseModel):
    project_id: str
    x: float
    y: float
    page_url: Optional[str] = None
    scroll_x: Optional[float] = 0
    scroll_y: Optional[float] = 0

class Pin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    x: float
    y: float
    page_url: Optional[str] = None
    scroll_x: Optional[float] = 0
    scroll_y: Optional[float] = 0
    status: str
    screenshot_path: Optional[str] = None
    created_by: str
    created_at: str

class CommentCreate(BaseModel):
    pin_id: str
    content: str
    guest_name: Optional[str] = None
    guest_email: Optional[EmailStr] = None

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    pin_id: str
    author_type: str
    author_id: Optional[str] = None
    author_name: str
    guest_email: Optional[str] = None
    content: str
    attachment_path: Optional[str] = None
    screenshot_path: Optional[str] = None
    created_at: str

class InviteCreate(BaseModel):
    email: EmailStr

class UsageStats(BaseModel):
    total_projects: int
    total_pins: int
    total_comments: int
    storage_used_mb: float
    team_members: int
    guest_commenters: int

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {'user_id': user_id, 'exp': expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

async def send_email(to_email: str, subject: str, body: str):
    try:
        logger.info(f"Email to {to_email}: {subject}\n{body}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

async def capture_screenshot(url: str, pin_x: float, pin_y: float) -> Optional[str]:
    """Capture screenshot of page with pin location marked"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
            await page.goto(url, wait_until='networkidle', timeout=30000)
            
            screenshot_bytes = await page.screenshot(full_page=True)
            await browser.close()
            
            img = Image.open(io.BytesIO(screenshot_bytes))
            from PIL import ImageDraw
            draw = ImageDraw.Draw(img)
            
            x_pos = int((pin_x / 100) * img.width)
            y_pos = int((pin_y / 100) * img.height)
            
            radius = 20
            draw.ellipse(
                [(x_pos - radius, y_pos - radius), (x_pos + radius, y_pos + radius)],
                outline='red',
                width=3
            )
            
            screenshot_filename = f"{uuid.uuid4()}.png"
            screenshot_path = UPLOAD_DIR / 'screenshots' / screenshot_filename
            img.save(screenshot_path, 'PNG', quality=85)
            
            return f"uploads/screenshots/{screenshot_filename}"
    except Exception as e:
        logger.error(f"Failed to capture screenshot: {e}")
        return None

async def generate_project_thumbnail(url: str) -> Optional[str]:
    """Generate thumbnail for project - handles Cloudflare protected sites"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            )
            context = await browser.new_context(
                viewport={'width': 1200, 'height': 800},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                extra_http_headers={
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            )
            page = await context.new_page()
            
            # Add stealth script to avoid detection
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            """)
            
            try:
                await page.goto(url, wait_until='networkidle', timeout=45000)
            except Exception:
                # If networkidle times out, try with domcontentloaded
                await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                await page.wait_for_timeout(3000)  # Wait a bit more for content
            
            screenshot_bytes = await page.screenshot()
            await browser.close()
            
            img = Image.open(io.BytesIO(screenshot_bytes))
            img.thumbnail((400, 300))
            
            thumbnail_filename = f"{uuid.uuid4()}_thumb.png"
            thumbnail_path = UPLOAD_DIR / 'screenshots' / thumbnail_filename
            img.save(thumbnail_path, 'PNG', quality=70)
            
            return f"uploads/screenshots/{thumbnail_filename}"
    except Exception as e:
        logger.error(f"Failed to generate thumbnail: {e}")
        return None

async def capture_viewport_screenshot(url: str) -> Optional[str]:
    """Capture visible viewport screenshot for canvas display"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
            await page.goto(url, wait_until='networkidle', timeout=30000)
            # Capture only visible viewport, not full page
            screenshot_bytes = await page.screenshot(full_page=False)
            await browser.close()
            
            screenshot_filename = f"{uuid.uuid4()}_viewport.png"
            screenshot_path = UPLOAD_DIR / 'screenshots' / screenshot_filename
            
            async with aiofiles.open(screenshot_path, 'wb') as f:
                await f.write(screenshot_bytes)
            
            return f"uploads/screenshots/{screenshot_filename}"
    except Exception as e:
        logger.error(f"Failed to capture viewport screenshot: {e}")
        return None

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user_id = str(uuid.uuid4())
    password_hash = hash_password(user_data.password)
    
    team_id = str(uuid.uuid4())
    team = {
        'id': team_id,
        'name': f"{user_data.name}'s Team",
        'plan': 'starter',
        'owner_id': user_id,
        'member_count': 1,
        'storage_used_mb': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.teams.insert_one(team)
    
    user = {
        'id': user_id,
        'email': user_data.email,
        'password_hash': password_hash,
        'name': user_data.name,
        'role': 'owner',
        'team_id': team_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id)
    return {'token': token, 'user': User(**{k: v for k, v in user.items() if k != 'password_hash'})}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_token(user['id'])
    return {'token': token, 'user': User(**{k: v for k, v in user.items() if k != 'password_hash'})}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

# Team Routes
@api_router.get("/teams/me", response_model=Team)
async def get_my_team(current_user: dict = Depends(get_current_user)):
    team = await db.teams.find_one({'id': current_user['team_id']}, {'_id': 0})
    if not team:
        raise HTTPException(status_code=404, detail='Team not found')
    
    plan_limits = PLANS[team['plan']]
    team['member_limit'] = plan_limits['member_limit']
    team['storage_limit_mb'] = plan_limits['storage_limit_mb']
    return Team(**team)

@api_router.put("/teams/plan")
async def update_plan(plan: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'owner':
        raise HTTPException(status_code=403, detail='Only owners can change plans')
    
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail='Invalid plan')
    
    await db.teams.update_one(
        {'id': current_user['team_id']},
        {'$set': {'plan': plan}}
    )
    return {'message': 'Plan updated successfully'}

@api_router.post("/teams/invite")
async def invite_member(invite: InviteCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'owner':
        raise HTTPException(status_code=403, detail='Only owners can invite members')
    
    team = await db.teams.find_one({'id': current_user['team_id']}, {'_id': 0})
    if not team:
        raise HTTPException(status_code=404, detail='Team not found')
    
    plan_limits = PLANS[team['plan']]
    if team['member_count'] >= plan_limits['member_limit']:
        raise HTTPException(status_code=400, detail='Member limit reached. Please upgrade your plan.')
    
    invitation = {
        'id': str(uuid.uuid4()),
        'email': invite.email,
        'team_id': current_user['team_id'],
        'token': str(uuid.uuid4()),
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.invitations.insert_one(invitation)
    
    await send_email(
        invite.email,
        'Invitation to join Markuply team',
        f"You've been invited to join a team on Markuply. Click here to accept: {os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/invite/{invitation['token']}"
    )
    
    return {'message': 'Invitation sent successfully'}

@api_router.get("/teams/members")
async def get_team_members(current_user: dict = Depends(get_current_user)):
    members = await db.users.find(
        {'team_id': current_user['team_id']},
        {'_id': 0, 'password_hash': 0}
    ).to_list(100)
    return members

@api_router.delete("/teams/members/{member_id}")
async def remove_member(member_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'owner':
        raise HTTPException(status_code=403, detail='Only owners can remove members')
    
    if member_id == current_user['id']:
        raise HTTPException(status_code=400, detail='Cannot remove yourself')
    
    result = await db.users.delete_one({'id': member_id, 'team_id': current_user['team_id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Member not found')
    
    await db.teams.update_one(
        {'id': current_user['team_id']},
        {'$inc': {'member_count': -1}}
    )
    
    return {'message': 'Member removed successfully'}

# Project Routes
@api_router.post("/projects", response_model=Project)
async def create_project(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    type: str = Form(...),
    content_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    team = await db.teams.find_one({'id': current_user['team_id']}, {'_id': 0})
    plan_limits = PLANS[team['plan']]
    
    if team['storage_used_mb'] >= plan_limits['storage_limit_mb']:
        raise HTTPException(status_code=400, detail='Storage limit reached. Please upgrade your plan.')
    
    project_id = str(uuid.uuid4())
    file_path = None
    thumbnail_path = None
    screenshot_path = None
    
    if file:
        file_extension = Path(file.filename).suffix
        file_name = f"{project_id}{file_extension}"
        file_path = f"uploads/projects/{file_name}"
        
        async with aiofiles.open(UPLOAD_DIR / 'projects' / file_name, 'wb') as f:
            content = await file.read()
            await f.write(content)
            
            file_size_mb = len(content) / (1024 * 1024)
            await db.teams.update_one(
                {'id': current_user['team_id']},
                {'$inc': {'storage_used_mb': file_size_mb}}
            )
    
    project = {
        'id': project_id,
        'name': name,
        'team_id': current_user['team_id'],
        'type': type,
        'content_url': content_url,
        'file_path': file_path,
        'thumbnail_path': thumbnail_path,
        'screenshot_path': screenshot_path,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project)
    
    # Schedule background thumbnail generation for URL projects
    if type == 'url' and content_url:
        background_tasks.add_task(generate_and_save_thumbnail, project_id, content_url)
    
    return Project(**project)

async def generate_and_save_thumbnail(project_id: str, url: str):
    """Background task to generate and save thumbnail for a project"""
    try:
        thumbnail_path = await generate_project_thumbnail(url)
        if thumbnail_path:
            await db.projects.update_one(
                {'id': project_id},
                {'$set': {'thumbnail_path': thumbnail_path}}
            )
            logger.info(f"Generated thumbnail for project {project_id}")
    except Exception as e:
        logger.error(f"Failed to generate thumbnail for project {project_id}: {e}")

@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find(
        {'team_id': current_user['team_id']},
        {'_id': 0}
    ).to_list(1000)
    return [Project(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return Project(**project)

@api_router.get("/projects/{project_id}/public")
async def get_project_public(project_id: str):
    """Get project details for public/guest access - no authentication required"""
    project = await db.projects.find_one(
        {'id': project_id},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return Project(**project)

@api_router.get("/projects/{project_id}/pins/public")
async def get_project_pins_public(project_id: str, page_url: str = None):
    """Get pins for public/guest access - no authentication required"""
    project = await db.projects.find_one({'id': project_id}, {'_id': 0})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    query = {'project_id': project_id}
    if page_url:
        query['page_url'] = page_url
    
    pins = await db.pins.find(query, {'_id': 0}).to_list(1000)
    return [Pin(**p) for p in pins]

@api_router.get("/projects/{project_id}/comments/public")
async def get_project_comments_public(project_id: str):
    """Get all comments for a project - public access"""
    project = await db.projects.find_one({'id': project_id}, {'_id': 0})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pins = await db.pins.find({'project_id': project_id}, {'_id': 0, 'id': 1}).to_list(1000)
    pin_ids = [p['id'] for p in pins]
    
    comments = await db.comments.find({'pin_id': {'$in': pin_ids}}, {'_id': 0}).to_list(10000)
    return comments

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({'id': project_id, 'team_id': current_user['team_id']}, {'_id': 0})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    if project.get('file_path'):
        file_path = UPLOAD_DIR / project['file_path'].replace('uploads/', '')
        if file_path.exists():
            file_path.unlink()
    
    await db.projects.delete_one({'id': project_id})
    await db.pins.delete_many({'project_id': project_id})
    
    return {'message': 'Project deleted successfully'}

@api_router.post("/projects/{project_id}/refresh-thumbnail")
async def refresh_project_thumbnail(
    project_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Refresh/regenerate thumbnail for a project"""
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    if project['type'] != 'url' or not project.get('content_url'):
        raise HTTPException(status_code=400, detail='Thumbnail generation only available for URL projects')
    
    # Delete old thumbnail if exists
    if project.get('thumbnail_path'):
        old_thumbnail = UPLOAD_DIR / project['thumbnail_path'].replace('uploads/', '')
        if old_thumbnail.exists():
            try:
                old_thumbnail.unlink()
            except Exception:
                pass
    
    # Generate new thumbnail
    thumbnail_path = await generate_project_thumbnail(project['content_url'])
    
    if thumbnail_path:
        await db.projects.update_one(
            {'id': project_id},
            {'$set': {'thumbnail_path': thumbnail_path}}
        )
        return {'thumbnail_path': thumbnail_path, 'success': True}
    
    raise HTTPException(status_code=500, detail='Failed to generate thumbnail')

# Pin Routes
@api_router.post("/pins", response_model=Pin)
async def create_pin(
    pin_data: PinCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one(
        {'id': pin_data.project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pin_id = str(uuid.uuid4())
    pin = {
        'id': pin_id,
        'project_id': pin_data.project_id,
        'x': pin_data.x,
        'y': pin_data.y,
        'page_url': pin_data.page_url or project.get('content_url'),
        'scroll_x': pin_data.scroll_x or 0,
        'scroll_y': pin_data.scroll_y or 0,
        'status': 'open',
        'screenshot_path': None,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.pins.insert_one(pin)
    
    # Generate screenshot in background (non-blocking)
    if project.get('content_url'):
        background_tasks.add_task(
            generate_pin_screenshot,
            pin_id,
            pin_data.page_url or project.get('content_url'),
            pin_data.scroll_y or 0,
            current_user['team_id']
        )
    
    return Pin(**pin)

@api_router.post("/pins/with-screenshot", response_model=Pin)
async def create_pin_with_screenshot(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    page_url: Optional[str] = Form(None),
    scroll_x: Optional[float] = Form(0),
    scroll_y: Optional[float] = Form(0),
    screenshot: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Create a pin with an optional screenshot of the visible viewport"""
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pin_id = str(uuid.uuid4())
    screenshot_path = None
    
    # Save screenshot if provided from client
    if screenshot:
        try:
            screenshot_filename = f"pin_{pin_id}.png"
            screenshot_full_path = UPLOAD_DIR / 'screenshots' / screenshot_filename
            
            async with aiofiles.open(screenshot_full_path, 'wb') as f:
                content = await screenshot.read()
                await f.write(content)
            
            screenshot_path = f"uploads/screenshots/{screenshot_filename}"
            
            # Update storage usage
            file_size_mb = len(content) / (1024 * 1024)
            await db.teams.update_one(
                {'id': current_user['team_id']},
                {'$inc': {'storage_used_mb': file_size_mb}}
            )
        except Exception as e:
            logger.error(f"Failed to save pin screenshot: {e}")
    
    pin = {
        'id': pin_id,
        'project_id': project_id,
        'x': x,
        'y': y,
        'page_url': page_url or project.get('content_url'),
        'scroll_x': scroll_x or 0,
        'scroll_y': scroll_y or 0,
        'status': 'open',
        'screenshot_path': screenshot_path,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.pins.insert_one(pin)
    
    # If no screenshot provided, generate one server-side in background
    if not screenshot_path and project.get('content_url'):
        background_tasks.add_task(
            generate_pin_screenshot, 
            pin_id, 
            page_url or project.get('content_url'),
            scroll_y or 0,
            current_user['team_id']
        )
    
    return Pin(**pin)

async def generate_pin_screenshot(pin_id: str, url: str, scroll_y: float, team_id: str):
    """Background task to capture screenshot for a pin using Playwright"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
            )
            context = await browser.new_context(
                viewport={'width': 1200, 'height': 800},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = await context.new_page()
            
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            """)
            
            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)
            except Exception:
                await page.goto(url, wait_until='domcontentloaded', timeout=20000)
                await page.wait_for_timeout(2000)
            
            # Scroll to the position where pin was created
            if scroll_y > 0:
                await page.evaluate(f'window.scrollTo(0, {scroll_y})')
                await page.wait_for_timeout(500)
            
            screenshot_bytes = await page.screenshot()
            await browser.close()
            
            screenshot_filename = f"pin_{pin_id}.png"
            screenshot_path = UPLOAD_DIR / 'screenshots' / screenshot_filename
            
            async with aiofiles.open(screenshot_path, 'wb') as f:
                await f.write(screenshot_bytes)
            
            # Update pin with screenshot path
            await db.pins.update_one(
                {'id': pin_id},
                {'$set': {'screenshot_path': f"uploads/screenshots/{screenshot_filename}"}}
            )
            
            # Update storage
            file_size_mb = len(screenshot_bytes) / (1024 * 1024)
            await db.teams.update_one(
                {'id': team_id},
                {'$inc': {'storage_used_mb': file_size_mb}}
            )
            
            logger.info(f"Generated screenshot for pin {pin_id}")
    except Exception as e:
        logger.error(f"Failed to generate pin screenshot: {e}")

class GuestPinCreate(BaseModel):
    project_id: str
    x: float
    y: float
    page_url: Optional[str] = None
    scroll_x: Optional[float] = 0
    scroll_y: Optional[float] = 0
    guest_name: str
    guest_email: str

@api_router.post("/pins/guest", response_model=Pin)
async def create_guest_pin(
    background_tasks: BackgroundTasks,
    pin_data: GuestPinCreate
):
    """Create a pin as a guest user"""
    project = await db.projects.find_one({'id': pin_data.project_id}, {'_id': 0})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pin_id = str(uuid.uuid4())
    
    pin = {
        'id': pin_id,
        'project_id': pin_data.project_id,
        'x': pin_data.x,
        'y': pin_data.y,
        'page_url': pin_data.page_url or project.get('content_url'),
        'scroll_x': pin_data.scroll_x or 0,
        'scroll_y': pin_data.scroll_y or 0,
        'status': 'open',
        'screenshot_path': None,
        'created_by': f"guest:{pin_data.guest_email}",
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.pins.insert_one(pin)
    
    # Generate screenshot in background
    if project.get('content_url'):
        background_tasks.add_task(
            generate_pin_screenshot, 
            pin_id, 
            pin_data.page_url or project.get('content_url'),
            pin_data.scroll_y or 0,
            project.get('team_id')
        )
    
    return Pin(**pin)

@api_router.get("/pins/{project_id}", response_model=List[Pin])
async def get_pins(
    project_id: str, 
    page_url: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    query = {'project_id': project_id}
    if page_url:
        query['page_url'] = page_url
    
    pins = await db.pins.find(query, {'_id': 0}).to_list(1000)
    return [Pin(**p) for p in pins]

@api_router.put("/pins/{pin_id}/status")
async def update_pin_status(pin_id: str, new_status: str, current_user: dict = Depends(get_current_user)):
    if new_status not in ['open', 'resolved']:
        raise HTTPException(status_code=400, detail='Invalid status')
    
    result = await db.pins.update_one(
        {'id': pin_id},
        {'$set': {'status': new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Pin not found')
    
    return {'message': 'Pin status updated'}

# Project Pages endpoint - get unique page URLs with comments
@api_router.get("/projects/{project_id}/pages")
async def get_project_pages(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    # Get unique page URLs from pins
    pins = await db.pins.find({'project_id': project_id}, {'_id': 0, 'page_url': 1}).to_list(1000)
    page_urls = list(set(p.get('page_url') for p in pins if p.get('page_url')))
    
    # Include the base project URL
    if project.get('content_url') and project['content_url'] not in page_urls:
        page_urls.insert(0, project['content_url'])
    
    return page_urls

# Project Users endpoint - get all users who have commented or are team members
@api_router.get("/projects/{project_id}/users")
async def get_project_users(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    # Get team members
    team_members = await db.users.find(
        {'team_id': current_user['team_id']},
        {'_id': 0, 'password_hash': 0}
    ).to_list(100)
    
    # Get unique guest commenters on this project's pins
    pins = await db.pins.find({'project_id': project_id}, {'_id': 0, 'id': 1}).to_list(1000)
    pin_ids = [p['id'] for p in pins]
    
    guest_comments = await db.comments.find(
        {'pin_id': {'$in': pin_ids}, 'author_type': 'guest'},
        {'_id': 0, 'author_name': 1, 'guest_email': 1}
    ).to_list(1000)
    
    # Deduplicate guests by email
    guests_map = {}
    for gc in guest_comments:
        email = gc.get('guest_email')
        if email and email not in guests_map:
            guests_map[email] = {
                'id': f'guest_{email}',
                'name': gc.get('author_name', 'Guest'),
                'email': email,
                'role': 'guest'
            }
    
    # Combine team members and guests
    all_users = team_members + list(guests_map.values())
    return all_users

# Comment Routes
@api_router.post("/comments", response_model=Comment)
async def create_comment(
    background_tasks: BackgroundTasks,
    comment_data: CommentCreate,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    # Try to get current user from token
    current_user = None
    if credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            current_user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass
    
    is_guest = current_user is None
    
    if is_guest:
        if not comment_data.guest_name or not comment_data.guest_email:
            raise HTTPException(status_code=400, detail='Guest name and email required')
        author_type = 'guest'
        author_id = None
        author_name = comment_data.guest_name
    else:
        author_type = 'team'
        author_id = current_user['id']
        author_name = current_user['name']
    
    # Get pin and project info for screenshot
    pin = await db.pins.find_one({'id': comment_data.pin_id}, {'_id': 0})
    screenshot_path = None
    
    if pin:
        project = await db.projects.find_one({'id': pin['project_id']}, {'_id': 0})
        if project and project.get('content_url'):
            # Capture screenshot in background
            screenshot_path = await capture_screenshot(
                project['content_url'],
                pin['x'],
                pin['y']
            )
    
    comment = {
        'id': str(uuid.uuid4()),
        'pin_id': comment_data.pin_id,
        'author_type': author_type,
        'author_id': author_id,
        'author_name': author_name,
        'guest_email': comment_data.guest_email if is_guest else None,
        'content': comment_data.content,
        'attachment_path': None,
        'screenshot_path': screenshot_path,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment)
    
    if is_guest:
        pin = await db.pins.find_one({'id': comment_data.pin_id}, {'_id': 0})
        if pin:
            project = await db.projects.find_one({'id': pin['project_id']}, {'_id': 0})
            if project:
                team = await db.teams.find_one({'id': project['team_id']}, {'_id': 0})
                if team:
                    owner = await db.users.find_one({'id': team['owner_id']}, {'_id': 0})
                    if owner:
                        await send_email(
                            owner['email'],
                            f'New comment from {author_name}',
                            f'{author_name} left a comment on {project["name"]}:\n\n{comment_data.content}'
                        )
    
    return Comment(**comment)

@api_router.post("/comments/with-attachment", response_model=Comment)
async def create_comment_with_attachment(
    background_tasks: BackgroundTasks,
    pin_id: str = Form(...),
    content: str = Form(...),
    guest_name: Optional[str] = Form(None),
    guest_email: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    # Try to get current user
    current_user = None
    if credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            current_user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass
    
    is_guest = current_user is None
    
    if is_guest:
        if not guest_name or not guest_email:
            raise HTTPException(status_code=400, detail='Guest name and email required')
        author_type = 'guest'
        author_id = None
        author_name = guest_name
    else:
        author_type = 'team'
        author_id = current_user['id']
        author_name = current_user['name']
    
    # Handle file upload
    attachment_path = None
    if file:
        file_extension = Path(file.filename).suffix
        file_name = f"{uuid.uuid4()}{file_extension}"
        attachment_path = f"uploads/attachments/{file_name}"
        
        async with aiofiles.open(UPLOAD_DIR / 'attachments' / file_name, 'wb') as f:
            file_content = await file.read()
            await f.write(file_content)
            
            # Update storage usage if user is authenticated
            if current_user:
                file_size_mb = len(file_content) / (1024 * 1024)
                await db.teams.update_one(
                    {'id': current_user['team_id']},
                    {'$inc': {'storage_used_mb': file_size_mb}}
                )
    
    # Get pin and project info for background screenshot
    pin = await db.pins.find_one({'id': pin_id}, {'_id': 0})
    
    comment_id = str(uuid.uuid4())
    comment = {
        'id': comment_id,
        'pin_id': pin_id,
        'author_type': author_type,
        'author_id': author_id,
        'author_name': author_name,
        'guest_email': guest_email if is_guest else None,
        'content': content,
        'attachment_path': attachment_path,
        'screenshot_path': None,  # Will be added by background task
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment)
    
    # Generate screenshot in background if pin has project with URL
    if pin:
        project = await db.projects.find_one({'id': pin['project_id']}, {'_id': 0})
        if project and project.get('content_url'):
            background_tasks.add_task(
                generate_comment_screenshot,
                comment_id,
                project['content_url'],
                pin.get('scroll_y', 0)
            )
    
    return Comment(**comment)

async def generate_comment_screenshot(comment_id: str, url: str, scroll_y: float):
    """Background task to capture screenshot for a comment"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
            )
            context = await browser.new_context(
                viewport={'width': 1200, 'height': 800},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = await context.new_page()
            
            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)
            except Exception:
                await page.goto(url, wait_until='domcontentloaded', timeout=20000)
                await page.wait_for_timeout(2000)
            
            if scroll_y > 0:
                await page.evaluate(f'window.scrollTo(0, {scroll_y})')
                await page.wait_for_timeout(500)
            
            screenshot_bytes = await page.screenshot()
            await browser.close()
            
            screenshot_filename = f"comment_{comment_id}.png"
            screenshot_path = UPLOAD_DIR / 'screenshots' / screenshot_filename
            
            async with aiofiles.open(screenshot_path, 'wb') as f:
                await f.write(screenshot_bytes)
            
            await db.comments.update_one(
                {'id': comment_id},
                {'$set': {'screenshot_path': f"uploads/screenshots/{screenshot_filename}"}}
            )
            
            logger.info(f"Generated screenshot for comment {comment_id}")
    except Exception as e:
        logger.error(f"Failed to generate comment screenshot: {e}")

@api_router.get("/comments/{pin_id}", response_model=List[Comment])
async def get_comments(pin_id: str):
    comments = await db.comments.find({'pin_id': pin_id}, {'_id': 0}).to_list(1000)
    return [Comment(**c) for c in comments]

@api_router.post("/comments/attachment")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    file_extension = Path(file.filename).suffix
    file_name = f"{uuid.uuid4()}{file_extension}"
    file_path = f"uploads/attachments/{file_name}"
    
    async with aiofiles.open(UPLOAD_DIR / 'attachments' / file_name, 'wb') as f:
        content = await file.read()
        await f.write(content)
        
        file_size_mb = len(content) / (1024 * 1024)
        await db.teams.update_one(
            {'id': current_user['team_id']},
            {'$inc': {'storage_used_mb': file_size_mb}}
        )
    
    return {'file_path': file_path}

# Admin Routes
@api_router.get("/admin/stats", response_model=UsageStats)
async def get_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'owner':
        raise HTTPException(status_code=403, detail='Admin access only')
    
    team_id = current_user['team_id']
    
    total_projects = await db.projects.count_documents({'team_id': team_id})
    total_pins = await db.pins.count_documents({'project_id': {'$in': [p['id'] for p in await db.projects.find({'team_id': team_id}, {'_id': 0, 'id': 1}).to_list(1000)]}})
    total_comments = await db.comments.count_documents({})
    
    team = await db.teams.find_one({'id': team_id}, {'_id': 0})
    storage_used_mb = team.get('storage_used_mb', 0) if team else 0
    
    team_members = await db.users.count_documents({'team_id': team_id})
    
    guest_commenters = await db.comments.distinct('guest_email', {'author_type': 'guest'})
    
    return UsageStats(
        total_projects=total_projects,
        total_pins=total_pins,
        total_comments=total_comments,
        storage_used_mb=storage_used_mb,
        team_members=team_members,
        guest_commenters=len(guest_commenters)
    )

@api_router.get("/admin/guests")
async def get_guests(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'owner':
        raise HTTPException(status_code=403, detail='Admin access only')
    
    guests = await db.comments.find(
        {'author_type': 'guest'},
        {'_id': 0, 'guest_email': 1, 'author_name': 1}
    ).to_list(1000)
    
    unique_guests = {}
    for guest in guests:
        email = guest.get('guest_email')
        if email and email not in unique_guests:
            unique_guests[email] = {
                'email': email,
                'name': guest.get('author_name', 'Unknown')
            }
    
    return list(unique_guests.values())

# File serving
@api_router.get("/files/{file_type}/{filename}")
async def get_file(file_type: str, filename: str):
    if file_type not in ['projects', 'attachments', 'screenshots']:
        raise HTTPException(status_code=400, detail='Invalid file type')
    
    file_path = UPLOAD_DIR / file_type / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    
    return FileResponse(file_path)

# Screenshot capture endpoint - on-demand screenshot generation
@api_router.post("/projects/{project_id}/capture")
async def capture_project_screenshot(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Capture screenshot on-demand when user opens project canvas"""
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    # If screenshot already exists, return it
    if project.get('screenshot_path'):
        return {
            'screenshot_path': project['screenshot_path'],
            'thumbnail_path': project.get('thumbnail_path'),
            'cached': True
        }
    
    # If it's a URL project, capture screenshot now (visible viewport only)
    if project['type'] == 'url' and project.get('content_url'):
        screenshot_path = await capture_viewport_screenshot(project['content_url'])
        thumbnail_path = await generate_project_thumbnail(project['content_url'])
        
        if screenshot_path:
            # Update project with screenshot and thumbnail paths
            await db.projects.update_one(
                {'id': project_id},
                {'$set': {
                    'screenshot_path': screenshot_path,
                    'thumbnail_path': thumbnail_path
                }}
            )
            return {
                'screenshot_path': screenshot_path,
                'thumbnail_path': thumbnail_path,
                'cached': False
            }
    
    raise HTTPException(status_code=400, detail='Failed to capture screenshot')

@api_router.get("/projects/{project_id}/screenshot")
async def get_project_screenshot(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get existing screenshot for a project"""
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    return {
        'screenshot_path': project.get('screenshot_path'),
        'thumbnail_path': project.get('thumbnail_path')
    }
@api_router.get("/superadmin/teams")
async def get_all_teams(current_user: dict = Depends(get_current_user)):
    # Only allow admin@markuply.com
    if current_user['email'] != 'admin@markuply.com':
        raise HTTPException(status_code=403, detail='Unauthorized')
    
    teams_list = await db.teams.find({}, {'_id': 0}).to_list(1000)
    
    # Enrich with owner email and project count
    for team in teams_list:
        owner = await db.users.find_one({'id': team['owner_id']}, {'_id': 0})
        team['owner_email'] = owner['email'] if owner else None
        team['project_count'] = await db.projects.count_documents({'team_id': team['id']})
    
    return teams_list

@api_router.get("/superadmin/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user['email'] != 'admin@markuply.com':
        raise HTTPException(status_code=403, detail='Unauthorized')
    
    users_list = await db.users.find({}, {'_id': 0, 'password_hash': 0}).to_list(10000)
    return users_list

@api_router.get("/superadmin/stats")
async def get_super_stats(current_user: dict = Depends(get_current_user)):
    if current_user['email'] != 'admin@markuply.com':
        raise HTTPException(status_code=403, detail='Unauthorized')
    
    total_teams = await db.teams.count_documents({})
    total_users = await db.users.count_documents({})
    total_projects = await db.projects.count_documents({})
    
    # Calculate total storage
    all_teams = await db.teams.find({}, {'_id': 0, 'storage_used_mb': 1}).to_list(1000)
    total_storage_mb = sum(team.get('storage_used_mb', 0) for team in all_teams)
    
    return {
        'total_teams': total_teams,
        'total_users': total_users,
        'total_projects': total_projects,
        'total_storage_mb': total_storage_mb
    }

# =============================================================================
# REVERSE PROXY FOR EXTERNAL WEBSITES (Using Playwright for Cloudflare bypass)
# =============================================================================

# Browser instance for proxy (reused)
_browser_instance = None
_browser_lock = asyncio.Lock()

async def get_browser():
    """Get or create a browser instance for proxy requests"""
    global _browser_instance
    async with _browser_lock:
        if _browser_instance is None or not _browser_instance.is_connected():
            playwright = await async_playwright().start()
            _browser_instance = await playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )
        return _browser_instance

# Headers to remove from proxied responses (security headers that block framing)
HEADERS_TO_REMOVE = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'x-content-type-options',
    'x-xss-protection',
    'referrer-policy',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
]

def get_base_url(url: str) -> str:
    """Extract base URL (scheme + netloc) from a URL"""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"

def make_absolute_url(base_url: str, relative_url: str) -> str:
    """Convert a relative URL to absolute using the base URL"""
    if not relative_url:
        return relative_url
    if relative_url.startswith('data:') or relative_url.startswith('javascript:') or relative_url.startswith('#'):
        return relative_url
    return urljoin(base_url, relative_url)

def create_proxy_url(target_url: str, base_url: str) -> str:
    """Create a proxy URL for the given target URL"""
    absolute_url = make_absolute_url(base_url, target_url)
    if not absolute_url or absolute_url.startswith('data:') or absolute_url.startswith('javascript:') or absolute_url.startswith('#'):
        return target_url
    return f"/api/proxy?url={quote(absolute_url, safe='')}"

def rewrite_css_urls(css_content: str, base_url: str) -> str:
    """Rewrite url() references in CSS content"""
    def replace_url(match):
        url = match.group(1).strip('\'"')
        if url.startswith('data:'):
            return match.group(0)
        proxy_url = create_proxy_url(url, base_url)
        return f"url('{proxy_url}')"
    
    # Match url() patterns in CSS
    pattern = r'url\([\'"]?([^\'"\)]+)[\'"]?\)'
    return re.sub(pattern, replace_url, css_content)

def rewrite_html(html_content: str, base_url: str, project_id: str = None) -> str:
    """Rewrite HTML to route all URLs through the proxy and inject annotation script"""
    soup = BeautifulSoup(html_content, 'lxml')
    
    # Rewrite <a> href attributes
    for tag in soup.find_all('a', href=True):
        original_href = tag['href']
        if original_href and not original_href.startswith('#') and not original_href.startswith('javascript:'):
            tag['href'] = create_proxy_url(original_href, base_url)
            # Add target="_self" to keep navigation in iframe
            tag['target'] = '_self'
    
    # Rewrite <img> src attributes
    for tag in soup.find_all('img', src=True):
        tag['src'] = create_proxy_url(tag['src'], base_url)
    
    # Rewrite <img> srcset attributes
    for tag in soup.find_all('img', srcset=True):
        srcset_parts = []
        for part in tag['srcset'].split(','):
            part = part.strip()
            if ' ' in part:
                url, descriptor = part.rsplit(' ', 1)
                srcset_parts.append(f"{create_proxy_url(url.strip(), base_url)} {descriptor}")
            else:
                srcset_parts.append(create_proxy_url(part, base_url))
        tag['srcset'] = ', '.join(srcset_parts)
    
    # Rewrite <script> src attributes
    for tag in soup.find_all('script', src=True):
        tag['src'] = create_proxy_url(tag['src'], base_url)
    
    # Rewrite <link> href attributes (stylesheets, icons, etc.)
    for tag in soup.find_all('link', href=True):
        tag['href'] = create_proxy_url(tag['href'], base_url)
    
    # Rewrite <form> action attributes
    for tag in soup.find_all('form', action=True):
        tag['action'] = create_proxy_url(tag['action'], base_url)
        tag['target'] = '_self'
    
    # Rewrite <source> src and srcset attributes (for video/audio/picture)
    for tag in soup.find_all('source'):
        if tag.get('src'):
            tag['src'] = create_proxy_url(tag['src'], base_url)
        if tag.get('srcset'):
            srcset_parts = []
            for part in tag['srcset'].split(','):
                part = part.strip()
                if ' ' in part:
                    url, descriptor = part.rsplit(' ', 1)
                    srcset_parts.append(f"{create_proxy_url(url.strip(), base_url)} {descriptor}")
                else:
                    srcset_parts.append(create_proxy_url(part, base_url))
            tag['srcset'] = ', '.join(srcset_parts)
    
    # Rewrite <video> and <audio> src attributes
    for tag in soup.find_all(['video', 'audio'], src=True):
        tag['src'] = create_proxy_url(tag['src'], base_url)
    
    # Rewrite <video> poster attribute
    for tag in soup.find_all('video', poster=True):
        tag['poster'] = create_proxy_url(tag['poster'], base_url)
    
    # Rewrite <iframe> src attributes (nested iframes)
    for tag in soup.find_all('iframe', src=True):
        if not tag['src'].startswith('data:'):
            tag['src'] = create_proxy_url(tag['src'], base_url)
    
    # Rewrite <object> data attributes
    for tag in soup.find_all('object', data=True):
        tag['data'] = create_proxy_url(tag['data'], base_url)
    
    # Rewrite <embed> src attributes
    for tag in soup.find_all('embed', src=True):
        tag['src'] = create_proxy_url(tag['src'], base_url)
    
    # Rewrite inline style attributes with url() references
    for tag in soup.find_all(style=True):
        tag['style'] = rewrite_css_urls(tag['style'], base_url)
    
    # Rewrite <style> tags
    for tag in soup.find_all('style'):
        if tag.string:
            tag.string = rewrite_css_urls(tag.string, base_url)
    
    # Rewrite meta refresh redirects
    for tag in soup.find_all('meta', attrs={'http-equiv': re.compile('refresh', re.I)}):
        content = tag.get('content', '')
        if 'url=' in content.lower():
            match = re.search(r'url=([^\s;]+)', content, re.I)
            if match:
                original_url = match.group(1).strip('\'"')
                proxy_url = create_proxy_url(original_url, base_url)
                tag['content'] = re.sub(r'url=[^\s;]+', f'url={proxy_url}', content, flags=re.I)
    
    # Add base tag to help with any remaining relative URLs
    head = soup.find('head')
    if head:
        # Remove any existing base tag
        for existing_base in head.find_all('base'):
            existing_base.decompose()
    
    # Inject annotation script at the end of body
    body = soup.find('body')
    if body:
        annotation_script = soup.new_tag('script')
        annotation_script.string = f'''
        (function() {{
            // Markuply Annotation Layer
            window.MARKUPLY_PROJECT_ID = "{project_id or ''}";
            window.MARKUPLY_BASE_URL = "{base_url}";
            
            // Intercept link clicks to use proxy navigation
            document.addEventListener('click', function(e) {{
                var target = e.target.closest('a');
                if (target && target.href) {{
                    // Check if it's an internal link that needs proxy
                    if (target.href.indexOf('/api/proxy') === -1 && 
                        !target.href.startsWith('javascript:') && 
                        !target.href.startsWith('#') &&
                        !target.href.startsWith('data:')) {{
                        e.preventDefault();
                        var proxyUrl = '/api/proxy?url=' + encodeURIComponent(target.href);
                        window.location.href = proxyUrl;
                    }}
                }}
            }}, true);
            
            // Intercept form submissions
            document.addEventListener('submit', function(e) {{
                var form = e.target;
                if (form.action && form.action.indexOf('/api/proxy') === -1) {{
                    e.preventDefault();
                    var proxyAction = '/api/proxy?url=' + encodeURIComponent(form.action);
                    form.action = proxyAction;
                    form.submit();
                }}
            }}, true);
            
            // Notify parent window that page loaded
            if (window.parent !== window) {{
                window.parent.postMessage({{
                    type: 'MARKUPLY_PAGE_LOADED',
                    url: window.location.href,
                    title: document.title
                }}, '*');
            }}
        }})();
        '''
        body.append(annotation_script)
    
    return str(soup)

# Simple HTTP client for non-HTML assets
_http_client = None

async def get_http_client():
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=30.0,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        )
    return _http_client

@api_router.get("/proxy")
async def proxy_page(url: str = Query(..., description="URL to proxy"), project_id: str = Query(None)):
    """Proxy an external webpage using Playwright (handles Cloudflare), rewriting URLs and injecting annotation scripts"""
    try:
        # Decode the URL if it's encoded
        target_url = unquote(url)
        
        # Validate URL
        parsed = urlparse(target_url)
        if not parsed.scheme or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL")
        
        if parsed.scheme not in ['http', 'https']:
            raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are supported")
        
        base_url = get_base_url(target_url)
        
        # Check if this is likely an HTML page or an asset
        path_lower = parsed.path.lower()
        is_asset = any(path_lower.endswith(ext) for ext in [
            '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', 
            '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.webm',
            '.pdf', '.zip', '.json', '.xml'
        ])
        
        if is_asset:
            # Use simple HTTP client for assets (faster)
            http_client = await get_http_client()
            response = await http_client.get(target_url)
            content_type = response.headers.get('content-type', '').lower()
            
            if 'text/css' in content_type:
                css_content = response.text
                rewritten_css = rewrite_css_urls(css_content, base_url)
                return Response(content=rewritten_css, status_code=200, media_type='text/css')
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=content_type.split(';')[0] if content_type else 'application/octet-stream'
            )
        
        # Use Playwright for HTML pages (handles Cloudflare challenges)
        browser = await get_browser()
        page = await browser.new_page(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        try:
            # Navigate to the page and wait for it to load
            response = await page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
            
            # Wait a bit for any JavaScript to execute
            await page.wait_for_timeout(1000)
            
            # Get the page content after JavaScript execution
            html_content = await page.content()
            
            # Get the final URL (in case of redirects)
            final_url = page.url
            final_base_url = get_base_url(final_url)
            
            # Rewrite HTML content
            rewritten_html = rewrite_html(html_content, final_base_url, project_id)
            
            return HTMLResponse(
                content=rewritten_html,
                status_code=200,
                headers={
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Proxied-URL': final_url,
                }
            )
        finally:
            await page.close()
    
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")

@api_router.post("/proxy")
async def proxy_page_post(
    url: str = Query(..., description="URL to proxy"),
    project_id: str = Query(None)
):
    """Handle POST requests through the proxy"""
    try:
        target_url = unquote(url)
        parsed = urlparse(target_url)
        if not parsed.scheme or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL")
        
        base_url = get_base_url(target_url)
        
        # For POST requests, we'll forward as GET for now (form handling is complex)
        http_client = await get_http_client()
        response = await http_client.get(target_url)
        
        content_type = response.headers.get('content-type', '').lower()
        
        if 'text/html' in content_type:
            html_content = response.text
            rewritten_html = rewrite_html(html_content, base_url, project_id)
            return HTMLResponse(content=rewritten_html, status_code=response.status_code)
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=content_type.split(';')[0] if content_type else 'application/octet-stream'
        )
    
    except Exception as e:
        logger.error(f"Proxy POST error: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()