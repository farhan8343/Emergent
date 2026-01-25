import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Check, MessageSquare, X } from 'lucide-react';

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
  const [isGuest, setIsGuest] = useState(false);
  const canvasRef = useRef(null);
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (selectedPin) {
      fetchComments(selectedPin.id);
    }
  }, [selectedPin]);

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
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    try {
      const response = await axios.post(
        `${API}/pins`,
        { project_id: id, x, y },
        { headers: getAuthHeaders() }
      );
      setPins([...pins, response.data]);
      setSelectedPin(response.data);
      toast.success('Pin created');
    } catch (error) {
      console.error('Failed to create pin:', error);
      toast.error('Failed to create pin');
    }
  };

  const handlePinClick = (pin, e) => {
    e.stopPropagation();
    setSelectedPin(pin);
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

      setComments([...comments, response.data]);
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleResolvePin = async () => {
    if (!selectedPin) return;

    try {
      const newStatus = selectedPin.status === 'open' ? 'resolved' : 'open';
      await axios.put(
        `${API}/pins/${selectedPin.id}/status?status=${newStatus}`,
        {},
        { headers: getAuthHeaders() }
      );

      setPins(pins.map(p => p.id === selectedPin.id ? { ...p, status: newStatus } : p));
      setSelectedPin({ ...selectedPin, status: newStatus });
      toast.success(`Pin ${newStatus}`);
    } catch (error) {
      console.error('Failed to update pin status:', error);
      toast.error('Failed to update pin status');
    }
  };

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
        {/* Canvas Area */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              data-testid="canvas-back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="project-title">
              {project.name}
            </h1>
            <div className="w-24"></div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div
              ref={canvasRef}
              className="markup-canvas relative"
              onClick={handleCanvasClick}
              style={{ minHeight: '600px' }}
              data-testid="markup-canvas"
            >
              {project.type === 'url' && project.content_url && (
                <iframe
                  src={project.content_url}
                  className="w-full h-[800px] border-0"
                  title={project.name}
                  data-testid="canvas-iframe"
                />
              )}
              {project.type === 'image' && project.file_path && (
                <img
                  src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                  alt={project.name}
                  className="max-w-full h-auto"
                  data-testid="canvas-image"
                />
              )}
              {project.type === 'pdf' && project.file_path && (
                <embed
                  src={`${BACKEND_URL}/api/files/projects/${project.file_path.split('/').pop()}`}
                  type="application/pdf"
                  className="w-full h-[800px]"
                  data-testid="canvas-pdf"
                />
              )}

              {/* Pin Markers */}
              {pins.map((pin, index) => (
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
                  {pin.status === 'resolved' ? <Check className="w-4 h-4" /> : index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comments Sidebar */}
        <div className="w-96 bg-white border-l border-border/40 flex flex-col" data-testid="comments-sidebar">
          {selectedPin ? (
            <>
              <div className="p-4 border-b border-border/40 flex items-center justify-between">
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

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
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
                  Select a pin
                </h3>
                <p className="text-sm text-muted-foreground">
                  Click on a pin to view and add comments
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}