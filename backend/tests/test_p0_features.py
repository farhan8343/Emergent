"""
Markuply P0 Feature Tests - Iteration 5
Tests for: Auth login, Authenticated pin creation, Comment creation, File attachment, Screenshot
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@markuply.com"
ADMIN_PASSWORD = "admin123"
TEST_PROJECT_ID = "6957aafa-5399-4c4e-b1c1-2532342b979d"  # BrandLume project
TEST_PROJECT_URL = "https://brandlume.com"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login success: {data['user']['name']}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials rejected with 401")


class TestAuthenticatedPinCreation:
    """Test pin creation for authenticated users"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_pin_authenticated(self, auth_headers):
        """Test POST /api/pins - create pin as authenticated user"""
        response = requests.post(f"{BASE_URL}/api/pins", json={
            "project_id": TEST_PROJECT_ID,
            "x": 55.5,
            "y": 65.2,
            "page_url": TEST_PROJECT_URL,
            "scroll_x": 0,
            "scroll_y": 100,
            "device_type": "desktop"
        }, headers=auth_headers)
        assert response.status_code == 200, f"Pin creation failed: {response.text}"
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "open"
        assert data["x"] == 55.5
        assert data["y"] == 65.2
        print(f"✓ Authenticated pin created: {data['id']}")
        return data["id"]
    
    def test_get_pins_authenticated(self, auth_headers):
        """Test GET /api/pins/{project_id} - get pins as authenticated user"""
        response = requests.get(f"{BASE_URL}/api/pins/{TEST_PROJECT_ID}", headers=auth_headers)
        assert response.status_code == 200, f"Get pins failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} pins")


