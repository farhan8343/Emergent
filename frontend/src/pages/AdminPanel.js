import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Users, Mail, Trash2, TrendingUp, Database, MessageSquare, FolderOpen } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [loading, setLoading] = useState(true);
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'owner') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [statsRes, teamRes, membersRes, guestsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getAuthHeaders() }),
        axios.get(`${API}/teams/me`, { headers: getAuthHeaders() }),
        axios.get(`${API}/teams/members`, { headers: getAuthHeaders() }),
        axios.get(`${API}/admin/guests`, { headers: getAuthHeaders() })
      ]);
      setStats(statsRes.data);
      setTeam(teamRes.data);
      setMembers(membersRes.data);
      setGuests(guestsRes.data);
      setSelectedPlan(teamRes.data.plan);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/teams/invite`,
        { email: inviteEmail },
        { headers: getAuthHeaders() }
      );
      toast.success('Invitation sent!');
      setInviteEmail('');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error(error.response?.data?.detail || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await axios.delete(`${API}/teams/members/${memberId}`, {
        headers: getAuthHeaders()
      });
      setMembers(members.filter(m => m.id !== memberId));
      toast.success('Member removed');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleUpdatePlan = async () => {
    try {
      await axios.put(
        `${API}/teams/plan?plan=${selectedPlan}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Plan updated successfully!');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to update plan:', error);
      toast.error('Failed to update plan');
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
        <h1 className="text-4xl font-bold tracking-tight mb-8" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="admin-heading">
          Admin Panel
        </h1>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
              <FolderOpen className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-projects">{stats?.total_projects || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pins</CardTitle>
              <TrendingUp className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-pins">{stats?.total_pins || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Comments</CardTitle>
              <MessageSquare className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-comments">{stats?.total_comments || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Storage</CardTitle>
              <Database className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-storage">
                {stats?.storage_used_mb.toFixed(1) || 0}
                <span className="text-lg text-muted-foreground ml-1">MB</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Plan Management */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Subscription Plan</CardTitle>
              <CardDescription>Manage your team's subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger data-testid="plan-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (5 members, 1GB)</SelectItem>
                    <SelectItem value="pro">Pro (10 members, 5GB)</SelectItem>
                    <SelectItem value="business">Business (50 members, 20GB)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {team && (
                <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Team Members:</span>
                    <span className="font-medium">
                      {team.member_count} / {team.member_limit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Storage Used:</span>
                    <span className="font-medium">
                      {team.storage_used_mb.toFixed(1)} MB / {team.storage_limit_mb} MB
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpdatePlan}
                disabled={selectedPlan === team?.plan}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                data-testid="update-plan-btn"
              >
                Update Plan
              </Button>
            </CardContent>
          </Card>

          {/* Invite Members */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Invite Team Members</CardTitle>
              <CardDescription>Send invitations to join your team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    data-testid="invite-email-input"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-full"
                  data-testid="send-invite-btn"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Team Members List */}
        <Card className="mt-8 border-border/40">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Team Members ({members.length})</CardTitle>
            <CardDescription>Manage your team members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-border/40 rounded-lg"
                  data-testid={`member-${member.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-accent">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-secondary px-2 py-1 rounded capitalize">
                      {member.role}
                    </span>
                    {member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        data-testid={`remove-member-${member.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Guest Commenters */}
        <Card className="mt-8 border-border/40">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Guest Commenters ({guests.length})</CardTitle>
            <CardDescription>People who left comments without registration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {guests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No guest commenters yet
                </p>
              ) : (
                guests.map((guest, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-border/40 rounded-lg"
                    data-testid={`guest-${index}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <span className="font-semibold text-muted-foreground">
                          {guest.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{guest.name}</p>
                        <p className="text-sm text-muted-foreground">{guest.email}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      Guest
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}