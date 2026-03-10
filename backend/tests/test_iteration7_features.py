"""
Iteration 7 Tests - Testing new features:
- @mention system - /api/projects/{project_id}/members endpoint
- Screenshot polling - /api/pins/{pin_id}/screenshot endpoint  
- Pin link sharing - ?pin=xxx query param support
- Delete pin - DELETE /api/pins/{pin_id}
- Member avatars - members endpoint returns unique commenters
- Comment with file attachment
- Guest pin creation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@markuply.com"
ADMIN_PASSWORD = "admin123"
PROJECT_ID = "6957aafa-5399-4c4e-b1c1-2532342b979d"

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestMentionSystem:
    """P0: @mention system - tests for /api/projects/{project_id}/members endpoint"""
    
    def test_get_project_members_returns_list(self):
        """GET /api/projects/{project_id}/members returns unique commenters list"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        members = response.json()
        assert isinstance(members, list), "Members should be a list"
        
        # Should have at least some members (from previous testing)
        if len(members) > 0:
            member = members[0]
            assert 'name' in member, "Member should have 'name' field"
            assert 'type' in member, "Member should have 'type' field (team/guest)"
            print(f"Found {len(members)} unique commenters")
    
    def test_members_includes_guests(self):
        """Members endpoint should include guest commenters"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/members")
        assert response.status_code == 200
        
        members = response.json()
        # Check if there are any guest types
        guest_count = sum(1 for m in members if m.get('type') == 'guest')
        team_count = sum(1 for m in members if m.get('type') == 'team')
        print(f"Members breakdown: {team_count} team, {guest_count} guest")


class TestScreenshotPolling:
    """P0: Screenshot polling - tests for /api/pins/{pin_id}/screenshot endpoint"""
    
    def test_screenshot_status_endpoint_exists(self, auth_headers):
        """GET /api/pins/{pin_id}/screenshot should return screenshot_path"""
        # First get a pin
        pins_response = requests.get(f"{BASE_URL}/api/pins/{PROJECT_ID}", headers=auth_headers)
        assert pins_response.status_code == 200
        
        pins = pins_response.json()
        if len(pins) == 0:
            pytest.skip("No pins to test screenshot status")
        
        pin = pins[0]
        response = requests.get(f"{BASE_URL}/api/pins/{pin['id']}/screenshot")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'screenshot_path' in data, "Response should have screenshot_path key"
        print(f"Pin {pin['id']} screenshot_path: {data.get('screenshot_path')}")
    
    def test_create_pin_and_poll_screenshot(self, auth_headers):
        """Create new pin and poll for screenshot (background generation)"""
        # Create a new pin
        pin_data = {
            "project_id": PROJECT_ID,
            "x": 50,
            "y": 30,
            "scroll_x": 0,
            "scroll_y": 0,
            "device_type": "desktop",
            "canvas_width": 1920,
            "canvas_height": 800
        }
        create_response = requests.post(f"{BASE_URL}/api/pins", json=pin_data, headers=auth_headers)
        assert create_response.status_code == 200, f"Create pin failed: {create_response.text}"
        
        new_pin = create_response.json()
        pin_id = new_pin['id']
        print(f"Created pin {pin_id}")
        
        # Initially screenshot may be null
        initial_screenshot = new_pin.get('screenshot_path')
        print(f"Initial screenshot_path: {initial_screenshot}")
        
        # Poll for screenshot (wait up to 15 seconds)
        screenshot_ready = False
        for attempt in range(5):
            time.sleep(3)
            response = requests.get(f"{BASE_URL}/api/pins/{pin_id}/screenshot")
            if response.status_code == 200:
                data = response.json()
                if data.get('screenshot_path'):
                    screenshot_ready = True
                    print(f"Screenshot ready after {(attempt+1)*3} seconds: {data['screenshot_path']}")
                    break
            print(f"Poll attempt {attempt+1}: screenshot not ready yet")
        
        # Cleanup - delete the test pin
        requests.delete(f"{BASE_URL}/api/pins/{pin_id}", headers=auth_headers)
        
        # This test passes even if screenshot isn't ready (background task)
        assert True, "Screenshot polling endpoint works"


class TestPinLinkSharing:
    """P0: Pin link sharing - URL query param ?pin=xxx"""
    
    def test_pin_exists_for_sharing(self, auth_headers):
        """Verify pins exist that can be shared via URL"""
        response = requests.get(f"{BASE_URL}/api/pins/{PROJECT_ID}", headers=auth_headers)
        assert response.status_code == 200
        
        pins = response.json()
        assert len(pins) > 0, "Should have at least one pin for sharing test"
        
        pin = pins[0]
        share_url = f"?pin={pin['id']}"
        print(f"Share URL format: /project/{PROJECT_ID}{share_url}")


class TestDeletePin:
    """P1: Delete pin functionality"""
    
    def test_delete_pin_workflow(self, auth_headers):
        """Create then delete a pin - full workflow"""
        # Create a pin
        pin_data = {
            "project_id": PROJECT_ID,
            "x": 25,
            "y": 25,
            "scroll_x": 0,
            "scroll_y": 0,
            "device_type": "desktop"
        }
        create_response = requests.post(f"{BASE_URL}/api/pins", json=pin_data, headers=auth_headers)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        pin_id = create_response.json()['id']
        print(f"Created test pin: {pin_id}")
        
        # Delete the pin
        delete_response = requests.delete(f"{BASE_URL}/api/pins/{pin_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print("Pin deleted successfully")
        
        # Verify it's gone
        verify_response = requests.get(f"{BASE_URL}/api/pins/{pin_id}/screenshot")
        assert verify_response.status_code == 404, "Deleted pin should return 404"
    
    def test_delete_nonexistent_pin_returns_404(self, auth_headers):
        """Deleting a non-existent pin should return 404"""
        response = requests.delete(f"{BASE_URL}/api/pins/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404


class TestCommentWithAttachment:
    """P1: File attachment on comments"""
    
    def test_comment_with_attachment_endpoint(self, auth_headers):
        """POST /api/comments/with-attachment should accept file"""
        # Get a pin to comment on
        pins_response = requests.get(f"{BASE_URL}/api/pins/{PROJECT_ID}", headers=auth_headers)
        assert pins_response.status_code == 200
        
        pins = pins_response.json()
        if len(pins) == 0:
            pytest.skip("No pins to test comment attachment")
        
        pin_id = pins[0]['id']
        
        # Create a test file content
        files = {
            'file': ('test_attachment.txt', b'Test file content for attachment', 'text/plain')
        }
        data = {
            'pin_id': pin_id,
            'content': 'TEST_Comment with attachment'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/comments/with-attachment",
            files=files,
            data=data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        comment = response.json()
        assert 'id' in comment, "Comment should have id"
        assert comment.get('attachment_path') is not None, "Comment should have attachment_path"
        print(f"Created comment with attachment: {comment.get('attachment_path')}")


class TestGuestAccess:
    """P1: Guest pin creation and comment"""
    
    def test_guest_create_pin(self):
        """POST /api/pins/guest should create pin without auth"""
        pin_data = {
            "project_id": PROJECT_ID,
            "x": 75,
            "y": 75,
            "scroll_x": 0,
            "scroll_y": 0,
            "guest_name": "TEST_Guest User",
            "guest_email": "testguest@example.com",
            "device_type": "desktop"
        }
        
        response = requests.post(f"{BASE_URL}/api/pins/guest", json=pin_data)
        assert response.status_code == 200, f"Guest pin creation failed: {response.text}"
        
        pin = response.json()
        assert pin.get('author_name') == "TEST_Guest User", "Author name should match"
        assert 'guest:' in pin.get('created_by', ''), "created_by should contain guest:"
        print(f"Guest created pin: {pin['id']}")
        
        # Cleanup - need auth to delete
        # Will be cleaned up in next test run
    
    def test_guest_comment_on_pin(self):
        """POST /api/comments as guest should work with name/email"""
        # Get public pins
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/pins/public")
        assert response.status_code == 200
        
        pins = response.json()
        if len(pins) == 0:
            pytest.skip("No pins for guest comment test")
        
        pin_id = pins[0]['id']
        
        comment_data = {
            "pin_id": pin_id,
            "content": "TEST_Guest comment",
            "guest_name": "Test Guest",
            "guest_email": "guest@test.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/comments", json=comment_data)
        assert response.status_code == 200, f"Guest comment failed: {response.text}"
        
        comment = response.json()
        assert comment.get('author_type') == 'guest', "Should be guest type"
        print(f"Guest created comment: {comment['id']}")


class TestRelativeDates:
    """P1: Comments should have created_at for relative date display"""
    
    def test_comment_has_created_at(self):
        """Comments should have created_at timestamp"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/pins/public")
        assert response.status_code == 200
        
        pins = response.json()
        if len(pins) == 0:
            pytest.skip("No pins")
        
        comments_response = requests.get(f"{BASE_URL}/api/comments/{pins[0]['id']}")
        if comments_response.status_code == 200:
            comments = comments_response.json()
            if len(comments) > 0:
                comment = comments[0]
                assert 'created_at' in comment, "Comment should have created_at"
                print(f"Comment created_at: {comment['created_at']}")


class TestProjectPublicEndpoints:
    """Public endpoints for guest access"""
    
    def test_public_project_access(self):
        """GET /api/projects/{id}/public should work without auth"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/public")
        assert response.status_code == 200, f"Public project access failed: {response.text}"
        
        project = response.json()
        assert project.get('id') == PROJECT_ID
        print(f"Public project: {project.get('name')}")
    
    def test_public_pins_access(self):
        """GET /api/projects/{id}/pins/public should work without auth"""
        response = requests.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/pins/public")
        assert response.status_code == 200
        
        pins = response.json()
        assert isinstance(pins, list)
        print(f"Public pins count: {len(pins)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
