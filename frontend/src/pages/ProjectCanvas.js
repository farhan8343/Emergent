import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Check, MessageSquare, X, Monitor, Tablet, Smartphone, Share2, Eye, MessageCircle, Search, ArrowUpDown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProjectCanvas() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('browse');
  const [viewportSize, setViewportSize] = useState('desktop');
  const [commentFilter, setCommentFilter] = useState('all'); // 'all', 'open', 'resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'
  const canvasRef = useRef(null);
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  // Fetch project data only once on mount
  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]); // Only depend on id

  // Fetch comments when selectedPin changes
  useEffect(() => {
    if (selectedPin?.id) {
      fetchComments(selectedPin.id);
    } else {
      setComments([]);
    }
  }, [selectedPin?.id]); // Only depend on pin id

  const fetchProject = async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}`, {
        headers: getAuthHeaders()
      });
      setProject(response.data);
      await fetchPins(id);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchPins = async (projectId) => {
    try {
      const response = await axios.get(`${API}/pins/${projectId}`, {
        headers: getAuthHeaders()
      });
      setPins(response.data);
    } catch (error) {
      console.error('Failed to fetch pins:', error);
    }
  };

  const fetchComments = async (pinId) => {
    try {
      const response = await axios.get(`${API}/comments/${pinId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleCanvasClick = async (e) => {
    // Only create pins in comment mode and if user is authenticated
    if (mode !== 'comment' || !canvasRef.current || !user) {
      if (mode === 'comment' && !user) {
        toast.error('Please login to add pins');
      }
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    try {
      const response = await axios.post(
        `${API}/pins`,
        { project_id: id, x, y },
        { headers: getAuthHeaders() }
      );
      const newPin = response.data;
      setPins(prevPins => [...prevPins, newPin]);
      setSelectedPin(newPin);
      toast.success('Pin created');
    } catch (error) {
      console.error('Failed to create pin:', error);
      toast.error(error.response?.data?.detail || 'Failed to create pin');
    }
  };

  const handlePinClick = (pin, e) => {
    e.stopPropagation();
    if (mode === 'comment') {
      setSelectedPin(pin);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedPin) return;

    if (!user && (!guestName.trim() || !guestEmail.trim())) {
      toast.error('Please enter your name and email');
      return;
    }

    try {
      const payload = {
        pin_id: selectedPin.id,
        content: newComment
      };

      if (!user) {
        payload.guest_name = guestName;
        payload.guest_email = guestEmail;
      }

      const response = await axios.post(`${API}/comments`, payload, {
        headers: user ? getAuthHeaders() : {}
      });

      setComments(prevComments => [...prevComments, response.data]);
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleResolvePin = async () => {
    if (!selectedPin || !user) return;

    try {
      const newStatus = selectedPin.status === 'open' ? 'resolved' : 'open';
      await axios.put(
        `${API}/pins/${selectedPin.id}/status?status=${newStatus}`,
        {},
        { headers: getAuthHeaders() }
      );

      setPins(prevPins => prevPins.map(p => 
        p.id === selectedPin.id ? { ...p, status: newStatus } : p
      ));
      setSelectedPin(prev => ({ ...prev, status: newStatus }));
      toast.success(`Pin ${newStatus}`);
    } catch (error) {
      console.error('Failed to update pin status:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/project/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Shareable link copied to clipboard!');
  };

  const getViewportWidth = () => {
    switch (viewportSize) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  // Filter pins by status
  const filteredPins = useMemo(() => {
    if (commentFilter === 'all') return pins;
    return pins.filter(pin => pin.status === commentFilter);
  }, [pins, commentFilter]);

  // Filter and sort comments
  const filteredAndSortedComments = useMemo(() => {
    let filtered = comments;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(comment =>
        comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.author_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [comments, searchQuery, sortOrder]);

  // Count pins by status
  const pinCounts = useMemo(() => {
    return {
      all: pins.length,
      open: pins.filter(p => p.status === 'open').length,
      resolved: pins.filter(p => p.status === 'resolved').length
    };
  }, [pins]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navbar />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Comments Sidebar - LEFT */}
        <div className="w-80 bg-white border-r border-border/40 flex flex-col" data-testid="comments-sidebar">
          {/* Pin Filter Tabs */}
          <div className="p-3 border-b border-border/40">
            <Tabs value={commentFilter} onValueChange={setCommentFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs" data-testid="filter-all">
                  All ({pinCounts.all})
                </TabsTrigger>
                <TabsTrigger value="open" className="text-xs" data-testid="filter-pending">
                  Pending ({pinCounts.open})
                </TabsTrigger>
                <TabsTrigger value="resolved" className="text-xs" data-testid="filter-resolved">
                  Resolved ({pinCounts.resolved})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {selectedPin && mode === 'comment' ? (
            <>
              <div className="p-4 border-b border-border/40">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      Pin #{pins.findIndex(p => p.id === selectedPin.id) + 1}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {selectedPin.status}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {user && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResolvePin}
                        data-testid="resolve-pin-btn"
                      >
                        {selectedPin.status === 'open' ? 'Resolve' : 'Reopen'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedPin(null)}
                      data-testid="close-pin-btn"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Search and Sort */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                      data-testid="search-comments"
                    />
                  </div>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger className="h-9" data-testid="sort-comments">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {filteredAndSortedComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery ? 'No comments found' : 'No comments yet. Be the first to comment!'}
                    </p>
                  ) : (
                    filteredAndSortedComments.map((comment) => (
                      <Card key={comment.id} className="p-3 border-border/40" data-testid={`comment-${comment.id}`}>
                        <div className="flex items-start space-x-2">
                          <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-accent">
                              {comment.author_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-sm font-semibold">{comment.author_name}</p>
                              {comment.author_type === 'guest' && (
                                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                                  Guest
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground">{comment.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(comment.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border/40">
                <form onSubmit={handleAddComment} className="space-y-3">
                  {!user && (
                    <>
                      <Input
                        placeholder="Your name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                        data-testid="guest-name-input"
                      />
                      <Input
                        type="email"
                        placeholder="Your email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                        data-testid="guest-email-input"
                      />
                    </>
                  )}
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                    rows={3}
                    data-testid="comment-input"
                  />
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                    data-testid="add-comment-btn"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Add Comment
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {mode === 'browse' ? 'Switch to Comment Mode' : 'Select a pin'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {mode === 'browse' 
                    ? 'Click Comment tab to add feedback'
                    : 'Click on a pin to view and add comments'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Area - CENTER */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b border-border/40 p-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                data-testid="canvas-back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border"></div>
              <h1 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="project-title">
                {project.name}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {/* Mode Tabs */}
              <Tabs value={mode} onValueChange={setMode} className="w-auto">
                <TabsList className="bg-secondary">
                  <TabsTrigger value="browse" className="flex items-center space-x-2" data-testid="browse-tab">
                    <Eye className="w-4 h-4" />
                    <span>Browse</span>
                  </TabsTrigger>
                  <TabsTrigger value="comment" className="flex items-center space-x-2" data-testid="comment-tab">
                    <MessageCircle className="w-4 h-4" />
                    <span>Comment</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="h-6 w-px bg-border"></div>

              {/* Viewport Size Selector */}
              <div className="flex items-center space-x-1 bg-secondary rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewportSize === 'desktop' ? 'default' : 'ghost'}
                  onClick={() => setViewportSize('desktop')}
                  className="h-8 px-3"
                  data-testid="desktop-view"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewportSize === 'tablet' ? 'default' : 'ghost'}
                  onClick={() => setViewportSize('tablet')}
                  className="h-8 px-3"
                  data-testid="tablet-view"
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewportSize === 'mobile' ? 'default' : 'ghost'}
                  onClick={() => setViewportSize('mobile')}
                  className="h-8 px-3"
                  data-testid="mobile-view"
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>

              <div className="h-6 w-px bg-border"></div>

              {/* Share Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                data-testid="share-btn"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Canvas Content */}
          <div className="flex-1 overflow-auto bg-secondary/30 p-8">
            <div className="mx-auto" style={{ width: getViewportWidth(), maxWidth: '100%' }}>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div
                  ref={canvasRef}
                  className="markup-canvas relative"
                  onClick={handleCanvasClick}
                  style={{ 
                    minHeight: '600px', 
                    cursor: mode === 'comment' && user ? 'crosshair' : 'default'
                  }}
                  data-testid="markup-canvas"
                >
                  {project.type === 'url' && project.content_url && (
                    <iframe
                      src={project.content_url}
                      className="w-full border-0"
                      style={{ height: '800px' }}
                      title={project.name}
                      data-testid="canvas-iframe"
                    />
                  )}
                  {project.type === 'image' && project.file_path && (
                    <img
                      src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                      alt={project.name}
                      className="w-full h-auto"
                      data-testid="canvas-image"
                    />
                  )}
                  {project.type === 'pdf' && project.file_path && (
                    <embed
                      src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                      type="application/pdf"
                      className="w-full"
                      style={{ height: '800px' }}
                      data-testid="canvas-pdf"
                    />
                  )}

                  {/* Pin Markers - Only show filtered pins */}
                  {filteredPins.map((pin, index) => (
                    <div
                      key={pin.id}
                      className={`pin-marker w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs cursor-pointer z-50 ${
                        pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                      } ${selectedPin?.id === pin.id ? 'ring-4 ring-accent/30' : ''}`}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`
                      }}
                      onClick={(e) => handlePinClick(pin, e)}
                      data-testid={`pin-marker-${index}`}
                    >
                      {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pins.findIndex(p => p.id === pin.id) + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}