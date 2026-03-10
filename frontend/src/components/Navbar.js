import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { LogOut, LayoutDashboard, Settings, Shield, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useState, useEffect } from 'react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Check for guest info in localStorage
  const [guestName, setGuestName] = useState(null);
  
  useEffect(() => {
    const storedName = localStorage.getItem('markuply_guest_name');
    if (storedName && !user) {
      setGuestName(storedName);
    }
    
    // Listen for guest updates from ProjectCanvas
    const handleGuestUpdate = (e) => {
      if (e.detail?.name) {
        setGuestName(e.detail.name);
      }
    };
    window.addEventListener('markuply_guest_update', handleGuestUpdate);
    return () => window.removeEventListener('markuply_guest_update', handleGuestUpdate);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleGuestLogout = () => {
    localStorage.removeItem('markuply_guest_name');
    localStorage.removeItem('markuply_guest_email');
    setGuestName(null);
    navigate('/');
  };

  return (
    <nav className="border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-16">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Markuply
            </span>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                  <Avatar data-testid="user-avatar">
                    <AvatarFallback className="bg-accent text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/dashboard')} data-testid="nav-dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                {user.role === 'owner' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')} data-testid="nav-admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="nav-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : guestName ? (
            // Guest user - show their name
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                  <Avatar data-testid="guest-avatar">
                    <AvatarFallback className="bg-secondary text-foreground">
                      {guestName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-medium">{guestName}</p>
                    <p className="text-xs text-muted-foreground">Guest</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/guest-projects')} data-testid="nav-guest-projects">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  My Projects
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/auth')} data-testid="nav-login">
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleGuestLogout} data-testid="nav-guest-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Clear Guest Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                data-testid="nav-login-btn"
              >
                Login
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
                data-testid="nav-signup-btn"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;