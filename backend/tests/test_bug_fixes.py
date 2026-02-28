"""
Markuply Bug Fixes Tests - Iteration 4
Tests for: Guest access, Guest pin creation, Public endpoints, Cloudflare proxy
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test project with Cloudflare-protected site
TEST_PROJECT_ID = "f54cf8c6-cb17-4926-8078-b6132bf409ba"
TEST_PROJECT_URL = "https://brandlume.com"


class TestPublicEndpoints:
    """Test public/guest access endpoints - no authentication required"""
    
    def test_public_project_endpoint(self):
        """Test GET /api/projects/{id}/public - should work without auth"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/public")
        assert response.status_code == 200, f"Public project endpoint failed: {response.text}"
        data = response.json()
        assert data["id"] == TEST_PROJECT_ID
        assert data["content_url"] == TEST_PROJECT_URL
        print(f"✓ Public project endpoint works: {data['name']}")
    
    def test_public_project_not_found(self):
        """Test GET /api/projects/{id}/public with invalid ID"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/projects/{fake_id}/public")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Public project 404 for invalid ID")
    
    def test_public_pins_endpoint(self):
        """Test GET /api/projects/{id}/pins/public - should work without auth"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/pins/public")
        assert response.status_code == 200, f"Public pins endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public pins endpoint works: {len(data)} pins")
    
    def test_public_comments_endpoint(self):
        """Test GET /api/projects/{id}/comments/public - should work without auth"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/comments/public")
        assert response.status_code == 200, f"Public comments endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public comments endpoint works: {len(data)} comments")


class TestGuestPinCreation:
    """Test guest pin creation - no authentication required"""
    
    def test_create_guest_pin_success(self):
        """Test POST /api/pins/guest - create pin as guest"""
        guest_email = f"testguest_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/pins/guest", json={
            "project_id": TEST_PROJECT_ID,
            "x": 45.5,
            "y": 60.2,
            "page_url": TEST_PROJECT_URL,
            "scroll_x": 0,
            "scroll_y": 200,
            "guest_name": "Test Guest",
            "guest_email": guest_email
        })
        assert response.status_code == 200, f"Guest pin creation failed: {response.text}"
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "open"
        assert data["created_by"] == f"guest:{guest_email}"
        assert data["x"] == 45.5
        assert data["y"] == 60.2
        print(f"✓ Guest pin created: {data['id']}")
        return data["id"]
    
    def test_create_guest_pin_invalid_project(self):
        """Test POST /api/pins/guest with invalid project ID"""
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/pins/guest", json={
            "project_id": fake_id,
            "x": 50,
            "y": 50,
            "guest_name": "Test Guest",
            "guest_email": "test@example.com"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Guest pin creation 404 for invalid project")
    
    def test_create_guest_pin_missing_fields(self):
        """Test POST /api/pins/guest with missing required fields"""
        response = requests.post(f"{BASE_URL}/api/pins/guest", json={
            "project_id": TEST_PROJECT_ID,
            "x": 50,
            "y": 50
            # Missing guest_name and guest_email
        })
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Guest pin creation validation works")


class TestCloudflareProxy:
    """Test proxy endpoint for Cloudflare-protected sites"""
    
    def test_proxy_cloudflare_site(self):
        """Test GET /api/proxy with Cloudflare-protected URL"""
        import urllib.parse
        encoded_url = urllib.parse.quote(TEST_PROJECT_URL, safe='')
        response = requests.get(f"{BASE_URL}/api/proxy?url={encoded_url}", timeout=60)
        assert response.status_code == 200, f"Proxy failed: {response.status_code}"
        assert "text/html" in response.headers.get("content-type", "")
        # Check that HTML content is returned
        assert "<html" in response.text.lower() or "<!doctype" in response.text.lower()
        print(f"✓ Proxy works for Cloudflare site: {len(response.text)} bytes")
    
    def test_proxy_invalid_url(self):
        """Test GET /api/proxy with invalid URL"""
        response = requests.get(f"{BASE_URL}/api/proxy?url=not-a-valid-url")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Proxy rejects invalid URL")
    
    def test_proxy_css_asset(self):
        """Test proxy handles CSS assets correctly"""
        import urllib.parse
        # Test with a known CSS file
        css_url = "https://brandlume.com/wp-includes/css/dist/block-library/style.min.css"
        encoded_url = urllib.parse.quote(css_url, safe='')
        response = requests.get(f"{BASE_URL}/api/proxy?url={encoded_url}", timeout=30)
        # CSS might return 200 or redirect
        assert response.status_code in [200, 301, 302, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Proxy handles CSS assets: status {response.status_code}")


class TestThumbnailGeneration:
    """Test thumbnail generation for Cloudflare sites"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for authenticated endpoints"""
        # Try to login with test credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        if response.status_code != 200:
            pytest.skip("Test user not available")
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_project_has_thumbnail(self):
        """Test that project has thumbnail generated"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/public")
        assert response.status_code == 200
        data = response.json()
        # Thumbnail should exist for Cloudflare site
        assert data.get("thumbnail_path") is not None, "Thumbnail not generated for Cloudflare site"
        print(f"✓ Project has thumbnail: {data['thumbnail_path']}")
    
    def test_thumbnail_file_accessible(self):
        """Test that thumbnail file is accessible"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/public")
        data = response.json()
        thumbnail_path = data.get("thumbnail_path")
        if thumbnail_path:
            # Extract filename from path
            filename = thumbnail_path.split("/")[-1]
            file_response = requests.get(f"{BASE_URL}/api/files/screenshots/{filename}")
            assert file_response.status_code == 200, f"Thumbnail file not accessible: {file_response.status_code}"
            assert "image" in file_response.headers.get("content-type", "")
            print(f"✓ Thumbnail file accessible: {filename}")
        else:
            pytest.skip("No thumbnail path available")


