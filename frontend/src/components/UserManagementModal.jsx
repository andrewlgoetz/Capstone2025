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
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import LockResetIcon from '@mui/icons-material/LockReset';
import DownloadIcon from '@mui/icons-material/Download';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateUser, resetUserPassword, getUserActivityLog } from '../services/api';

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

  // Fetch activity log only when the tab is opened
  const { data: activityLog, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['userActivity', user?.user_id],
    queryFn: () => getUserActivityLog(user.user_id),
    enabled: false // Don't auto-fetch, only fetch when tab is opened
  });

  // Load activity log when Activity tab is opened
  useEffect(() => {
    if (activeTab === 2 && user) {
      refetchActivity();
    }
  }, [activeTab, user, refetchActivity]);

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

        {/* Tab 2: Permissions (Placeholder) */}
        <TabPanel value={activeTab} index={1}>
          <Box className="text-center py-8">
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Granular Permissions & Role-Based Access
            </h3>
            <p className="text-slate-600 mb-4">
              This feature will allow you to configure fine-grained permissions for this user.
            </p>
            <Alert severity="info">
              Coming soon: Custom permission management, resource-level access control, and role customization.
            </Alert>
          </Box>
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
                  <TableRow>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell><strong>Action</strong></TableCell>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell><strong>Details</strong></TableCell>
                      <TableCell><strong>Timestamp</strong></TableCell>
                    </TableRow>
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
                            log.action === 'DELETE' ? 'error' : 'default'
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
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