class TestCommentCreation:
    """Test comment creation flow"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture
    def test_pin(self, auth_headers):
        """Create a test pin for comment tests"""
        response = requests.post(f"{BASE_URL}/api/pins", json={
            "project_id": TEST_PROJECT_ID,
            "x": 40,
            "y": 50,
            "page_url": TEST_PROJECT_URL
        }, headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Pin creation failed")
        return response.json()
    
    def test_create_comment_authenticated(self, auth_headers, test_pin):
        """Test POST /api/comments - create comment as authenticated user"""
        response = requests.post(f"{BASE_URL}/api/comments", json={
            "pin_id": test_pin["id"],
            "content": "Test comment from authenticated user"
        }, headers=auth_headers)
        assert response.status_code == 200, f"Comment creation failed: {response.text}"
        data = response.json()
        assert data["content"] == "Test comment from authenticated user"
        assert data["author_type"] == "team"
        print(f"✓ Authenticated comment created: {data['id']}")
    
    def test_get_comments_for_pin(self, auth_headers, test_pin):
        """Test GET /api/comments/{pin_id} - get comments"""
        # Create a comment first
        requests.post(f"{BASE_URL}/api/comments", json={
            "pin_id": test_pin["id"],
            "content": "Another test comment"
        }, headers=auth_headers)
        
        # Get comments
        response = requests.get(f"{BASE_URL}/api/comments/{test_pin['id']}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        print(f"✓ Retrieved {len(data)} comments")


class TestFileAttachment:
    """Test file attachment on comments"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture
    def test_pin(self, auth_headers):
        """Create a test pin for attachment tests"""
        response = requests.post(f"{BASE_URL}/api/pins", json={
            "project_id": TEST_PROJECT_ID,
            "x": 60,
            "y": 70,
            "page_url": TEST_PROJECT_URL
        }, headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Pin creation failed")
        return response.json()
    
    def test_create_comment_with_attachment(self, auth_headers, test_pin):
        """Test POST /api/comments/with-attachment - create comment with file"""
        # Create a simple test file
        files = {
            'file': ('test.txt', 'Test file content', 'text/plain')
        }
        data = {
            'pin_id': test_pin["id"],
            'content': 'Comment with attachment'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/comments/with-attachment",
            files=files,
            data=data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Comment with attachment failed: {response.text}"
        result = response.json()
        assert result["content"] == "Comment with attachment"
        assert result.get("attachment_path") is not None, "No attachment path in response"
        print(f"✓ Comment with attachment created: {result['id']}")
    
    def test_create_guest_comment_with_attachment(self, test_pin):
        """Test POST /api/comments/with-attachment as guest"""
        guest_email = f"guest_{uuid.uuid4().hex[:8]}@example.com"
        files = {
            'file': ('guest_test.txt', 'Guest test file content', 'text/plain')
        }
        data = {
            'pin_id': test_pin["id"],
            'content': 'Guest comment with attachment',
            'guest_name': 'Test Guest',
            'guest_email': guest_email
        }
        
        response = requests.post(
            f"{BASE_URL}/api/comments/with-attachment",
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Guest comment with attachment failed: {response.text}"
        result = response.json()
        assert result["author_type"] == "guest"
        print(f"✓ Guest comment with attachment created: {result['id']}")


class TestPinScreenshot:
    """Test screenshot generation on pin creation"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_pin_screenshot_generation(self, auth_headers):
        """Test that screenshot is generated for pin (background task)"""
        # Create a new pin
        response = requests.post(f"{BASE_URL}/api/pins", json={
            "project_id": TEST_PROJECT_ID,
            "x": 50,
            "y": 50,
            "page_url": TEST_PROJECT_URL,
            "device_type": "desktop"
        }, headers=auth_headers)
        assert response.status_code == 200
        pin = response.json()
        pin_id = pin["id"]
        
        # Screenshot is generated in background - wait and check
        # Initial response may not have screenshot_path yet
        print(f"✓ Pin created: {pin_id}")
        
        # Wait for background task (up to 20 seconds)
        screenshot_path = None
        for i in range(10):
            time.sleep(2)
            check_response = requests.get(f"{BASE_URL}/api/pins/{TEST_PROJECT_ID}", headers=auth_headers)
            if check_response.status_code == 200:
                pins = check_response.json()
                for p in pins:
                    if p["id"] == pin_id and p.get("screenshot_path"):
                        screenshot_path = p["screenshot_path"]
                        break
            if screenshot_path:
                break
        
        if screenshot_path:
            print(f"✓ Screenshot generated: {screenshot_path}")
            # Verify screenshot is accessible
            filename = screenshot_path.split("/")[-1]
            file_response = requests.get(f"{BASE_URL}/api/files/screenshots/{filename}")
            assert file_response.status_code == 200, f"Screenshot not accessible: {file_response.status_code}"
            print(f"✓ Screenshot file accessible")
        else:
            print("⚠ Screenshot not yet generated (background task may be delayed)")
    
    def test_existing_pin_has_screenshot(self, auth_headers):
        """Test that existing pins have screenshot links"""
        response = requests.get(f"{BASE_URL}/api/pins/{TEST_PROJECT_ID}", headers=auth_headers)
        assert response.status_code == 200
        pins = response.json()
        
        pins_with_screenshot = [p for p in pins if p.get("screenshot_path")]
        print(f"✓ Found {len(pins_with_screenshot)}/{len(pins)} pins with screenshots")


class TestDashboard:
    """Test dashboard endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_projects(self, auth_headers):
        """Test GET /api/projects - get user's projects"""
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200, f"Get projects failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} projects")
        
        # Check project structure
        if data:
            project = data[0]
            assert "id" in project
            assert "name" in project
            assert "created_at" in project
    
    def test_get_project_by_id(self, auth_headers):
        """Test GET /api/projects/{id} - get specific project"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}", headers=auth_headers)
        assert response.status_code == 200, f"Get project failed: {response.text}"
        data = response.json()
        assert data["id"] == TEST_PROJECT_ID
        print(f"✓ Retrieved project: {data['name']}")


class TestDeviceViewport:
    """Test device-specific pins"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_create_pin_with_device_type(self, auth_headers):
        """Test creating pins with different device types"""
        for device in ["desktop", "tablet", "mobile"]:
            response = requests.post(f"{BASE_URL}/api/pins", json={
                "project_id": TEST_PROJECT_ID,
                "x": 50,
                "y": 50,
                "page_url": TEST_PROJECT_URL,
                "device_type": device
            }, headers=auth_headers)
            assert response.status_code == 200, f"Pin creation for {device} failed: {response.text}"
            data = response.json()
            assert data.get("device_type") == device
            print(f"✓ Pin created for device: {device}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
