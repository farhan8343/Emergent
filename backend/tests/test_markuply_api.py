"""
Markuply API Backend Tests
Tests for: Authentication, Projects, Pins, Comments, Teams, Admin
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"
TEST_PROJECT_URL = "https://example.com"


class TestHealthAndAuth:
    """Authentication and basic health tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid login correctly rejected")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": "newpassword",
            "name": "Duplicate User"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Duplicate email registration correctly rejected")
    
    def test_get_me_authenticated(self):
        """Test getting current user info"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print("✓ Get current user successful")
    
    def test_get_me_unauthenticated(self):
        """Test getting user info without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated access correctly rejected")


class TestTeams:
    """Team management tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_my_team(self, auth_headers):
        """Test getting team info"""
        response = requests.get(f"{BASE_URL}/api/teams/me", headers=auth_headers)
        assert response.status_code == 200, f"Get team failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "plan" in data
        assert "member_limit" in data
        print(f"✓ Team retrieved: {data['name']}, Plan: {data['plan']}")
    
    def test_get_team_members(self, auth_headers):
        """Test getting team members"""
        response = requests.get(f"{BASE_URL}/api/teams/members", headers=auth_headers)
        assert response.status_code == 200, f"Get members failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the owner
        print(f"✓ Team has {len(data)} member(s)")


class TestProjects:
    """Project CRUD tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_projects(self, auth_headers):
        """Test listing projects"""
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200, f"Get projects failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} project(s)")
        return data
    
    def test_create_project_url_type(self, auth_headers):
        """Test creating a URL-type project"""
        unique_name = f"TEST_Project_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            data={
                "name": unique_name,
                "type": "url",
                "content_url": TEST_PROJECT_URL
            }
        )
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        assert data["name"] == unique_name
        assert data["type"] == "url"
        assert data["content_url"] == TEST_PROJECT_URL
        assert "id" in data
        print(f"✓ Project created: {unique_name}")
        return data
    
    def test_get_project_by_id(self, auth_headers):
        """Test getting a specific project"""
        # First get all projects
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        if len(projects) == 0:
            pytest.skip("No projects to test")
        
        project_id = projects[0]["id"]
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
        assert response.status_code == 200, f"Get project failed: {response.text}"
        data = response.json()
        assert data["id"] == project_id
        print(f"✓ Project retrieved: {data['name']}")
    
    def test_get_nonexistent_project(self, auth_headers):
        """Test getting a project that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/projects/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent project correctly returns 404")


class TestScreenshotCapture:
    """On-demand screenshot capture tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_capture_screenshot_existing_project(self, auth_headers):
        """Test capturing screenshot for existing project"""
        # Get projects
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        # Find a URL project
        url_project = next((p for p in projects if p["type"] == "url"), None)
        if not url_project:
            pytest.skip("No URL project to test")
        
        project_id = url_project["id"]
        
        # Try to capture screenshot (may return cached)
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/capture",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Capture failed: {response.text}"
        data = response.json()
        assert "screenshot_path" in data
        print(f"✓ Screenshot capture endpoint works, cached: {data.get('cached', False)}")
    
    def test_get_project_screenshot(self, auth_headers):
        """Test getting screenshot info for a project"""
        # Get projects
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        if len(projects) == 0:
            pytest.skip("No projects to test")
        
        project_id = projects[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/screenshot",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get screenshot failed: {response.text}"
        data = response.json()
        assert "screenshot_path" in data
        print(f"✓ Screenshot info retrieved: {data.get('screenshot_path', 'None')}")


class TestPins:
    """Pin CRUD tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def test_project_id(self, auth_headers):
        """Get or create a test project"""
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        if len(projects) > 0:
            return projects[0]["id"]
        
        # Create a new project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            data={
                "name": f"TEST_PinProject_{uuid.uuid4().hex[:8]}",
                "type": "url",
                "content_url": TEST_PROJECT_URL
            }
        )
        return response.json()["id"]
    
    def test_get_pins(self, auth_headers, test_project_id):
        """Test getting pins for a project"""
        response = requests.get(
            f"{BASE_URL}/api/pins/{test_project_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get pins failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} pin(s) for project")
        return data
    
    def test_create_pin(self, auth_headers, test_project_id):
        """Test creating a pin"""
        response = requests.post(
            f"{BASE_URL}/api/pins",
            headers=auth_headers,
            json={
                "project_id": test_project_id,
                "x": 50.0,
                "y": 50.0
            }
        )
        assert response.status_code == 200, f"Create pin failed: {response.text}"
        data = response.json()
        assert data["project_id"] == test_project_id
        assert data["x"] == 50.0
        assert data["y"] == 50.0
        assert data["status"] == "open"
        assert "id" in data
        print(f"✓ Pin created at (50%, 50%)")
        return data
    
    def test_update_pin_status_resolve(self, auth_headers, test_project_id):
        """Test resolving a pin"""
        # First create a pin
        create_resp = requests.post(
            f"{BASE_URL}/api/pins",
            headers=auth_headers,
            json={
                "project_id": test_project_id,
                "x": 25.0,
                "y": 25.0
            }
        )
        pin_id = create_resp.json()["id"]
        
        # Resolve the pin
        response = requests.put(
            f"{BASE_URL}/api/pins/{pin_id}/status?new_status=resolved",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Resolve pin failed: {response.text}"
        print("✓ Pin resolved successfully")
    
    def test_update_pin_status_reopen(self, auth_headers, test_project_id):
        """Test reopening a resolved pin"""
        # Create and resolve a pin
        create_resp = requests.post(
            f"{BASE_URL}/api/pins",
            headers=auth_headers,
            json={
                "project_id": test_project_id,
                "x": 75.0,
                "y": 75.0
            }
        )
        pin_id = create_resp.json()["id"]
        
        # Resolve
        requests.put(
            f"{BASE_URL}/api/pins/{pin_id}/status?new_status=resolved",
            headers=auth_headers
        )
        
        # Reopen
        response = requests.put(
            f"{BASE_URL}/api/pins/{pin_id}/status?new_status=open",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Reopen pin failed: {response.text}"
        print("✓ Pin reopened successfully")
    
    def test_update_pin_invalid_status(self, auth_headers, test_project_id):
        """Test updating pin with invalid status"""
        # Create a pin
        create_resp = requests.post(
            f"{BASE_URL}/api/pins",
            headers=auth_headers,
            json={
                "project_id": test_project_id,
                "x": 10.0,
                "y": 10.0
            }
        )
        pin_id = create_resp.json()["id"]
        
        # Try invalid status
        response = requests.put(
            f"{BASE_URL}/api/pins/{pin_id}/status?new_status=invalid",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid pin status correctly rejected")


class TestComments:
    """Comment tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def test_pin_id(self, auth_headers):
        """Get or create a test pin"""
        # Get projects
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        if len(projects) == 0:
            # Create project
            proj_resp = requests.post(
                f"{BASE_URL}/api/projects",
                headers=auth_headers,
                data={
                    "name": f"TEST_CommentProject_{uuid.uuid4().hex[:8]}",
                    "type": "url",
                    "content_url": TEST_PROJECT_URL
                }
            )
            project_id = proj_resp.json()["id"]
        else:
            project_id = projects[0]["id"]
        
        # Get pins
        pins_resp = requests.get(f"{BASE_URL}/api/pins/{project_id}", headers=auth_headers)
        pins = pins_resp.json()
        
        if len(pins) > 0:
            return pins[0]["id"]
        
        # Create pin
        pin_resp = requests.post(
            f"{BASE_URL}/api/pins",
            headers=auth_headers,
            json={
                "project_id": project_id,
                "x": 50.0,
                "y": 50.0
            }
        )
        return pin_resp.json()["id"]
    
    def test_get_comments(self, test_pin_id):
        """Test getting comments for a pin (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/comments/{test_pin_id}")
        assert response.status_code == 200, f"Get comments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} comment(s) for pin")
    
    def test_create_comment_authenticated(self, auth_headers, test_pin_id):
        """Test creating a comment as authenticated user"""
        response = requests.post(
            f"{BASE_URL}/api/comments",
            headers=auth_headers,
            json={
                "pin_id": test_pin_id,
                "content": f"TEST_Comment_{uuid.uuid4().hex[:8]}"
            }
        )
        assert response.status_code == 200, f"Create comment failed: {response.text}"
        data = response.json()
        assert data["pin_id"] == test_pin_id
        assert data["author_type"] == "team"
        assert "id" in data
        print("✓ Authenticated comment created")
    
    def test_create_comment_guest_missing_info(self, test_pin_id):
        """Test guest comment without required info"""
        response = requests.post(
            f"{BASE_URL}/api/comments",
            json={
                "pin_id": test_pin_id,
                "content": "Guest comment without info"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Guest comment without info correctly rejected")


class TestAdminStats:
    """Admin statistics tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_admin_stats(self, auth_headers):
        """Test getting admin statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers)
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        data = response.json()
        assert "total_projects" in data
        assert "total_pins" in data
        assert "total_comments" in data
        assert "storage_used_mb" in data
        assert "team_members" in data
        print(f"✓ Admin stats: {data['total_projects']} projects, {data['total_pins']} pins")
    
    def test_get_admin_guests(self, auth_headers):
        """Test getting guest commenters list"""
        response = requests.get(f"{BASE_URL}/api/admin/guests", headers=auth_headers)
        assert response.status_code == 200, f"Get guests failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} guest commenter(s)")


class TestFileServing:
    """File serving tests"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_file_invalid_type(self):
        """Test getting file with invalid type"""
        response = requests.get(f"{BASE_URL}/api/files/invalid/test.png")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid file type correctly rejected")
    
    def test_get_file_not_found(self):
        """Test getting nonexistent file"""
        response = requests.get(f"{BASE_URL}/api/files/screenshots/nonexistent.png")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent file correctly returns 404")
    
    def test_get_existing_screenshot(self, auth_headers):
        """Test getting an existing screenshot file"""
        # Get projects to find one with screenshot
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        project_with_screenshot = next(
            (p for p in projects if p.get("screenshot_path")), None
        )
        
        if not project_with_screenshot:
            pytest.skip("No project with screenshot to test")
        
        screenshot_filename = project_with_screenshot["screenshot_path"].split("/")[-1]
        response = requests.get(f"{BASE_URL}/api/files/screenshots/{screenshot_filename}")
        assert response.status_code == 200, f"Get screenshot failed: {response.status_code}"
        assert "image" in response.headers.get("content-type", "")
        print(f"✓ Screenshot file retrieved: {screenshot_filename}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_headers(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_cleanup_test_projects(self, auth_headers):
        """Clean up TEST_ prefixed projects"""
        projects_resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = projects_resp.json()
        
        deleted_count = 0
        for project in projects:
            if project["name"].startswith("TEST_"):
                delete_resp = requests.delete(
                    f"{BASE_URL}/api/projects/{project['id']}",
                    headers=auth_headers
                )
                if delete_resp.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test project(s)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
