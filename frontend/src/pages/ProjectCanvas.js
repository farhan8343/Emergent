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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { 
  ArrowLeft, Check, MessageSquare, X, Monitor, Tablet, Smartphone, 
  Share2, Eye, MessageCircle, Search, ArrowUpDown, ChevronLeft, 
  Paperclip, ExternalLink, Loader2, Plus, Camera, AtSign, Globe,
  MapPin, Image as ImageIcon, ChevronDown, Filter
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
  const [websiteWindowRef, setWebsiteWindowRef] = useState(null);
  const [currentPageUrl, setCurrentPageUrl] = useState(null);
  const [pendingComment, setPendingComment] = useState(null);
  
  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [projectUsers, setProjectUsers] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  
  // Refs
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // ==================== DATA FETCHING ====================
  
  const fetchProject = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}`, {
        headers: getAuthHeaders()
      });
      setProject(response.data);
      setCurrentPageUrl(response.data.content_url);
      setSelectedPageUrl(response.data.content_url);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, getAuthHeaders, navigate]);

  const fetchPins = useCallback(async (pageUrl = null) => {
    try {
      const url = pageUrl 
        ? `${API}/pins/${id}?page_url=${encodeURIComponent(pageUrl)}`
        : `${API}/pins/${id}`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
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
      // Endpoint may not exist yet, use empty array
      setProjectUsers([]);
    }
  }, [id, getAuthHeaders]);

  const fetchPageUrls = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}/pages`, {
        headers: getAuthHeaders()
      });
      return response.data || [];
    } catch (error) {
      return [];
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
      fetchPins(selectedPageUrl);
    }
  }, [project, selectedPageUrl, fetchPins]);

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

  // Cleanup website window on unmount
  useEffect(() => {
    return () => {
      if (websiteWindowRef && !websiteWindowRef.closed) {
        websiteWindowRef.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [websiteWindowRef]);

  // ==================== WEBSITE WINDOW MANAGEMENT ====================

  const openWebsiteWindow = useCallback(() => {
    if (!project?.content_url) return;
    
    // Close existing window if any
    if (websiteWindowRef && !websiteWindowRef.closed) {
      websiteWindowRef.focus();
      return;
    }
    
    // Calculate window position (left side of screen)
    const width = Math.floor(window.screen.width * 0.65);
    const height = window.screen.height - 100;
    const left = 0;
    const top = 50;
    
    // Open the website in a new window
    const newWindow = window.open(
      project.content_url,
      `markuply_preview_${id}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=yes,location=yes,status=yes,scrollbars=yes`
    );
    
    if (newWindow) {
      setWebsiteWindowRef(newWindow);
      setCurrentPageUrl(project.content_url);
      toast.success('Website opened in preview window');
      
      // Poll for URL changes and window close
      pollIntervalRef.current = setInterval(() => {
        try {
          if (newWindow.closed) {
            clearInterval(pollIntervalRef.current);
            setWebsiteWindowRef(null);
            return;
          }
          // Note: We can't access cross-origin URLs, so we track based on user input
        } catch (e) {
          // Cross-origin access denied - expected
        }
      }, 1000);
    } else {
      toast.error('Please allow popups for this site');
    }
  }, [project, id, websiteWindowRef]);

  const focusWebsiteWindow = useCallback(() => {
    if (websiteWindowRef && !websiteWindowRef.closed) {
      websiteWindowRef.focus();
    } else {
      openWebsiteWindow();
    }
  }, [websiteWindowRef, openWebsiteWindow]);

  // ==================== PIN & COMMENT HANDLERS ====================

  const handleAddCommentClick = useCallback(() => {
    if (!user) {
      setShowGuestDialog(true);
      return;
    }
    
    // Prompt user to specify position
    setPendingComment({
      pageUrl: currentPageUrl || project?.content_url,
      scrollRatioX: 0.5,
      scrollRatioY: 0.5,
      viewportX: 50,
      viewportY: 50
    });
    
    toast.info('Enter your comment and optionally attach a screenshot');
  }, [user, currentPageUrl, project]);

  const handleCreatePin = useCallback(async (commentData) => {
    try {
      const pinData = {
        project_id: id,
        page_url: commentData.pageUrl || currentPageUrl || project?.content_url,
        x: commentData.viewportX || 50,
        y: commentData.viewportY || 50,
        scroll_x: commentData.scrollRatioX || 0,
        scroll_y: commentData.scrollRatioY || 0
      };
      
      const response = await axios.post(`${API}/pins`, pinData, {
        headers: getAuthHeaders()
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to create pin:', error);
      throw error;
    }
  }, [id, currentPageUrl, project, getAuthHeaders]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() && !selectedFile) {
      toast.error('Please enter a comment or attach a file');
      return;
    }

    // Check guest requirements
    if (!user && (!guestName.trim() || !guestEmail.trim())) {
      setShowGuestDialog(true);
      return;
    }

    setIsSubmitting(true);
    
    // Optimistic UI update
    const optimisticComment = {
      id: `temp_${Date.now()}`,
      content: newComment,
      author_name: user?.name || guestName,
      author_type: user ? 'team' : 'guest',
      created_at: new Date().toISOString(),
      _optimistic: true
    };

    let targetPin = selectedPin;
    
    try {
      // If no pin selected, create a new one
      if (!targetPin && pendingComment) {
        targetPin = await handleCreatePin(pendingComment);
        setPins(prev => [...prev, targetPin]);
        setSelectedPin(targetPin);
      }

      if (!targetPin) {
        toast.error('Please select or create a pin first');
        setIsSubmitting(false);
        return;
      }

      // Add optimistic comment to UI immediately
      setComments(prev => [...prev, optimisticComment]);
      setAllComments(prev => ({
        ...prev,
        [targetPin.id]: [...(prev[targetPin.id] || []), optimisticComment]
      }));

      // Clear input immediately for responsiveness
      const commentText = newComment;
      const file = selectedFile;
      setNewComment('');
      setSelectedFile(null);
      setPendingComment(null);

      // Submit comment (with or without attachment)
      let response;
      if (file) {
        const formData = new FormData();
        formData.append('pin_id', targetPin.id);
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
            pin_id: targetPin.id,
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
        [targetPin.id]: (prev[targetPin.id] || []).map(c =>
          c.id === optimisticComment.id ? realComment : c
        )
      }));

      toast.success('Comment added!');
      
      // Capture screenshot in background (non-blocking)
      captureScreenshotAsync(targetPin.id, realComment.id);
      
    } catch (error) {
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      if (targetPin) {
        setAllComments(prev => ({
          ...prev,
          [targetPin.id]: (prev[targetPin.id] || []).filter(c => c.id !== optimisticComment.id)
        }));
      }
      console.error('Failed to add comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, selectedFile, selectedPin, pendingComment, user, guestName, guestEmail, handleCreatePin, getAuthHeaders]);

  const captureScreenshotAsync = useCallback(async (pinId, commentId) => {
    // This runs in background and doesn't block UI
    try {
      // For now, we'll use a placeholder - in production, integrate with screen capture API
      // The screenshot would be captured from the user's screen
      console.log('Screenshot capture triggered for comment:', commentId);
    } catch (error) {
      console.error('Background screenshot capture failed:', error);
    }
  }, []);

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

  const handlePinClick = useCallback((pin) => {
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
    
    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      
      if (spaceIndex === -1) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  const handleMentionSelect = useCallback((user) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const newText = newComment.slice(0, lastAtIndex) + `@${user.name} `;
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

  const handlePageUrlChange = useCallback((url) => {
    setSelectedPageUrl(url);
    setCurrentPageUrl(url);
  }, []);

  const handleUpdateCurrentUrl = useCallback(() => {
    const url = prompt('Enter the current page URL:', currentPageUrl);
    if (url) {
      setCurrentPageUrl(url);
      toast.success('Current page URL updated');
    }
  }, [currentPageUrl]);

  // ==================== COMPUTED VALUES ====================

  const visiblePins = useMemo(() => {
    let filtered = pins;
    
    // Filter by page URL if selected
    if (selectedPageUrl) {
      filtered = filtered.filter(pin => pin.page_url === selectedPageUrl);
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
  }, [pins, selectedPageUrl, showResolved, searchQuery, sortOrder, allComments]);

  const pinCounts = useMemo(() => ({
    total: pins.length,
    open: pins.filter(p => p.status === 'open').length,
    resolved: pins.filter(p => p.status === 'resolved').length
  }), [pins]);

  const pageUrls = useMemo(() => {
    const urls = new Set(pins.map(p => p.page_url).filter(Boolean));
    if (project?.content_url) urls.add(project.content_url);
    return Array.from(urls);
  }, [pins, project]);

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
      
      <div className="flex-1 flex">
        {/* Main Content Area - Website Preview Controls */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-lg font-semibold" data-testid="project-name">{project.name}</h1>
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {currentPageUrl || project.content_url}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Mode Toggle - Always visible, doesn't hide sidebar */}
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

                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>

          {/* Website Preview Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-secondary/30">
            {project.type === 'url' ? (
              <div className="text-center max-w-lg">
                <Globe className="w-24 h-24 text-accent/30 mx-auto mb-6" />
                <h2 className="text-2xl font-semibold mb-4">Review Website</h2>
                <p className="text-muted-foreground mb-6">
                  Click the button below to open the website in a preview window. 
                  Navigate the site naturally, then add comments using the sidebar.
                </p>
                
                <div className="space-y-4">
                  <Button 
                    size="lg" 
                    onClick={openWebsiteWindow}
                    className="w-full"
                    data-testid="open-website-btn"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {websiteWindowRef && !websiteWindowRef.closed 
                      ? 'Focus Preview Window' 
                      : 'Open Website Preview'}
                  </Button>
                  
                  {websiteWindowRef && !websiteWindowRef.closed && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-700 dark:text-green-300 flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Website preview is open. Use the sidebar to add comments.
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Current Page URL:</p>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={currentPageUrl || ''} 
                        readOnly 
                        className="text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleUpdateCurrentUrl}
                        title="Update URL manually"
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Update this URL when you navigate to a different page to group comments correctly.
                    </p>
                  </div>
                </div>
              </div>
            ) : project.type === 'image' && project.file_path ? (
              <div className="w-full max-w-4xl">
                <img
                  src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                  alt={project.name}
                  className="w-full h-auto rounded-lg shadow-lg"
                  data-testid="project-image"
                />
              </div>
            ) : project.type === 'pdf' && project.file_path ? (
              <div className="w-full max-w-4xl h-[800px]">
                <embed
                  src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                  type="application/pdf"
                  className="w-full h-full rounded-lg shadow-lg"
                  data-testid="project-pdf"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">No preview available</p>
            )}
          </div>
        </div>

        {/* Sidebar - Always visible, never hidden */}
        <div className="w-96 border-l bg-card flex flex-col" data-testid="comments-sidebar">
          {/* Sidebar Header */}
          <div className="p-4 border-b">
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
              
              {mode === 'comment' && sidebarView === 'overview' && (
                <Button size="sm" onClick={handleAddCommentClick} data-testid="add-comment-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
              )}
            </div>

            {/* Page URL Filter */}
            {pageUrls.length > 1 && sidebarView === 'overview' && (
              <div className="mb-4">
                <Select value={selectedPageUrl || 'all'} onValueChange={(v) => handlePageUrlChange(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-full text-xs">
                    <Globe className="w-3 h-3 mr-2" />
                    <SelectValue placeholder="All pages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All pages</SelectItem>
                    {pageUrls.map((url) => (
                      <SelectItem key={url} value={url} className="text-xs">
                        {new URL(url).pathname || '/'}
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
                  visiblePins.map((pin, index) => {
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
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
                                <Globe className="w-3 h-3 mr-1" />
                                {new URL(pin.page_url).pathname}
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
                    {mode === 'comment' && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Click "Add Comment" to create your first comment
                      </p>
                    )}
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
          <div className="p-4 border-t bg-card">
            <div className="relative">
              <Textarea
                ref={commentInputRef}
                placeholder={mode === 'comment' 
                  ? "Add a comment... (use @ to mention)" 
                  : "Switch to Comment mode to add comments"}
                value={newComment}
                onChange={handleCommentChange}
                disabled={mode !== 'comment'}
                className="min-h-[80px] pr-10 resize-none"
                data-testid="comment-input"
              />
              
              {/* Mentions Dropdown */}
              {showMentions && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 w-full mb-1 bg-popover border rounded-md shadow-lg z-50">
                  {filteredMentionUsers.map((user, index) => (
                    <div
                      key={user.id || user.email}
                      className={`p-2 cursor-pointer hover:bg-secondary ${index === mentionIndex ? 'bg-secondary' : ''}`}
                      onClick={() => handleMentionSelect(user)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs">
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
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
                  disabled={mode !== 'comment'}
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                {selectedFile && (
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Paperclip className="w-3 h-3 mr-1" />
                    {selectedFile.name.slice(0, 20)}...
                    <button onClick={() => setSelectedFile(null)} className="ml-1 text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              
              <Button 
                size="sm"
                onClick={handleSubmitComment}
                disabled={mode !== 'comment' || isSubmitting || (!newComment.trim() && !selectedFile)}
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
                  handleAddCommentClick();
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
