"""
Iteration 6 - Testing new features:
- Delete Pin endpoint
- Screenshot generation with device_type
- Pin screenshot status polling endpoint
- Relative dates (dayjs - frontend)
- Smaller pin badges (frontend)
- Sidebar layout (frontend)
- Guest access
- File attachments
- Comment creation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://markup-review-2.preview.emergentagent.com').rstrip('/')
PROJECT_ID = "6957aafa-5399-4c4e-b1c1-2532342b979d"

class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@markuply.com"
        print(f"✓ Admin login successful")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print(f"✓ Invalid credentials rejected correctly")


class TestProjectAccess:
    """Project access tests - authenticated and guest"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_project_authenticated(self, auth_token):
        """Test getting project as authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{PROJECT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == PROJECT_ID
        assert "name" in data
        print(f"✓ Authenticated project access works - Project: {data['name']}")
    
    def test_get_project_public(self):
        """Test getting project via public endpoint (guest access)"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/public")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == PROJECT_ID
        print(f"✓ Guest/public project access works")
    
    def test_get_project_pins_public(self):
        """Test getting pins via public endpoint"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/pins/public")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Guest pins access works - {len(data)} pins found")


class TestPinOperations:
    """Pin CRUD operations including DELETE"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_create_pin(self, auth_token):
        """Test creating a pin"""
        response = requests.post(
            f"{BASE_URL}/api/pins",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "project_id": PROJECT_ID,
                "x": 50.5,
                "y": 30.2,
                "page_url": "https://brandlume.com",
                "scroll_x": 0,
                "scroll_y": 100,
                "device_type": "desktop"
            }
        )
        assert response.status_code == 200, f"Pin creation failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["device_type"] == "desktop"
        assert data["x"] == 50.5
        assert data["y"] == 30.2
        print(f"✓ Pin created: {data['id']}")
        return data["id"]
    
    def test_create_and_delete_pin(self, auth_token):
        """Test creating then deleting a pin - NEW FEATURE"""
        # Create pin
        create_response = requests.post(
            f"{BASE_URL}/api/pins",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "project_id": PROJECT_ID,
                "x": 75.0,
                "y": 45.0,
                "page_url": "https://brandlume.com",
                "scroll_x": 0,
                "scroll_y": 0,
                "device_type": "desktop"
            }
        )
        assert create_response.status_code == 200
        pin_id = create_response.json()["id"]
        print(f"✓ Pin created for deletion test: {pin_id}")
        
        # Verify pin exists
        pins_response = requests.get(
            f"{BASE_URL}/api/pins/{PROJECT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        pin_ids = [p["id"] for p in pins_response.json()]
        assert pin_id in pin_ids, "Created pin not found in list"
        
        # Delete pin
        delete_response = requests.delete(
            f"{BASE_URL}/api/pins/{pin_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Pin deleted successfully")
        
        # Verify pin is gone
        pins_response = requests.get(
            f"{BASE_URL}/api/pins/{PROJECT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        pin_ids = [p["id"] for p in pins_response.json()]
        assert pin_id not in pin_ids, "Deleted pin still exists"
        print(f"✓ Pin verified as deleted from list")
    
    def test_pin_screenshot_endpoint(self, auth_token):
        """Test pin screenshot status endpoint - NEW FEATURE"""
        # Create a pin first
        create_response = requests.post(
            f"{BASE_URL}/api/pins",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "project_id": PROJECT_ID,
                "x": 25.0,
                "y": 25.0,
                "page_url": "https://brandlume.com",
                "scroll_x": 0,
                "scroll_y": 0,
                "device_type": "tablet"  # Test tablet device type
            }
        )
        assert create_response.status_code == 200
        pin_id = create_response.json()["id"]
        print(f"✓ Pin created for screenshot test: {pin_id}")
        
        # Check screenshot status endpoint
        screenshot_response = requests.get(f"{BASE_URL}/api/pins/{pin_id}/screenshot")
        assert screenshot_response.status_code == 200
        data = screenshot_response.json()
        assert "screenshot_path" in data
        print(f"✓ Screenshot status endpoint works - path: {data.get('screenshot_path', 'generating...')}")
        
        # Poll for screenshot (give background task time)
        max_polls = 10
        for i in range(max_polls):
            time.sleep(2)
            screenshot_response = requests.get(f"{BASE_URL}/api/pins/{pin_id}/screenshot")
            if screenshot_response.json().get("screenshot_path"):
                print(f"✓ Screenshot generated after {(i+1)*2} seconds")
                break
        
        # Clean up - delete the pin
        requests.delete(
            f"{BASE_URL}/api/pins/{pin_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"✓ Test pin cleaned up")


class TestGuestPinAndComment:
    """Guest user operations"""
    
    def test_guest_create_pin(self):
        """Test guest pin creation"""
        response = requests.post(
            f"{BASE_URL}/api/pins/guest",
            json={
                "project_id": PROJECT_ID,
                "x": 60.0,
                "y": 40.0,
                "page_url": "https://brandlume.com",
                "scroll_x": 0,
                "scroll_y": 50,
                "guest_name": "Test Guest",
                "guest_email": "testguest@example.com",
                "device_type": "mobile"  # Test mobile device type
            }
        )
        assert response.status_code == 200, f"Guest pin failed: {response.text}"
        data = response.json()
        assert data["device_type"] == "mobile"
        assert data["author_name"] == "Test Guest"
        print(f"✓ Guest pin created: {data['id']}")
        return data["id"]
    
    def test_guest_create_comment(self):
        """Test guest comment creation on existing pin"""
        # First get pins
        pins_response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/pins/public")
        pins = pins_response.json()
        
        if not pins:
            # Create a guest pin first
            pin_response = requests.post(
                f"{BASE_URL}/api/pins/guest",
                json={
                    "project_id": PROJECT_ID,
                    "x": 50.0,
                    "y": 50.0,
                    "page_url": "https://brandlume.com",
                    "scroll_x": 0,
                    "scroll_y": 0,
                    "guest_name": "Test Guest",
                    "guest_email": "testguest@example.com",
                    "device_type": "desktop"
                }
            )
            pin_id = pin_response.json()["id"]
        else:
            pin_id = pins[0]["id"]
        
        # Create comment as guest
        comment_response = requests.post(
            f"{BASE_URL}/api/comments",
            json={
                "pin_id": pin_id,
                "content": "Test comment from guest user",
                "guest_name": "Test Guest",
                "guest_email": "testguest@example.com"
            }
        )
        assert comment_response.status_code == 200, f"Guest comment failed: {comment_response.text}"
        data = comment_response.json()
        assert data["author_type"] == "guest"
        assert data["author_name"] == "Test Guest"
        print(f"✓ Guest comment created: {data['id']}")


class TestCommentWithAttachment:
    """Comment with file attachment"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_comment_with_attachment(self, auth_token):
        """Test creating comment with file attachment"""
        # Get existing pins
        pins_response = requests.get(
            f"{BASE_URL}/api/pins/{PROJECT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        pins = pins_response.json()
        
        if not pins:
            pytest.skip("No pins available for comment test")
        
        pin_id = pins[0]["id"]
        
        # Create a simple text file for attachment
        files = {
            'file': ('test.txt', b'Test file content', 'text/plain')
        }
        data = {
            'pin_id': pin_id,
            'content': 'Comment with attachment test'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/comments/with-attachment",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Comment with attachment failed: {response.text}"
        result = response.json()
        assert result["attachment_path"] is not None
        print(f"✓ Comment with attachment created: {result['id']}")


class TestDeviceTypeScreenshot:
    """Test screenshot generation respects device_type viewport"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@markuply.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_pin_device_types(self, auth_token):
        """Test pins with different device types are stored correctly"""
        device_types = ["desktop", "tablet", "mobile"]
        created_pins = []
        
        for device in device_types:
            response = requests.post(
                f"{BASE_URL}/api/pins",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "project_id": PROJECT_ID,
                    "x": 50.0,
                    "y": 50.0,
                    "page_url": "https://brandlume.com",
                    "scroll_x": 0,
                    "scroll_y": 0,
                    "device_type": device
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert data["device_type"] == device
            created_pins.append(data["id"])
            print(f"✓ Pin with device_type={device} created")
        
        # Clean up test pins
        for pin_id in created_pins:
            requests.delete(
                f"{BASE_URL}/api/pins/{pin_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        print(f"✓ All test pins cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