class TestGuestComments:
    """Test guest comment functionality"""
    
    def test_create_guest_comment(self):
        """Test creating a comment as guest"""
        # First create a guest pin
        guest_email = f"testguest_{uuid.uuid4().hex[:8]}@example.com"
        pin_response = requests.post(f"{BASE_URL}/api/pins/guest", json={
            "project_id": TEST_PROJECT_ID,
            "x": 30,
            "y": 40,
            "guest_name": "Comment Test Guest",
            "guest_email": guest_email
        })
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Now create a comment on that pin
        comment_response = requests.post(f"{BASE_URL}/api/comments", json={
            "pin_id": pin_id,
            "content": "This is a test comment from a guest",
            "guest_name": "Comment Test Guest",
            "guest_email": guest_email
        })
        assert comment_response.status_code == 200, f"Guest comment failed: {comment_response.text}"
        data = comment_response.json()
        assert data["author_type"] == "guest"
        assert data["author_name"] == "Comment Test Guest"
        assert data["content"] == "This is a test comment from a guest"
        print(f"✓ Guest comment created: {data['id']}")
    
    def test_get_comments_for_pin(self):
        """Test getting comments for a pin"""
        # First create a pin and comment
        guest_email = f"testguest_{uuid.uuid4().hex[:8]}@example.com"
        pin_response = requests.post(f"{BASE_URL}/api/pins/guest", json={
            "project_id": TEST_PROJECT_ID,
            "x": 35,
            "y": 45,
            "guest_name": "Get Comments Test",
            "guest_email": guest_email
        })
        pin_id = pin_response.json()["id"]
        
        # Create comment
        requests.post(f"{BASE_URL}/api/comments", json={
            "pin_id": pin_id,
            "content": "Test comment for retrieval",
            "guest_name": "Get Comments Test",
            "guest_email": guest_email
        })
        
        # Get comments
        response = requests.get(f"{BASE_URL}/api/comments/{pin_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        print(f"✓ Comments retrieved: {len(data)} comments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
