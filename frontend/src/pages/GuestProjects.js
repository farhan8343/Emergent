import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { Card, CardContent } from '../components/ui/card';
import { Globe, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to format relative time
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

export default function GuestProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const guestName = localStorage.getItem('markuply_guest_name');
  const guestEmail = localStorage.getItem('markuply_guest_email');

  useEffect(() => {
    if (!guestEmail) {
      toast.error('No guest session found');
      navigate('/');
      return;
    }
    
    fetchGuestProjects();
  }, [guestEmail, navigate]);

  const fetchGuestProjects = async () => {
    try {
      const response = await axios.get(`${API}/guest/projects?email=${encodeURIComponent(guestEmail)}`);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch guest projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-pulse text-muted-foreground">Loading your projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Welcome back, {guestName}!
          </h1>
          <p className="text-muted-foreground">
            Projects where you've added comments
          </p>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                You haven't commented on any projects yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border-border/40 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="relative h-40 bg-secondary/50 overflow-hidden">
                  {project.thumbnail_path ? (
                    <img
                      src={`${BACKEND_URL}/api/files/screenshots/${project.thumbnail_path.split('/').pop()}`}
                      alt={project.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Globe className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  {project.content_url && (
                    <p className="text-xs text-muted-foreground truncate mb-2">
                      {project.content_url}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatRelativeTime(project.created_at)}</span>
                    <span className="flex items-center">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {project.comment_count || 0} comments
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
