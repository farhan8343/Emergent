from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Set Playwright browsers path before importing playwright
if os.environ.get('PLAYWRIGHT_BROWSERS_PATH'):
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.environ['PLAYWRIGHT_BROWSERS_PATH']
else:
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

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

class Pin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    x: float
    y: float
    status: str
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
    """Generate thumbnail for project"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={'width': 1200, 'height': 800})
            await page.goto(url, wait_until='networkidle', timeout=30000)
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
    
    # Don't generate screenshot during project creation - do it on-demand
    # Thumbnail will be generated when screenshot is captured
    
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
    
    return Project(**project)

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

# Pin Routes
@api_router.post("/pins", response_model=Pin)
async def create_pin(pin_data: PinCreate, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {'id': pin_data.project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pin = {
        'id': str(uuid.uuid4()),
        'project_id': pin_data.project_id,
        'x': pin_data.x,
        'y': pin_data.y,
        'status': 'open',
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.pins.insert_one(pin)
    
    return Pin(**pin)

@api_router.get("/pins/{project_id}", response_model=List[Pin])
async def get_pins(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {'id': project_id, 'team_id': current_user['team_id']},
        {'_id': 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    pins = await db.pins.find({'project_id': project_id}, {'_id': 0}).to_list(1000)
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

# Comment Routes
@api_router.post("/comments", response_model=Comment)
async def create_comment(
    background_tasks: BackgroundTasks,
    comment_data: CommentCreate,
    current_user: Optional[dict] = None
):
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
    
    # Get pin and project info for screenshot
    pin = await db.pins.find_one({'id': pin_id}, {'_id': 0})
    screenshot_path = None
    
    if pin:
        project = await db.projects.find_one({'id': pin['project_id']}, {'_id': 0})
        if project and project.get('content_url'):
            screenshot_path = await capture_screenshot(
                project['content_url'],
                pin['x'],
                pin['y']
            )
    
    comment = {
        'id': str(uuid.uuid4()),
        'pin_id': pin_id,
        'author_type': author_type,
        'author_id': author_id,
        'author_name': author_name,
        'guest_email': guest_email if is_guest else None,
        'content': content,
        'attachment_path': attachment_path,
        'screenshot_path': screenshot_path,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment)
    
    return Comment(**comment)

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