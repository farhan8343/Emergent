#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Markuply
Tests all endpoints including auth, teams, projects, pins, comments, and admin functionality
"""

import requests
import sys
import json
import os
from datetime import datetime
from pathlib import Path

class MarkuplyAPITester:
    def __init__(self, base_url="https://reviewpin.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user = None
        self.team = None
        self.test_project_id = None
        self.test_pin_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.critical_issues = []

    def log_result(self, test_name, success, response_data=None, error_msg=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {error_msg}")
            self.failed_tests.append({
                'test': test_name,
                'error': error_msg,
                'response': response_data
            })

    def make_request(self, method, endpoint, data=None, files=None, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            # Remove Content-Type for multipart/form-data
            headers.pop('Content-Type', None)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            return None

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        test_data = {
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        response = self.make_request('POST', 'auth/register', test_data, auth_required=False)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'token' in data and 'user' in data:
                self.token = data['token']
                self.user = data['user']
                self.log_result("User Registration", True)
                return True
            else:
                self.log_result("User Registration", False, data, "Missing token or user in response")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("User Registration", False, None, error_msg)
            self.critical_issues.append("User registration failed - blocking all other tests")
        
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.user:
            return False
            
        login_data = {
            "email": self.user['email'],
            "password": "TestPass123!"
        }
        
        response = self.make_request('POST', 'auth/login', login_data, auth_required=False)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'token' in data:
                self.log_result("User Login", True)
                return True
            else:
                self.log_result("User Login", False, data, "Missing token in response")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("User Login", False, None, error_msg)
        
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        response = self.make_request('GET', 'auth/me')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'email' in data:
                self.log_result("Get Current User", True)
                return True
            else:
                self.log_result("Get Current User", False, data, "Missing user data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Current User", False, None, error_msg)
        
        return False

    def test_get_team_info(self):
        """Test getting team information"""
        response = self.make_request('GET', 'teams/me')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'plan' in data:
                self.team = data
                self.log_result("Get Team Info", True)
                return True
            else:
                self.log_result("Get Team Info", False, data, "Missing team data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Team Info", False, None, error_msg)
        
        return False

    def test_create_url_project(self):
        """Test creating a URL project"""
        project_data = {
            'name': 'Test URL Project',
            'type': 'url',
            'content_url': 'https://example.com'
        }
        
        response = self.make_request('POST', 'projects', data=project_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data['type'] == 'url':
                self.test_project_id = data['id']
                self.log_result("Create URL Project", True)
                return True
            else:
                self.log_result("Create URL Project", False, data, "Missing project data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Create URL Project", False, None, error_msg)
        
        return False

    def test_get_projects(self):
        """Test getting projects list"""
        response = self.make_request('GET', 'projects')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Get Projects List", True)
                return True
            else:
                self.log_result("Get Projects List", False, data, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Projects List", False, None, error_msg)
        
        return False

    def test_get_single_project(self):
        """Test getting a single project"""
        if not self.test_project_id:
            self.log_result("Get Single Project", False, None, "No test project ID available")
            return False
            
        response = self.make_request('GET', f'projects/{self.test_project_id}')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data['id'] == self.test_project_id:
                self.log_result("Get Single Project", True)
                return True
            else:
                self.log_result("Get Single Project", False, data, "Project data mismatch")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Single Project", False, None, error_msg)
        
        return False

    def test_create_pin(self):
        """Test creating a pin on project"""
        if not self.test_project_id:
            self.log_result("Create Pin", False, None, "No test project ID available")
            return False
            
        pin_data = {
            'project_id': self.test_project_id,
            'x': 50.0,
            'y': 30.0
        }
        
        response = self.make_request('POST', 'pins', pin_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data['project_id'] == self.test_project_id:
                self.test_pin_id = data['id']
                self.log_result("Create Pin", True)
                return True
            else:
                self.log_result("Create Pin", False, data, "Missing pin data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Create Pin", False, None, error_msg)
        
        return False

    def test_get_pins(self):
        """Test getting pins for project"""
        if not self.test_project_id:
            self.log_result("Get Pins", False, None, "No test project ID available")
            return False
            
        response = self.make_request('GET', f'pins/{self.test_project_id}')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Get Pins", True)
                return True
            else:
                self.log_result("Get Pins", False, data, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Pins", False, None, error_msg)
        
        return False

    def test_update_pin_status(self):
        """Test updating pin status"""
        if not self.test_pin_id:
            self.log_result("Update Pin Status", False, None, "No test pin ID available")
            return False
            
        response = self.make_request('PUT', f'pins/{self.test_pin_id}/status?status=resolved')
        
        if response and response.status_code == 200:
            self.log_result("Update Pin Status", True)
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Update Pin Status", False, None, error_msg)
        
        return False

    def test_create_team_comment(self):
        """Test creating a comment as team member"""
        if not self.test_pin_id:
            self.log_result("Create Team Comment", False, None, "No test pin ID available")
            return False
            
        comment_data = {
            'pin_id': self.test_pin_id,
            'content': 'This is a test comment from team member'
        }
        
        response = self.make_request('POST', 'comments', comment_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data['author_type'] == 'team':
                self.log_result("Create Team Comment", True)
                return True
            else:
                self.log_result("Create Team Comment", False, data, "Missing comment data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Create Team Comment", False, None, error_msg)
        
        return False

    def test_create_guest_comment(self):
        """Test creating a comment as guest"""
        if not self.test_pin_id:
            self.log_result("Create Guest Comment", False, None, "No test pin ID available")
            return False
            
        comment_data = {
            'pin_id': self.test_pin_id,
            'content': 'This is a test comment from guest user',
            'guest_name': 'Guest Tester',
            'guest_email': 'guest@example.com'
        }
        
        response = self.make_request('POST', 'comments', comment_data, auth_required=False)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data['author_type'] == 'guest':
                self.log_result("Create Guest Comment", True)
                return True
            else:
                self.log_result("Create Guest Comment", False, data, "Missing comment data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Create Guest Comment", False, None, error_msg)
        
        return False

    def test_get_comments(self):
        """Test getting comments for pin"""
        if not self.test_pin_id:
            self.log_result("Get Comments", False, None, "No test pin ID available")
            return False
            
        response = self.make_request('GET', f'comments/{self.test_pin_id}', auth_required=False)
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Get Comments", True)
                return True
            else:
                self.log_result("Get Comments", False, data, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Comments", False, None, error_msg)
        
        return False

    def test_admin_stats(self):
        """Test admin statistics endpoint"""
        response = self.make_request('GET', 'admin/stats')
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ['total_projects', 'total_pins', 'total_comments', 'storage_used_mb']
            if all(field in data for field in required_fields):
                self.log_result("Admin Stats", True)
                return True
            else:
                self.log_result("Admin Stats", False, data, "Missing required stats fields")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Admin Stats", False, None, error_msg)
        
        return False

    def test_team_members(self):
        """Test getting team members"""
        response = self.make_request('GET', 'teams/members')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Get Team Members", True)
                return True
            else:
                self.log_result("Get Team Members", False, data, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Team Members", False, None, error_msg)
        
        return False

    def test_invite_member(self):
        """Test inviting a team member"""
        invite_data = {
            'email': f'invite_test_{datetime.now().strftime("%H%M%S")}@example.com'
        }
        
        response = self.make_request('POST', 'teams/invite', invite_data)
        
        if response and response.status_code == 200:
            self.log_result("Invite Team Member", True)
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Invite Team Member", False, None, error_msg)
        
        return False

    def test_update_plan(self):
        """Test updating subscription plan"""
        response = self.make_request('PUT', 'teams/plan?plan=pro')
        
        if response and response.status_code == 200:
            self.log_result("Update Plan", True)
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Update Plan", False, None, error_msg)
        
        return False

    def test_admin_guests(self):
        """Test getting guest commenters"""
        response = self.make_request('GET', 'admin/guests')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Get Admin Guests", True)
                return True
            else:
                self.log_result("Get Admin Guests", False, data, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Get Admin Guests", False, None, error_msg)
        
        return False

    def test_delete_project(self):
        """Test deleting a project"""
        if not self.test_project_id:
            self.log_result("Delete Project", False, None, "No test project ID available")
            return False
            
        response = self.make_request('DELETE', f'projects/{self.test_project_id}')
        
        if response and response.status_code == 200:
            self.log_result("Delete Project", True)
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'Request failed'
            self.log_result("Delete Project", False, None, error_msg)
        
        return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Markuply Backend API Tests")
        print("=" * 50)
        
        # Authentication Tests
        print("\n📝 Authentication Tests")
        if not self.test_user_registration():
            return False
        
        self.test_user_login()
        self.test_get_current_user()
        
        # Team Tests
        print("\n👥 Team Management Tests")
        self.test_get_team_info()
        self.test_team_members()
        self.test_invite_member()
        self.test_update_plan()
        
        # Project Tests
        print("\n📁 Project Management Tests")
        self.test_create_url_project()
        self.test_get_projects()
        self.test_get_single_project()
        
        # Pin Tests
        print("\n📌 Pin Management Tests")
        self.test_create_pin()
        self.test_get_pins()
        self.test_update_pin_status()
        
        # Comment Tests
        print("\n💬 Comment System Tests")
        self.test_create_team_comment()
        self.test_create_guest_comment()
        self.test_get_comments()
        
        # Admin Tests
        print("\n🔧 Admin Panel Tests")
        self.test_admin_stats()
        self.test_admin_guests()
        
        # Cleanup
        print("\n🧹 Cleanup Tests")
        self.test_delete_project()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.critical_issues:
            print("\n🚨 CRITICAL ISSUES:")
            for issue in self.critical_issues:
                print(f"  - {issue}")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return len(self.failed_tests) == 0

def main():
    tester = MarkuplyAPITester()
    
    try:
        success = tester.run_all_tests()
        all_passed = tester.print_summary()
        
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())