import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, FileText, Image, Globe, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('url');
  const [contentUrl, setContentUrl] = useState('');
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, teamRes] = await Promise.all([
        axios.get(`${API}/projects`, { headers: getAuthHeaders() }),
        axios.get(`${API}/teams/me`, { headers: getAuthHeaders() })
      ]);
      setProjects(projectsRes.data);
      setTeam(teamRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const formData = new FormData();
      formData.append('name', projectName);
      formData.append('type', projectType);
      
      if (projectType === 'url') {
        if (!contentUrl.trim()) {
          toast.error('Please enter a URL');
          setCreating(false);
          return;
        }
        formData.append('content_url', contentUrl);
      } else {
        if (!file) {
          toast.error('Please select a file');
          setCreating(false);
          return;
        }
        formData.append('file', file);
      }

      const response = await axios.post(`${API}/projects`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      setProjects([response.data, ...projects]);
      toast.success('Project created successfully!');
      setCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error(error.response?.data?.detail || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await axios.delete(`${API}/projects/${projectId}`, { headers: getAuthHeaders() });
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  const resetForm = () => {
    setProjectName('');
    setProjectType('url');
    setContentUrl('');
    setFile(null);
  };

  const getProjectIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-accent" />;
      case 'image':
        return <Image className="w-8 h-8 text-accent" />;
      case 'url':
        return <Globe className="w-8 h-8 text-accent" />;
      default:
        return <FileText className="w-8 h-8 text-accent" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="dashboard-heading">
              Projects
            </h1>
            <p className="text-muted-foreground">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
                data-testid="create-project-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="create-project-dialog">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Upload a file or enter a URL to start reviewing
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="My Design Review"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    data-testid="project-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-type">Type</Label>
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger data-testid="project-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="url" data-testid="type-option-url">Website URL</SelectItem>
                      <SelectItem value="pdf" data-testid="type-option-pdf">PDF Document</SelectItem>
                      <SelectItem value="image" data-testid="type-option-image">Image (JPG/PNG)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {projectType === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="content-url">Website URL</Label>
                    <Input
                      id="content-url"
                      type="url"
                      placeholder="https://example.com"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                      required
                      data-testid="project-url-input"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Upload File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept={projectType === 'pdf' ? '.pdf' : 'image/jpeg,image/png,image/jpg'}
                      onChange={(e) => setFile(e.target.files[0])}
                      required
                      data-testid="project-file-input"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                  data-testid="project-submit-btn"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Plan Info */}
        {team && (
          <Card className="mb-8 border-border/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                  <p className="text-2xl font-bold capitalize" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {team.plan}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Team Members</p>
                  <p className="text-2xl font-bold">
                    {team.member_count} / {team.member_limit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                  <p className="text-2xl font-bold">
                    {team.storage_used_mb.toFixed(1)} MB / {team.storage_limit_mb} MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="border-dashed border-2 border-border/40">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                No projects yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first project to start collecting feedback
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                data-testid="empty-create-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border-border/40 hover:shadow-md transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/project/${project.id}`)}
                data-testid={`project-card-${project.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                        {getProjectIcon(project.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-accent transition-colors">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="capitalize">
                          {project.type}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`delete-project-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}