import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, FileText, Image, Globe, Trash2, Link2, Search, MessageSquare, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('url');
  const [contentUrl, setContentUrl] = useState('');
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
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
      setCreateMode(false);
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

  const handleShareProject = (projectId) => {
    const shareUrl = `${window.location.origin}/project/${projectId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Shareable link copied to clipboard!');
  };

  const resetForm = () => {
    setProjectName('');
    setProjectType('url');
    setContentUrl('');
    setFile(null);
  };

  const getProjectIcon = (type) => {
    switch (type) {
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'image': return <Image className="w-5 h-5" />;
      case 'url': return <Globe className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter(project => {
      if (!searchQuery.trim()) return true;
      return project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             project.content_url?.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="dashboard-heading">
              Projects
            </h1>
            <p className="text-muted-foreground">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <Button
            onClick={() => setCreateMode(!createMode)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-6"
            data-testid="create-project-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createMode ? 'Cancel' : 'New Project'}
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-projects"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48" data-testid="sort-projects">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Create Form */}
        {createMode && (
          <Card className="mb-8 border-border/40 border-2 border-accent/20">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label>Type</Label>
                    <Tabs value={projectType} onValueChange={setProjectType} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="url" data-testid="type-tab-url">
                          <Globe className="w-4 h-4 mr-2" />
                          URL
                        </TabsTrigger>
                        <TabsTrigger value="pdf" data-testid="type-tab-pdf">
                          <FileText className="w-4 h-4 mr-2" />
                          PDF
                        </TabsTrigger>
                        <TabsTrigger value="image" data-testid="type-tab-image">
                          <Image className="w-4 h-4 mr-2" />
                          Image
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
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
                    {file && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {file.name}
                      </p>
                    )}
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
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        {filteredAndSortedProjects.length === 0 ? (
          <Card className="border-dashed border-2 border-border/40">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? 'Try a different search term' : 'Create your first project to start collecting feedback'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setCreateMode(true)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                  data-testid="empty-create-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <Card
                key={project.id}
                className="border-border/40 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => navigate(`/project/${project.id}`)}
                data-testid={`project-card-${project.id}`}
              >
                {/* Thumbnail Preview */}
                <div className="relative h-48 bg-secondary/50 overflow-hidden">
                  {project.thumbnail_path ? (
                    <img
                      src={`${BACKEND_URL}/api/files/screenshots/${project.thumbnail_path.split('/').pop()}`}
                      alt={project.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.querySelector('.fallback-icon').style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center fallback-icon ${project.thumbnail_path ? 'hidden' : ''}`}>
                    <div className="text-center text-muted-foreground">
                      {getProjectIcon(project.type)}
                      <p className="text-xs mt-2">{project.type.toUpperCase()}</p>
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareProject(project.id);
                      }}
                      className="h-8 w-8 p-0"
                      data-testid={`share-project-${project.id}`}
                    >
                      <Link2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="h-8 w-8 p-0"
                      data-testid={`delete-project-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Project Info */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-accent transition-colors" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {project.name}
                  </h3>
                  {project.content_url && (
                    <p className="text-xs text-muted-foreground truncate mb-2">
                      {project.content_url}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {new Date(project.created_at).toLocaleDateString()}</span>
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