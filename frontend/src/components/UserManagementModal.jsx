import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import LockResetIcon from '@mui/icons-material/LockReset';
import DownloadIcon from '@mui/icons-material/Download';
import SecurityIcon from '@mui/icons-material/Security';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateUser, resetUserPassword, getUserActivityLog, getAllPermissions, getUserPermissions, updateUserPermissions, getAllBankLocations, getUserLocations, updateUserLocations } from '../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserManagementModal({ user, open, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bank_id: 1,
    role_id: null
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        bank_id: user.bank_id || 1,
        role_id: user.role_id || null
      });
    }
  }, [user]);

  // Fetch all available permissions (for the UI)
  const { data: allPermissions } = useQuery({
    queryKey: ['allPermissions'],
    queryFn: getAllPermissions,
    staleTime: 1000 * 60 * 60 // Cache for 1 hour - permissions don't change often
  });

  // Fetch user's current permissions
  const { data: userPermissions, isLoading: permissionsLoading, refetch: refetchPermissions } = useQuery({
    queryKey: ['userPermissions', user?.user_id],
    queryFn: () => getUserPermissions(user.user_id),
    enabled: false
  });

  // State for permission changes (local until saved)
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionsChanged, setPermissionsChanged] = useState(false);

  // Fetch activity log only when the tab is opened
  const { data: activityLog, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['userActivity', user?.user_id],
    queryFn: () => getUserActivityLog(user.user_id),
    enabled: false // Don't auto-fetch, only fetch when tab is opened
  });

  // Fetch all bank locations (for location assignment UI)
  const { data: allBankLocations } = useQuery({
    queryKey: ['bankLocations'],
    queryFn: getAllBankLocations,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch user's assigned locations
  const { data: userLocationData, refetch: refetchUserLocations } = useQuery({
    queryKey: ['userLocations', user?.user_id],
    queryFn: () => getUserLocations(user.user_id),
    enabled: false,
  });

  // Local state for location assignment
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [locationsChanged, setLocationsChanged] = useState(false);

  // Load permissions when Permissions tab is opened
  useEffect(() => {
    if (activeTab === 1 && user) {
      refetchPermissions();
    }
  }, [activeTab, user, refetchPermissions]);

  // Sync selectedPermissions with fetched data
  useEffect(() => {
    if (userPermissions?.permissions) {
      setSelectedPermissions(userPermissions.permissions);
      setPermissionsChanged(false);
    }
  }, [userPermissions]);

  // Load activity log when Activity tab is opened
  useEffect(() => {
    if (activeTab === 2 && user) {
      refetchActivity();
    }
  }, [activeTab, user, refetchActivity]);

  // Load user locations when Locations tab is opened
  useEffect(() => {
    if (activeTab === 4 && user) {
      refetchUserLocations();
    }
  }, [activeTab, user, refetchUserLocations]);

  // Sync selectedLocationIds with fetched data
  useEffect(() => {
    if (userLocationData?.location_ids) {
      setSelectedLocationIds(userLocationData.location_ids);
      setLocationsChanged(false);
    }
  }, [userLocationData]);

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: (data) => updateUser(user.user_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage('User updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to update user';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 5000);
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword(user.user_id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage(
        `Password reset successfully! Temporary password: ${data.temporary_password}`
      );
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to reset password';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 5000);
    }
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions) => updateUserPermissions(user.user_id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions', user.user_id] });
      setSuccessMessage('Permissions updated successfully!');
      setPermissionsChanged(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to update permissions';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 5000);
    }
  });

  // Update user locations mutation
  const updateLocationsMutation = useMutation({
    mutationFn: (locationIds) => updateUserLocations(user.user_id, locationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLocations', user.user_id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage('Locations updated successfully!');
      setLocationsChanged(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to update locations';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 5000);
    },
  });

  const handleLocationToggle = (locationId) => {
    setSelectedLocationIds((prev) => {
      const next = prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId];
      setLocationsChanged(true);
      return next;
    });
  };

  const handleSelectAllLocations = () => {
    const allIds = (allBankLocations || []).map((l) => l.location_id);
    const allSelected = allIds.every((id) => selectedLocationIds.includes(id));
    setSelectedLocationIds(allSelected ? [] : allIds);
    setLocationsChanged(true);
  };

  const handleSaveLocations = () => {
    updateLocationsMutation.mutate(selectedLocationIds);
  };

  // Permissions that require a prerequisite to be enabled first
  const PREREQUISITE_MAP = {
    'inventory:create': 'inventory:view',
    'inventory:edit': 'inventory:view',
    'inventory:delete': 'inventory:view',
  };

  // Reverse: which permissions depend on a given prerequisite
  const DEPENDENTS_MAP = {
    'inventory:view': ['inventory:create', 'inventory:edit', 'inventory:delete'],
  };

  const handlePermissionChange = (permissionKey) => {
    setSelectedPermissions(prev => {
      let newPermissions;
      if (prev.includes(permissionKey)) {
        // Unchecking: also remove any permissions that depend on this one
        const dependents = DEPENDENTS_MAP[permissionKey] || [];
        newPermissions = prev.filter(p => p !== permissionKey && !dependents.includes(p));
      } else {
        // Checking: also add the prerequisite if needed
        const prerequisite = PREREQUISITE_MAP[permissionKey];
        newPermissions = [...prev, permissionKey];
        if (prerequisite && !newPermissions.includes(prerequisite)) {
          newPermissions.push(prerequisite);
        }
      }
      setPermissionsChanged(true);
      return newPermissions;
    });
  };

  const handleSelectAllInGroup = (groupPermissions) => {
    setSelectedPermissions(prev => {
      const allSelected = groupPermissions.every(p => prev.includes(p));
      let newPermissions;
      if (allSelected) {
        // Deselect all in group
        newPermissions = prev.filter(p => !groupPermissions.includes(p));
      } else {
        // Select all in group
        newPermissions = [...new Set([...prev, ...groupPermissions])];
      }
      setPermissionsChanged(true);
      return newPermissions;
    });
  };

  const handleSavePermissions = () => {
    updatePermissionsMutation.mutate(selectedPermissions);
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    updateUserMutation.mutate(formData);
  };

  const handleResetPassword = () => {
    if (window.confirm(`Are you sure you want to reset ${user.name}'s password? They will be required to change it on next login.`)) {
      resetPasswordMutation.mutate();
    }
  };

  const handleClose = () => {
    setActiveTab(0);
    setSuccessMessage('');
    setErrorMessage('');
    setSelectedPermissions([]);
    setPermissionsChanged(false);
    setSelectedLocationIds([]);
    setLocationsChanged(false);
    onClose();
  };

  const handleExportActivityLog = () => {
    if (!activityLog || activityLog.length === 0) {
      alert('No activity log to export');
      return;
    }

    // Format activity log as plain text
    let textContent = `Activity Log for ${user.name}\n`;
    textContent += `Email: ${user.email}\n`;
    textContent += `User ID: ${user.user_id}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `${'='.repeat(60)}\n\n`;

    activityLog.forEach((log, index) => {
      textContent += `${index + 1}. ${log.action}\n`;
      textContent += `   Item: ${log.item_name || log.item_id || 'N/A'}\n`;
      textContent += `   Details: ${log.details || '-'}\n`;
      textContent += `   Timestamp: ${new Date(log.timestamp).toLocaleString()}\n`;
      textContent += `\n`;
    });

    // Open in new window
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('<pre style="font-family: monospace; padding: 20px;">');
      newWindow.document.write(textContent);
      newWindow.document.write('</pre>');
      newWindow.document.title = `Activity Log - ${user.name}`;
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the activity log');
    }
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Manage User: {user.name}</span>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="User Info" />
          <Tab label="Permissions" />
          <Tab label="Activity Log" />
          <Tab label="Security" />
          <Tab label="Locations" /*icon={<LocationOnIcon sx={{ fontSize: 16 }} />} iconPosition="start"*/ />
        </Tabs>
      </Box>

      <DialogContent>
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Tab 1: User Info & Password */}
        <TabPanel value={activeTab} index={0}>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Bank ID"
              type="number"
              value={formData.bank_id}
              onChange={(e) => setFormData({ ...formData, bank_id: parseInt(e.target.value) })}
              required
              fullWidth
            />
            <TextField
              label="Role"
              select
              value={formData.role_id || ''}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value || null })}
              fullWidth
              helperText="Select user's role"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value={1}>Admin</MenuItem>
              <MenuItem value={2}>Manager</MenuItem>
              <MenuItem value={3}>User</MenuItem>
            </TextField>

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateUserMutation.isPending}
                sx={{ backgroundColor: '#4f46e5', '&:hover': { backgroundColor: '#4338ca' } }}
              >
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<LockResetIcon />}
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </Box>

            {user.requires_password_change && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This user must change their password before accessing the system.
              </Alert>
            )}
          </form>
        </TabPanel>

        {/* Tab 2: Permissions */}
        <TabPanel value={activeTab} index={1}>
          {permissionsLoading ? (
            <Box className="flex justify-center py-8">
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <SecurityIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Select which actions this user can perform
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSavePermissions}
                  disabled={!permissionsChanged || updatePermissionsMutation.isPending}
                  sx={{ backgroundColor: '#4f46e5', '&:hover': { backgroundColor: '#4338ca' } }}
                >
                  {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                </Button>
              </Box>

              {user.role_id === 1 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This user has the Admin role and automatically has all permissions regardless of individual settings.
                </Alert>
              )}

              {allPermissions?.groups && Object.entries(allPermissions.groups).map(([groupName, groupPermKeys]) => (
                <Box key={groupName} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155' }}>
                      {groupName}
                    </Typography>
                    <Button
                      size="small"
                      sx={{ ml: 1, minWidth: 'auto', fontSize: '0.7rem' }}
                      onClick={() => handleSelectAllInGroup(groupPermKeys)}
                    >
                      {groupPermKeys.every(p => selectedPermissions.includes(p)) ? 'Deselect All' : 'Select All'}
                    </Button>
                  </Box>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormGroup>
                      {groupPermKeys.map(permKey => {
                        const permInfo = allPermissions.permissions.find(p => p.key === permKey);
                        const prerequisite = PREREQUISITE_MAP[permKey];
                        const isDisabled = prerequisite && !selectedPermissions.includes(prerequisite);
                        return (
                          <FormControlLabel
                            key={permKey}
                            control={
                              <Checkbox
                                checked={selectedPermissions.includes(permKey)}
                                onChange={() => handlePermissionChange(permKey)}
                                disabled={isDisabled}
                                sx={{ '&.Mui-checked': { color: '#4f46e5' } }}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500, opacity: isDisabled ? 0.5 : 1 }}>
                                  {permInfo?.name || permKey}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ opacity: isDisabled ? 0.5 : 1 }}>
                                  {permInfo?.description}{isDisabled ? ' (requires View permission)' : ''}
                                </Typography>
                              </Box>
                            }
                            sx={{ alignItems: 'flex-start', mb: 1 }}
                          />
                        );
                      })}
                    </FormGroup>
                  </Paper>
                </Box>
              ))}
            </Box>
          )}
        </TabPanel>

        {/* Tab 3: Activity Log */}
        <TabPanel value={activeTab} index={2}>
          {activityLoading ? (
            <Box className="flex justify-center py-8">
              <CircularProgress />
            </Box>
          ) : activityLog && activityLog.length > 0 ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportActivityLog}
                >
                  Export as TXT
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell><strong>Action</strong></TableCell>
                    <TableCell><strong>Item</strong></TableCell>
                    <TableCell><strong>Details</strong></TableCell>
                    <TableCell><strong>Timestamp</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activityLog.map((log, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={
                            log.action === 'CREATE' ? 'success' :
                            log.action === 'UPDATE' ? 'primary' :
                            log.action === 'DELETE' ? 'error' :
                            log.action === 'SCAN_IN' ? 'info' :
                            log.action === 'SCAN_OUT' ? 'warning' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{log.item_name || log.item_id || 'N/A'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{log.details || '-'}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          ) : (
            <Box className="text-center py-8">
              <p className="text-slate-600">No activity found for this user.</p>
            </Box>
          )}
        </TabPanel>

        {/* Tab 4: Security (Placeholder) */}
        <TabPanel value={activeTab} index={3}>
          <Box className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Security Settings</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Account Status:</span>
                  <Chip
                    label={user.requires_password_change ? 'Pending Password Change' : 'Active'}
                    color={user.requires_password_change ? 'warning' : 'success'}
                    size="small"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">User ID:</span>
                  <span className="text-slate-600">{user.user_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Email Verified:</span>
                  <Chip label="Not Implemented" size="small" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Two-Factor Auth:</span>
                  <Chip label="Not Enabled" size="small" />
                </div>
              </div>
            </div>

            <Alert severity="info">
              Additional security features coming soon:
              <ul className="list-disc list-inside mt-2">
                <li>Login history and session management</li>
                <li>Two-factor authentication setup</li>
                <li>Account lock/unlock controls</li>
                <li>Password expiration policies</li>
              </ul>
            </Alert>
          </Box>
        </TabPanel>

        {/* Tab 5: Locations */}
        <TabPanel value={activeTab} index={4}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Assign locations this user can access
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveLocations}
                disabled={!locationsChanged || updateLocationsMutation.isPending}
                sx={{ backgroundColor: '#4f46e5', '&:hover': { backgroundColor: '#4338ca' } }}
              >
                {updateLocationsMutation.isPending ? 'Saving...' : 'Save Locations'}
              </Button>
            </Box>

            {user.role_id === 1 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Admin users automatically have access to all locations regardless of assignments.
              </Alert>
            )}

            {!allBankLocations || allBankLocations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No locations have been created yet. Add locations in the Locations tab on the Admin page.
              </Typography>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          allBankLocations.length > 0 &&
                          allBankLocations.every((l) => selectedLocationIds.includes(l.location_id))
                        }
                        indeterminate={
                          selectedLocationIds.length > 0 &&
                          selectedLocationIds.length < allBankLocations.length
                        }
                        onChange={handleSelectAllLocations}
                        sx={{ '&.Mui-checked': { color: '#4f46e5' } }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Select All ({selectedLocationIds.length} of {allBankLocations.length})
                      </Typography>
                    }
                    sx={{ borderBottom: '1px solid #e2e8f0', pb: 1, mb: 1 }}
                  />
                  {allBankLocations.map((loc) => (
                    <FormControlLabel
                      key={loc.location_id}
                      control={
                        <Checkbox
                          checked={selectedLocationIds.includes(loc.location_id)}
                          onChange={() => handleLocationToggle(loc.location_id)}
                          sx={{ '&.Mui-checked': { color: '#4f46e5' } }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {loc.name}
                          </Typography>
                          {loc.address && (
                            <Typography variant="caption" color="text.secondary">
                              {loc.address}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', mb: 0.5 }}
                    />
                  ))}
                </FormGroup>
              </Paper>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
