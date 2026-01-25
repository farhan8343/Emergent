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
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Check, MessageSquare, X, Monitor, Tablet, Smartphone, Share2, Eye, MessageCircle, Search, ArrowUpDown, ChevronLeft, Paperclip, Image as ImageIcon, ExternalLink } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProjectCanvas() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [pins, setPins] = useState([]);
  const [allComments, setAllComments] = useState({});
  const [selectedPin, setSelectedPin] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('browse');
  const [viewportSize, setViewportSize] = useState('desktop');
  const [showResolved, setShowResolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [sidebarView, setSidebarView] = useState('overview');
  const [selectedFile, setSelectedFile] = useState(null);
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  useEffect(() => {
    if (pins.length > 0) {
      fetchAllComments();
    }
  }, [pins.length]);

  useEffect(() => {
    if (selectedPin?.id) {
      fetchComments(selectedPin.id);
      setSidebarView('thread');
    }
  }, [selectedPin?.id]);

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

  const fetchAllComments = async () => {
    try {
      const commentsMap = {};
      await Promise.all(
        pins.map(async (pin) => {
          try {
            const response = await axios.get(`${API}/comments/${pin.id}`);
            commentsMap[pin.id] = response.data;
          } catch (error) {
            commentsMap[pin.id] = [];
          }
        })
      );
      setAllComments(commentsMap);
    } catch (error) {
      console.error('Failed to fetch all comments:', error);
    }
  };

  const fetchComments = async (pinId) => {
    try {
      const response = await axios.get(`${API}/comments/${pinId}`);
      setComments(response.data);
      setAllComments(prev => ({ ...prev, [pinId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleCanvasClick = async (e) => {
    if (mode !== 'comment' || !canvasRef.current || !user) {
      if (mode === 'comment' && !user) {
        toast.error('Please login to add pins');
      }
      return;
    }

    const target = e.target;
    if (target.closest('.pin-marker')) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    
    const x = ((e.clientX - rect.left + scrollLeft) / rect.width) * 100;
    const y = ((e.clientY - rect.top + scrollTop) / rect.height) * 100;

    try {
      const response = await axios.post(
        `${API}/pins`,
        { project_id: id, x, y },
        { headers: getAuthHeaders() }
      );
      const newPin = response.data;
      setPins(prevPins => [...prevPins, newPin]);
      setSelectedPin(newPin);
      toast.success('Pin created! Add a comment.');
    } catch (error) {
      console.error('Failed to create pin:', error);
      toast.error(error.response?.data?.detail || 'Failed to create pin');
    }
  };

  const handlePinClick = (pin, e) => {
    e.stopPropagation();
    setSelectedPin(pin);
  };

  const handleBackToOverview = () => {
    setSelectedPin(null);
    setSidebarView('overview');
    setSearchQuery('');
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedPin) return;

    if (!user && (!guestName.trim() || !guestEmail.trim())) {
      toast.error('Please enter your name and email');
      return;
    }

    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('pin_id', selectedPin.id);
      formData.append('content', newComment);

      if (!user) {
        formData.append('guest_name', guestName);
        formData.append('guest_email', guestEmail);
      }

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await axios.post(
        `${API}/comments/with-attachment`,
        formData,
        {
          headers: {
            ...(user ? getAuthHeaders() : {})
          }
        }
      );

      setComments(prevComments => [...prevComments, response.data]);
      setAllComments(prev => ({
        ...prev,
        [selectedPin.id]: [...(prev[selectedPin.id] || []), response.data]
      }));
      setNewComment('');
      setSelectedFile(null);
      toast.success('Comment added');
    } catch (error) {
      console.error('Failed to add comment:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to add comment';
      toast.error(errorMsg);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
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
      
      if (newStatus === 'resolved' && !showResolved) {
        handleBackToOverview();
      }
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

  const visiblePins = useMemo(() => {
    if (mode !== 'comment') return [];
    if (showResolved) return pins;
    return pins.filter(pin => pin.status === 'open');
  }, [pins, showResolved, mode]);

  const filteredPins = useMemo(() => {
    if (!searchQuery.trim()) return visiblePins;
    
    return visiblePins.filter(pin => {
      const pinComments = allComments[pin.id] || [];
      const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
      
      if (pinNumber.toString().includes(searchQuery)) return true;
      
      return pinComments.some(comment => 
        comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.author_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [visiblePins, searchQuery, allComments, pins]);

  const filteredAndSortedPins = useMemo(() => {
    const sorted = [...filteredPins].sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  }, [filteredPins, sortOrder]);

  const pinCounts = useMemo(() => {
    return {
      total: pins.length,
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
        {/* Comments Sidebar */}
        <div className="w-80 bg-white border-r border-border/40 flex flex-col" data-testid="comments-sidebar">
          {mode === 'comment' ? (
            sidebarView === 'overview' ? (
              <>
                <div className="p-4 border-b border-border/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        All Comments
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {pinCounts.open} pending, {pinCounts.resolved} resolved
                      </p>
                    </div>
                    <Switch
                      id="show-resolved"
                      checked={showResolved}
                      onCheckedChange={setShowResolved}
                      data-testid="show-resolved-toggle"
                    />
                  </div>
                  
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pins & comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                      data-testid="search-pins"
                    />
                  </div>
                  
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger className="h-9" data-testid="sort-pins">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {filteredAndSortedPins.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {searchQuery ? 'No pins found' : 'Click canvas to create pins'}
                      </p>
                    ) : (
                      filteredAndSortedPins.map((pin) => {
                        const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
                        const pinComments = allComments[pin.id] || [];
                        const lastComment = pinComments[pinComments.length - 1];
                        
                        return (
                          <Card
                            key={pin.id}
                            className="p-3 border-border/40 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedPin(pin)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                                pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                              }`}>
                                {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pinNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold">
                                    Pin #{pinNumber}
                                  </span>
                                  <Badge variant={pin.status === 'resolved' ? 'secondary' : 'default'} className="text-xs">
                                    {pinComments.length}
                                  </Badge>
                                </div>
                                {lastComment ? (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {lastComment.author_name}: {lastComment.content}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    No comments yet
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToOverview}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div>
                        <h3 className="font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          Pin #{pins.findIndex(p => p.id === selectedPin?.id) + 1}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {selectedPin?.status}
                        </p>
                      </div>
                    </div>
                    {user && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResolvePin}
                      >
                        {selectedPin?.status === 'open' ? 'Resolve' : 'Reopen'}
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No comments yet
                      </p>
                    ) : (
                      comments.map((comment) => (
                        <Card key={comment.id} className="p-3 border-border/40">
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
                                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">Guest</span>
                                )}
                              </div>
                              <p className="text-sm mb-2">{comment.content}</p>
                              {comment.attachment_path && (
                                <a
                                  href={`${BACKEND_URL}/api/files/attachments/${comment.attachment_path.split('/').pop()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent hover:underline flex items-center space-x-1"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>Attachment</span>
                                </a>
                              )}
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
                        />
                        <Input
                          type="email"
                          placeholder="Your email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          required
                        />
                      </>
                    )}
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      required
                      rows={3}
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="w-4 h-4 mr-2" />
                        {selectedFile ? selectedFile.name.substring(0, 15) : 'Attach'}
                      </Button>
                      {selectedFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-accent hover:bg-accent/90 rounded-full"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Add Comment
                    </Button>
                  </form>
                </div>
              </>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <MessageSquare className="w-16 h-16 text-accent/30 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Switch to Comment Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Click Comment tab to add feedback
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b p-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border"></div>
              <h1 className="text-lg font-bold">{project.name}</h1>
            </div>

            <div className="flex items-center space-x-3">
              <Tabs value={mode} onValueChange={setMode}>
                <TabsList className="bg-secondary">
                  <TabsTrigger value="browse">
                    <Eye className="w-4 h-4 mr-2" />
                    Browse
                  </TabsTrigger>
                  <TabsTrigger value="comment">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Comment ({pinCounts.open})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {project.content_url && (
                <Button size="sm" variant="outline" onClick={() => window.open(project.content_url, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open URL
                </Button>
              )}

              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-secondary/30 p-8">
            <div className="mx-auto bg-white rounded-xl shadow-lg p-8">
              <div
                ref={canvasRef}
                className="relative"
                onClick={handleCanvasClick}
                style={{ 
                  minHeight: '800px',
                  cursor: mode === 'comment' && user ? 'crosshair' : 'default'
                }}
              >
                {project.type === 'url' && (
                  project.screenshot_path ? (
                    <img
                      src={`${BACKEND_URL}/api/files/screenshots/${project.screenshot_path.split('/').pop()}`}
                      alt={project.name}
                      className="w-full h-auto"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <ExternalLink className="w-16 h-16 text-accent mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Generating Screenshot...</h3>
                        <p className="text-muted-foreground mb-4">Please wait or refresh the page</p>
                        <Button variant="outline" onClick={() => window.location.reload()}>
                          Refresh Page
                        </Button>
                      </div>
                    </div>
                  )
                )}
                {project.type === 'image' && project.file_path && (
                  <img
                    src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                    alt={project.name}
                    className="w-full h-auto"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  />
                )}
                {project.type === 'pdf' && project.file_path && (
                  <embed
                    src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                    type="application/pdf"
                    className="w-full"
                    style={{ height: '800px' }}
                  />
                )}

                {/* Pins */}
                {visiblePins.map((pin) => {
                  const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
                  return (
                    <div
                      key={pin.id}
                      className={`pin-marker absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs cursor-pointer z-50 ${
                        pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                      } ${selectedPin?.id === pin.id ? 'ring-4 ring-accent/30' : ''} hover:scale-110 transition-transform`}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={(e) => handlePinClick(pin, e)}
                    >
                      {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pinNumber}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}