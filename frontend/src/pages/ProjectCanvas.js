import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, Check, MessageSquare, X, Monitor, Tablet, Smartphone, 
  Share2, Eye, MessageCircle, Search, ArrowUpDown, ChevronLeft, 
  Paperclip, ExternalLink, Loader2, Plus, Globe, AtSign
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProjectCanvas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();
  
  // Core state
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('browse');
  const [viewportSize, setViewportSize] = useState('desktop');
  
  // Iframe state
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState(null);
  
  // Comments and pins state
  const [pins, setPins] = useState([]);
  const [allComments, setAllComments] = useState({});
  const [selectedPin, setSelectedPin] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  // Guest state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  
  // Filter and search state
  const [showResolved, setShowResolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [sidebarView, setSidebarView] = useState('overview');
  const [selectedPageUrl, setSelectedPageUrl] = useState(null);
  
  // UI state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [projectUsers, setProjectUsers] = useState([]);
  
  // Refs
  const canvasRef = useRef(null);
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);

  // ==================== DATA FETCHING ====================
  
  const fetchProject = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}`, {
        headers: getAuthHeaders()
      });
      setProject(response.data);
      setCurrentPageUrl(response.data.content_url);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, getAuthHeaders, navigate]);

  const fetchPins = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/pins/${id}`, { headers: getAuthHeaders() });
      setPins(response.data);
    } catch (error) {
      console.error('Failed to fetch pins:', error);
    }
  }, [id, getAuthHeaders]);

  const fetchComments = useCallback(async (pinId) => {
    try {
      const response = await axios.get(`${API}/comments/${pinId}`, {
        headers: getAuthHeaders()
      });
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  }, [getAuthHeaders]);

  const fetchAllComments = useCallback(async () => {
    if (pins.length === 0) return;
    try {
      const commentsMap = {};
      for (const pin of pins) {
        const response = await axios.get(`${API}/comments/${pin.id}`, {
          headers: getAuthHeaders()
        });
        commentsMap[pin.id] = response.data;
      }
      setAllComments(commentsMap);
    } catch (error) {
      console.error('Failed to fetch all comments:', error);
    }
  }, [pins, getAuthHeaders]);

  const fetchProjectUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}/users`, {
        headers: getAuthHeaders()
      });
      setProjectUsers(response.data || []);
    } catch (error) {
      setProjectUsers([]);
    }
  }, [id, getAuthHeaders]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchProjectUsers();
    }
  }, [id, fetchProject, fetchProjectUsers]);

  useEffect(() => {
    if (project) {
      fetchPins();
    }
  }, [project, fetchPins]);

  useEffect(() => {
    if (pins.length > 0) {
      fetchAllComments();
    }
  }, [pins.length, fetchAllComments]);

  useEffect(() => {
    if (selectedPin?.id) {
      fetchComments(selectedPin.id);
      setSidebarView('thread');
    }
  }, [selectedPin?.id, fetchComments]);

  // Listen for messages from proxied iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'MARKUPLY_PAGE_LOADED') {
        setIframeLoaded(true);
        // Update current page URL from iframe
        if (event.data.url) {
          // Extract the actual URL from the proxy URL
          const proxyUrl = event.data.url;
          const match = proxyUrl.match(/[?&]url=([^&]+)/);
          if (match) {
            try {
              setCurrentPageUrl(decodeURIComponent(match[1]));
            } catch (e) {
              console.error('Failed to decode URL:', e);
            }
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ==================== PROXY URL ====================

  const getProxyUrl = useCallback((url) => {
    if (!url) return null;
    const encodedUrl = encodeURIComponent(url);
    return `${API}/proxy?url=${encodedUrl}&project_id=${id}`;
  }, [id]);

  // ==================== PIN & COMMENT HANDLERS ====================

  const handleCanvasClick = useCallback(async (e) => {
    if (mode !== 'comment' || !canvasRef.current || !user) {
      if (mode === 'comment' && !user) {
        setShowGuestDialog(true);
      }
      return;
    }

    // Don't create pin if clicking on existing pin
    if (e.target.closest('.pin-marker')) {
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Get scroll position from iframe if possible
    let scrollX = 0;
    let scrollY = 0;
    try {
      if (iframeRef.current?.contentWindow) {
        scrollX = iframeRef.current.contentWindow.scrollX || 0;
        scrollY = iframeRef.current.contentWindow.scrollY || 0;
      }
    } catch (e) {
      // Cross-origin, can't access scroll
    }
    
    // Calculate position as percentage of canvas
    const x = ((e.clientX - canvasRect.left) / canvasRect.width) * 100;
    const y = ((e.clientY - canvasRect.top) / canvasRect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return;
    }

    try {
      const response = await axios.post(
        `${API}/pins`,
        { 
          project_id: id, 
          x, 
          y,
          page_url: currentPageUrl || project?.content_url,
          scroll_x: scrollX,
          scroll_y: scrollY
        },
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
  }, [mode, user, id, currentPageUrl, project, getAuthHeaders]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() && !selectedFile) {
      toast.error('Please enter a comment or attach a file');
      return;
    }

    if (!selectedPin) {
      toast.error('Please select or create a pin first');
      return;
    }

    // Check guest requirements
    if (!user && (!guestName.trim() || !guestEmail.trim())) {
      setShowGuestDialog(true);
      return;
    }

    setIsSubmitting(true);
    
    // Optimistic UI update - show comment immediately
    const optimisticComment = {
      id: `temp_${Date.now()}`,
      content: newComment,
      author_name: user?.name || guestName,
      author_type: user ? 'team' : 'guest',
      created_at: new Date().toISOString(),
      _optimistic: true
    };

    // Add to UI immediately
    setComments(prev => [...prev, optimisticComment]);
    setAllComments(prev => ({
      ...prev,
      [selectedPin.id]: [...(prev[selectedPin.id] || []), optimisticComment]
    }));

    // Clear input immediately for responsiveness
    const commentText = newComment;
    const file = selectedFile;
    setNewComment('');
    setSelectedFile(null);

    try {
      let response;
      if (file) {
        const formData = new FormData();
        formData.append('pin_id', selectedPin.id);
        formData.append('content', commentText);
        formData.append('file', file);
        if (!user) {
          formData.append('guest_name', guestName);
          formData.append('guest_email', guestEmail);
        }

        response = await axios.post(
          `${API}/comments/with-attachment`,
          formData,
          { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' } }
        );
      } else {
        response = await axios.post(
          `${API}/comments`,
          {
            pin_id: selectedPin.id,
            content: commentText,
            guest_name: !user ? guestName : undefined,
            guest_email: !user ? guestEmail : undefined
          },
          { headers: getAuthHeaders() }
        );
      }

      // Replace optimistic comment with real one
      const realComment = response.data;
      setComments(prev => prev.map(c => 
        c.id === optimisticComment.id ? realComment : c
      ));
      setAllComments(prev => ({
        ...prev,
        [selectedPin.id]: (prev[selectedPin.id] || []).map(c =>
          c.id === optimisticComment.id ? realComment : c
        )
      }));

      toast.success('Comment added!');
      
    } catch (error) {
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setAllComments(prev => ({
        ...prev,
        [selectedPin.id]: (prev[selectedPin.id] || []).filter(c => c.id !== optimisticComment.id)
      }));
      console.error('Failed to add comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, selectedFile, selectedPin, user, guestName, guestEmail, getAuthHeaders]);

  const handleResolvePin = useCallback(async () => {
    if (!selectedPin || !user) return;

    try {
      const newStatus = selectedPin.status === 'open' ? 'resolved' : 'open';
      await axios.put(
        `${API}/pins/${selectedPin.id}/status?new_status=${newStatus}`,
        {},
        { headers: getAuthHeaders() }
      );
      
      setPins(prev => prev.map(p => 
        p.id === selectedPin.id ? { ...p, status: newStatus } : p
      ));
      setSelectedPin(prev => ({ ...prev, status: newStatus }));
      toast.success(`Pin ${newStatus}`);
    } catch (error) {
      console.error('Failed to update pin status:', error);
      toast.error('Failed to update pin status');
    }
  }, [selectedPin, user, getAuthHeaders]);

  const handlePinClick = useCallback((pin, e) => {
    e?.stopPropagation();
    setSelectedPin(pin);
    setSidebarView('thread');
  }, []);

  const handleBackToOverview = useCallback(() => {
    setSelectedPin(null);
    setSidebarView('overview');
    setSearchQuery('');
  }, []);

  // ==================== MENTION HANDLING ====================

  const handleCommentChange = useCallback((e) => {
    const value = e.target.value;
    setNewComment(value);
    
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      
      if (spaceIndex === -1) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  const handleMentionSelect = useCallback((mentionUser) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const newText = newComment.slice(0, lastAtIndex) + `@${mentionUser.name} `;
    setNewComment(newText);
    setShowMentions(false);
    commentInputRef.current?.focus();
  }, [newComment]);

  const filteredMentionUsers = useMemo(() => {
    if (!mentionSearch) return projectUsers.slice(0, 5);
    return projectUsers
      .filter(u => u.name?.toLowerCase().includes(mentionSearch) || 
                   u.email?.toLowerCase().includes(mentionSearch))
      .slice(0, 5);
  }, [projectUsers, mentionSearch]);

  // ==================== FILE HANDLING ====================

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      toast.success(`File attached: ${file.name}`);
    }
  }, []);

  const handleShare = useCallback(() => {
    const shareUrl = `${window.location.origin}/project/${id}/share`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied to clipboard');
  }, [id]);

  // ==================== COMPUTED VALUES ====================

  const visiblePins = useMemo(() => {
    let filtered = pins;
    
    // Filter by page URL if selected
    if (selectedPageUrl) {
      filtered = filtered.filter(pin => 
        pin.page_url === selectedPageUrl || 
        (!pin.page_url && selectedPageUrl === project?.content_url)
      );
    }
    
    // Filter by resolved status
    if (!showResolved) {
      filtered = filtered.filter(pin => pin.status !== 'resolved');
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(pin => {
        const pinComments = allComments[pin.id] || [];
        return pinComments.some(c => 
          c.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.author_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [pins, selectedPageUrl, project, showResolved, searchQuery, sortOrder, allComments]);

  const pinCounts = useMemo(() => ({
    total: pins.length,
    open: pins.filter(p => p.status === 'open').length,
    resolved: pins.filter(p => p.status === 'resolved').length
  }), [pins]);

  const pageUrls = useMemo(() => {
    const urls = new Set();
    pins.forEach(p => {
      if (p.page_url) urls.add(p.page_url);
    });
    if (project?.content_url) urls.add(project.content_url);
    return Array.from(urls);
  }, [pins, project]);

  const getViewportWidth = useCallback(() => {
    switch (viewportSize) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  }, [viewportSize]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b bg-card p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold truncate" data-testid="project-name">{project.name}</h1>
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {currentPageUrl || project.content_url}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 flex-shrink-0">
                {/* Viewport Size Controls */}
                {project.type === 'url' && (
                  <div className="flex items-center border rounded-lg p-1 bg-secondary">
                    <Button
                      variant={viewportSize === 'desktop' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setViewportSize('desktop')}
                    >
                      <Monitor className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewportSize === 'tablet' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setViewportSize('tablet')}
                    >
                      <Tablet className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewportSize === 'mobile' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setViewportSize('mobile')}
                    >
                      <Smartphone className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Mode Toggle */}
                <Tabs value={mode} onValueChange={setMode}>
                  <TabsList className="bg-secondary">
                    <TabsTrigger value="browse" data-testid="mode-browse">
                      <Eye className="w-4 h-4 mr-2" />
                      Browse
                    </TabsTrigger>
                    <TabsTrigger value="comment" data-testid="mode-comment">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Comment ({pinCounts.open})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {project.content_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(project.content_url, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                )}

                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas Area - Scrollable in both modes */}
          <div className="flex-1 overflow-auto bg-secondary/30 p-4">
            <div 
              className="mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
              style={{ 
                width: getViewportWidth(),
                maxWidth: '100%'
              }}
            >
              <div
                ref={canvasRef}
                className="relative"
                onClick={handleCanvasClick}
                style={{ 
                  cursor: mode === 'comment' && user ? 'crosshair' : 'default',
                  minHeight: project.type === 'url' ? '800px' : 'auto'
                }}
              >
                {/* URL-based project with iframe proxy */}
                {project.type === 'url' && project.content_url && (
                  <>
                    {/* Loading state */}
                    {!iframeLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 z-10">
                        <div className="text-center">
                          <Loader2 className="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
                          <h3 className="text-lg font-semibold mb-2">Loading Website...</h3>
                          <p className="text-sm text-muted-foreground">{project.content_url}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Iframe with proxy - allows scrolling in both modes */}
                    <iframe
                      ref={iframeRef}
                      src={getProxyUrl(project.content_url)}
                      title={project.name}
                      className="w-full border-0"
                      style={{ 
                        height: '800px',
                        pointerEvents: mode === 'comment' ? 'none' : 'auto'
                      }}
                      onLoad={() => setIframeLoaded(true)}
                      data-testid="project-iframe"
                    />
                    
                    {/* Transparent overlay for pin placement in comment mode - allows scroll through */}
                    {mode === 'comment' && (
                      <div 
                        className="absolute inset-0 z-20"
                        style={{ 
                          background: 'transparent',
                          cursor: user ? 'crosshair' : 'default',
                          pointerEvents: 'auto'
                        }}
                      />
                    )}
                    
                    {/* Pins overlay - positioned relative to viewport percentage */}
                    {visiblePins.map((pin) => {
                      const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
                      return (
                        <div
                          key={pin.id}
                          className={`pin-marker absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs cursor-pointer z-30 transition-transform hover:scale-110 ${
                            pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                          } ${selectedPin?.id === pin.id ? 'ring-4 ring-accent/30 scale-110' : ''}`}
                          style={{
                            left: `${pin.x}%`,
                            top: `${pin.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onClick={(e) => handlePinClick(pin, e)}
                          data-testid={`pin-${pin.id}`}
                        >
                          {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pinNumber}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Image-based project */}
                {project.type === 'image' && project.file_path && (
                  <div className="relative">
                    <img
                      src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                      alt={project.name}
                      className="w-full h-auto block"
                      data-testid="project-image"
                    />
                    {visiblePins.map((pin) => {
                      const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
                      return (
                        <div
                          key={pin.id}
                          className={`pin-marker absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs cursor-pointer z-10 transition-transform hover:scale-110 ${
                            pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                          } ${selectedPin?.id === pin.id ? 'ring-4 ring-accent/30 scale-110' : ''}`}
                          style={{
                            left: `${pin.x}%`,
                            top: `${pin.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onClick={(e) => handlePinClick(pin, e)}
                          data-testid={`pin-${pin.id}`}
                        >
                          {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pinNumber}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* PDF-based project */}
                {project.type === 'pdf' && project.file_path && (
                  <embed
                    src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                    type="application/pdf"
                    className="w-full"
                    style={{ height: '800px' }}
                    data-testid="project-pdf"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - ALWAYS VISIBLE regardless of mode */}
        <div className="w-96 border-l bg-card flex flex-col flex-shrink-0" data-testid="comments-sidebar">
          {/* Sidebar Header */}
          <div className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              {sidebarView === 'thread' && selectedPin ? (
                <Button variant="ghost" size="sm" onClick={handleBackToOverview}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  All Comments
                </Button>
              ) : (
                <h3 className="font-semibold flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Comments
                </h3>
              )}
            </div>

            {/* Page URL Filter */}
            {pageUrls.length > 1 && sidebarView === 'overview' && (
              <div className="mb-4">
                <Select value={selectedPageUrl || 'all'} onValueChange={(v) => setSelectedPageUrl(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-full text-xs">
                    <Globe className="w-3 h-3 mr-2" />
                    <SelectValue placeholder="All pages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All pages</SelectItem>
                    {pageUrls.map((url) => (
                      <SelectItem key={url} value={url} className="text-xs">
                        {(() => {
                          try {
                            return new URL(url).pathname || '/';
                          } catch {
                            return url;
                          }
                        })()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Search and Filters */}
            {sidebarView === 'overview' && (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search comments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="search-comments"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-resolved"
                      checked={showResolved}
                      onCheckedChange={setShowResolved}
                    />
                    <label htmlFor="show-resolved" className="text-sm text-muted-foreground">
                      Show resolved
                    </label>
                  </div>

                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  {pinCounts.open} pending, {pinCounts.resolved} resolved
                </p>
              </>
            )}
          </div>

          {/* Comments List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {sidebarView === 'overview' ? (
                visiblePins.length > 0 ? (
                  visiblePins.map((pin) => {
                    const pinComments = allComments[pin.id] || [];
                    const latestComment = pinComments[pinComments.length - 1];
                    const pinNumber = pins.findIndex(p => p.id === pin.id) + 1;
                    
                    return (
                      <Card
                        key={pin.id}
                        className={`p-3 cursor-pointer hover:bg-secondary/50 transition-colors ${
                          selectedPin?.id === pin.id ? 'ring-2 ring-accent' : ''
                        }`}
                        onClick={() => handlePinClick(pin)}
                        data-testid={`pin-card-${pin.id}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                            pin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                          }`}>
                            {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : pinNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">Pin #{pinNumber}</span>
                              <Badge variant={pin.status === 'resolved' ? 'secondary' : 'default'} className="text-xs">
                                {pin.status}
                              </Badge>
                            </div>
                            {latestComment ? (
                              <p className="text-sm text-muted-foreground truncate">
                                {latestComment.content}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No comments yet</p>
                            )}
                            {pin.page_url && pin.page_url !== project.content_url && (
                              <p className="text-xs text-muted-foreground mt-1 truncate flex items-center">
                                <Globe className="w-3 h-3 mr-1 flex-shrink-0" />
                                {(() => {
                                  try {
                                    return new URL(pin.page_url).pathname;
                                  } catch {
                                    return pin.page_url;
                                  }
                                })()}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {pinComments.length} comment{pinComments.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No comments yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {mode === 'comment' 
                        ? 'Click on the website to add a pin'
                        : 'Switch to Comment mode to add pins'}
                    </p>
                  </div>
                )
              ) : (
                /* Thread View */
                selectedPin && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          selectedPin.status === 'resolved' ? 'bg-green-500' : 'bg-accent'
                        }`}>
                          {selectedPin.status === 'resolved' 
                            ? <Check className="w-4 h-4" /> 
                            : pins.findIndex(p => p.id === selectedPin.id) + 1}
                        </div>
                        <div>
                          <span className="font-medium">Pin #{pins.findIndex(p => p.id === selectedPin.id) + 1}</span>
                          <Badge variant={selectedPin.status === 'resolved' ? 'secondary' : 'default'} className="ml-2 text-xs">
                            {selectedPin.status}
                          </Badge>
                        </div>
                      </div>
                      {user && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleResolvePin}
                        >
                          {selectedPin.status === 'resolved' ? 'Reopen' : 'Resolve'}
                        </Button>
                      )}
                    </div>

                    {selectedPin.page_url && (
                      <p className="text-xs text-muted-foreground flex items-center">
                        <Globe className="w-3 h-3 mr-1" />
                        {selectedPin.page_url}
                      </p>
                    )}

                    <div className="space-y-3">
                      {comments.length > 0 ? (
                        comments.map((comment) => (
                          <div 
                            key={comment.id} 
                            className={`p-3 bg-secondary/30 rounded-lg ${comment._optimistic ? 'opacity-70' : ''}`}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                                {comment.author_name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="font-medium text-sm">{comment.author_name}</span>
                              {comment.author_type === 'guest' && (
                                <Badge variant="outline" className="text-xs">Guest</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                              {comment._optimistic && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            {comment.attachment_path && (
                              <div className="mt-2">
                                <a 
                                  href={`${BACKEND_URL}/api/files/attachments/${comment.attachment_path.split('/').pop()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent hover:underline flex items-center"
                                >
                                  <Paperclip className="w-3 h-3 mr-1" />
                                  View attachment
                                </a>
                              </div>
                            )}
                            {comment.screenshot_path && (
                              <div className="mt-2">
                                <img 
                                  src={`${BACKEND_URL}/api/files/screenshots/${comment.screenshot_path.split('/').pop()}`}
                                  alt="Screenshot"
                                  className="w-full rounded border cursor-pointer hover:opacity-90"
                                  onClick={() => window.open(`${BACKEND_URL}/api/files/screenshots/${comment.screenshot_path.split('/').pop()}`, '_blank')}
                                />
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No comments on this pin yet
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>

          {/* Comment Input - Always visible at bottom */}
          <div className="p-4 border-t bg-card flex-shrink-0">
            {!selectedPin && mode === 'comment' && (
              <p className="text-xs text-muted-foreground mb-2 text-center">
                Click on the website to create a pin, then add your comment
              </p>
            )}
            <div className="relative">
              <Textarea
                ref={commentInputRef}
                placeholder={
                  !selectedPin 
                    ? "Select a pin to add comments" 
                    : "Add a comment... (use @ to mention)"
                }
                value={newComment}
                onChange={handleCommentChange}
                disabled={!selectedPin}
                className="min-h-[80px] pr-10 resize-none"
                data-testid="comment-input"
              />
              
              {/* Mentions Dropdown */}
              {showMentions && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 w-full mb-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                  {filteredMentionUsers.map((mentionUser, index) => (
                    <div
                      key={mentionUser.id || mentionUser.email}
                      className="p-2 cursor-pointer hover:bg-secondary"
                      onClick={() => handleMentionSelect(mentionUser)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs">
                          {mentionUser.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{mentionUser.name}</p>
                          <p className="text-xs text-muted-foreground">{mentionUser.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedPin}
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                {selectedFile && (
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Paperclip className="w-3 h-3 mr-1" />
                    {selectedFile.name.length > 15 ? `${selectedFile.name.slice(0, 15)}...` : selectedFile.name}
                    <button onClick={() => setSelectedFile(null)} className="ml-1 text-red-500 hover:text-red-700">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              
              <Button 
                size="sm"
                onClick={handleSubmitComment}
                disabled={!selectedPin || isSubmitting || (!newComment.trim() && !selectedFile)}
                data-testid="submit-comment-btn"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Guest Dialog */}
      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guest Comment</DialogTitle>
            <DialogDescription>
              Please provide your name and email to add a comment as a guest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                data-testid="guest-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="your@email.com"
                data-testid="guest-email-input"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowGuestDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (guestName.trim() && guestEmail.trim()) {
                  setShowGuestDialog(false);
                } else {
                  toast.error('Please fill in both fields');
                }
              }}
              data-testid="guest-continue-btn"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
