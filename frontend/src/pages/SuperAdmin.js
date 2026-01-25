import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Building2, Users, Database, TrendingUp, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SuperAdmin() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is super admin
    if (user?.email !== 'admin@markuply.com') {
      toast.error('Unauthorized access');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [teamsRes, usersRes, statsRes] = await Promise.all([
        axios.get(`${API}/superadmin/teams`, { headers: getAuthHeaders() }),
        axios.get(`${API}/superadmin/users`, { headers: getAuthHeaders() }),
        axios.get(`${API}/superadmin/stats`, { headers: getAuthHeaders() })
      ]);
      setTeams(teamsRes.data);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-4xl font-bold tracking-tight mb-8" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="superadmin-heading">
          Super Admin Dashboard
        </h1>

        {/* Stats Grid */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Teams</CardTitle>
                <Building2 className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total_teams || 0}</div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                <Users className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total_users || 0}</div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                <Database className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total_projects || 0}</div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Storage</CardTitle>
                <TrendingUp className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(stats.total_storage_mb / 1024).toFixed(1)}
                  <span className="text-lg text-muted-foreground ml-1">GB</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="teams">Teams & Subscriptions</TabsTrigger>
            <TabsTrigger value="users">All Users</TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Teams & Subscriptions</CardTitle>
                <CardDescription>View all registered teams and their subscription details</CardDescription>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search teams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {filteredTeams.map((team) => (
                      <Card key={team.id} className="border-border/40">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                {team.name}
                              </h3>
                              <p className="text-sm text-muted-foreground mb-3">
                                Owner: {team.owner_email || 'Unknown'}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Plan</p>
                                  <Badge variant="secondary" className="capitalize">
                                    {team.plan}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Members</p>
                                  <p className="font-medium">{team.member_count}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Projects</p>
                                  <p className="font-medium">{team.project_count || 0}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Storage</p>
                                  <p className="font-medium">{team.storage_used_mb.toFixed(1)} MB</p>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-3">
                                Created: {new Date(team.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>All Users</CardTitle>
                <CardDescription>Complete list of all registered users</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-border/40 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                            <span className="font-semibold text-accent">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary" className="capitalize">
                            {user.role}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
