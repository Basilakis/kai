import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  Mail as MailIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { api } from '../../services/api';

interface TeamMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'invited' | 'active' | 'suspended';
  email: string;
  joinedAt?: string;
  user?: {
    name?: string;
    email: string;
    avatarUrl?: string;
  };
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  tierId: string;
  status: string;
  seats: number;
  usedSeats: number;
  startDate: string;
  renewalDate?: string;
  userRole?: 'owner' | 'admin' | 'member';
}

interface TeamSubscriptionManagerProps {
  userId: string;
}

const TeamSubscriptionManager: React.FC<TeamSubscriptionManagerProps> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openLeaveDialog, setOpenLeaveDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState('');

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const response = await api.get('/subscriptions/teams');
        setTeams(response.data.data);
        
        // Select the first team by default if available
        if (response.data.data.length > 0) {
          setSelectedTeam(response.data.data[0]);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
        toast.error('Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Fetch team members when a team is selected
  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  // Fetch team members
  const fetchTeamMembers = async (teamId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/subscriptions/teams/${teamId}/members`);
      setTeamMembers(response.data.data);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  // Create a new team
  const handleCreateTeam = async () => {
    if (!newTeamName) {
      setError('Team name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/subscriptions/teams', {
        name: newTeamName,
        tierId: 'basic', // Default tier
        seats: 5, // Default seats
        paymentMethodId: 'pm_card_visa' // This would come from a payment form in a real app
      });
      
      const createdTeam = response.data.data;
      setTeams(prevTeams => [...prevTeams, createdTeam]);
      setSelectedTeam(createdTeam);
      setOpenCreateDialog(false);
      
      // Reset form
      setNewTeamName('');
      
      toast.success('Team created successfully');
    } catch (error) {
      console.error('Error creating team:', error);
      setError('Failed to create team');
      toast.error('Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  // Invite a member to the team
  const handleInviteMember = async () => {
    if (!selectedTeam) return;
    
    if (!inviteEmail) {
      setError('Email is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.post(`/subscriptions/teams/${selectedTeam.id}/members`, {
        email: inviteEmail,
        role: inviteRole
      });
      
      // Refresh team members
      fetchTeamMembers(selectedTeam.id);
      
      setOpenInviteDialog(false);
      
      // Reset form
      setInviteEmail('');
      setInviteRole('member');
      
      toast.success('Invitation sent successfully');
    } catch (error) {
      console.error('Error inviting member:', error);
      setError('Failed to send invitation');
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  // Remove a member from the team
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    
    setLoading(true);
    
    try {
      await api.delete(`/subscriptions/teams/${selectedTeam.id}/members/${memberId}`);
      
      // Update the members list
      setTeamMembers(prevMembers => prevMembers.filter(member => member.id !== memberId));
      
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  // Leave the team
  const handleLeaveTeam = async () => {
    if (!selectedTeam) return;
    
    setLoading(true);
    
    try {
      // Find the current user's member ID
      const currentMember = teamMembers.find(member => member.userId === userId);
      
      if (currentMember) {
        await api.delete(`/subscriptions/teams/${selectedTeam.id}/members/${currentMember.id}`);
        
        // Remove the team from the list
        setTeams(prevTeams => prevTeams.filter(team => team.id !== selectedTeam.id));
        
        // Select another team if available
        if (teams.length > 1) {
          const nextTeam = teams.find(team => team.id !== selectedTeam.id);
          setSelectedTeam(nextTeam || null);
        } else {
          setSelectedTeam(null);
        }
        
        setOpenLeaveDialog(false);
        
        toast.success('You have left the team');
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error('Failed to leave team');
    } finally {
      setLoading(false);
    }
  };

  // Delete the team
  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    
    setLoading(true);
    
    try {
      await api.delete(`/subscriptions/teams/${selectedTeam.id}`);
      
      // Remove the team from the list
      setTeams(prevTeams => prevTeams.filter(team => team.id !== selectedTeam.id));
      
      // Select another team if available
      if (teams.length > 1) {
        const nextTeam = teams.find(team => team.id !== selectedTeam.id);
        setSelectedTeam(nextTeam || null);
      } else {
        setSelectedTeam(null);
      }
      
      setOpenDeleteDialog(false);
      
      toast.success('Team deleted successfully');
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Render team selector
  const renderTeamSelector = () => (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Your Teams</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Team
        </Button>
      </Box>
      
      {loading && !teams.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : teams.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            You don't have any teams yet.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
            sx={{ mt: 2 }}
          >
            Create Your First Team
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {teams.map((team) => (
            <Grid item xs={12} sm={6} md={4} key={team.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  border: selectedTeam?.id === team.id ? '2px solid' : 'none',
                  borderColor: 'primary.main'
                }}
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {team.name}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Members:
                    </Typography>
                    <Typography variant="body2">
                      {team.usedSeats} / {team.seats}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Your Role:
                    </Typography>
                    <Chip 
                      label={team.userRole} 
                      size="small"
                      color={team.userRole === 'owner' ? 'primary' : 'default'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <Chip 
                      label={team.status} 
                      size="small"
                      color={team.status === 'active' ? 'success' : 'warning'}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  // Render team details
  const renderTeamDetails = () => {
    if (!selectedTeam) return null;
    
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">{selectedTeam.name}</Typography>
          <Box>
            {selectedTeam.userRole === 'owner' ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteDialog(true)}
                sx={{ ml: 1 }}
              >
                Delete Team
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="error"
                onClick={() => setOpenLeaveDialog(true)}
                sx={{ ml: 1 }}
              >
                Leave Team
              </Button>
            )}
          </Box>
        </Box>
        
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="team tabs">
            <Tab label="Members" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Subscription" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Settings" id="tab-2" aria-controls="tabpanel-2" />
          </Tabs>
          
          <Box role="tabpanel" hidden={tabValue !== 0} id="tabpanel-0" aria-labelledby="tab-0" sx={{ p: 3 }}>
            {tabValue === 0 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Team Members</Typography>
                  {(selectedTeam.userRole === 'owner' || selectedTeam.userRole === 'admin') && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PersonAddIcon />}
                      onClick={() => setOpenInviteDialog(true)}
                    >
                      Invite Member
                    </Button>
                  )}
                </Box>
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List>
                    {teamMembers.map((member) => (
                      <ListItem key={member.id} divider>
                        <ListItemAvatar>
                          <PersonIcon />
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.user?.name || member.email}
                          secondary={
                            <Box>
                              <Typography variant="body2" component="span">
                                {member.email}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <Chip 
                                  label={member.role} 
                                  size="small" 
                                  color={member.role === 'owner' ? 'primary' : 'default'}
                                  sx={{ mr: 1 }}
                                />
                                <Chip 
                                  label={member.status} 
                                  size="small"
                                  color={member.status === 'active' ? 'success' : 'warning'}
                                />
                              </Box>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          {(selectedTeam.userRole === 'owner' || 
                            (selectedTeam.userRole === 'admin' && member.role !== 'owner' && member.role !== 'admin')) && 
                            member.userId !== userId && (
                            <Tooltip title="Remove Member">
                              <IconButton
                                edge="end"
                                color="error"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}
          </Box>
          
          <Box role="tabpanel" hidden={tabValue !== 1} id="tabpanel-1" aria-labelledby="tab-1" sx={{ p: 3 }}>
            {tabValue === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>Subscription Details</Typography>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Subscription Tier
                    </Typography>
                    <Typography variant="body1">
                      {selectedTeam.tierId.charAt(0).toUpperCase() + selectedTeam.tierId.slice(1)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="body1">
                      <Chip 
                        label={selectedTeam.status} 
                        size="small"
                        color={selectedTeam.status === 'active' ? 'success' : 'warning'}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Seats
                    </Typography>
                    <Typography variant="body1">
                      {selectedTeam.usedSeats} used of {selectedTeam.seats} total
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Start Date
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(selectedTeam.startDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Next Renewal
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(selectedTeam.renewalDate)}
                    </Typography>
                  </Grid>
                </Grid>
                
                {selectedTeam.userRole === 'owner' && (
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={loading}
                    >
                      Manage Subscription
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
          
          <Box role="tabpanel" hidden={tabValue !== 2} id="tabpanel-2" aria-labelledby="tab-2" sx={{ p: 3 }}>
            {tabValue === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>Team Settings</Typography>
                
                <TextField
                  fullWidth
                  margin="normal"
                  label="Team Name"
                  value={selectedTeam.name}
                  disabled={selectedTeam.userRole !== 'owner'}
                  sx={{ mb: 3 }}
                />
                
                {selectedTeam.userRole === 'owner' && (
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={loading}
                    >
                      Save Changes
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  };

  return (
    <Box>
      {renderTeamSelector()}
      
      <Divider sx={{ my: 4 }} />
      
      {renderTeamDetails()}
      
      {/* Create Team Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Create a new team to collaborate with others. You'll be the owner of this team.
          </DialogContentText>
          
          <TextField
            fullWidth
            margin="normal"
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="My Team"
          />
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateTeam}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Invite Member Dialog */}
      <Dialog open={openInviteDialog} onClose={() => setOpenInviteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Invite someone to join your team. They'll receive an email invitation.
          </DialogContentText>
          
          <TextField
            fullWidth
            margin="normal"
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
          />
          
          <TextField
            select
            fullWidth
            margin="normal"
            label="Role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
            SelectProps={{
              native: true,
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </TextField>
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInviteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleInviteMember}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Team Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Delete Team</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the team "{selectedTeam?.name}"? This action cannot be undone and will remove all team members.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTeam}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete Team'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Leave Team Dialog */}
      <Dialog open={openLeaveDialog} onClose={() => setOpenLeaveDialog(false)}>
        <DialogTitle>Leave Team</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to leave the team "{selectedTeam?.name}"? You'll lose access to all team resources.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLeaveDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleLeaveTeam}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Leave Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamSubscriptionManager;
