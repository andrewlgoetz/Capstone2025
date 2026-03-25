import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import LockResetIcon from '@mui/icons-material/LockReset';
import DownloadIcon from '@mui/icons-material/Download';
import SecurityIcon from '@mui/icons-material/Security';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateUser, resetUserPassword, getUserActivityLog, getAllPermissions, getUserPermissions, updateUserPermissions, getAllBankLocations, getUserLocations, updateUserLocations } from '../../services/api';

const ACTION_STYLES = {
  CREATE:   'bg-emerald-100 text-emerald-700',
  UPDATE:   'bg-blue-100 text-blue-700',
  DELETE:   'bg-red-100 text-red-700',
  SCAN_IN:  'bg-cyan-100 text-cyan-700',
  SCAN_OUT: 'bg-amber-100 text-amber-700',
};

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 transition";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

const TABS = ['User Info', 'Permissions', 'Activity Log', 'Security', 'Locations'];

const PREREQUISITE_MAP = {
  'inventory:create': 'inventory:view',
  'inventory:edit':   'inventory:view',
  'inventory:delete': 'inventory:view',
};

const DEPENDENTS_MAP = {
  'inventory:view': ['inventory:create', 'inventory:edit', 'inventory:delete'],
};

export default function UserManagementModal({ user, open, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', bank_id: 1, role_id: null });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [locationsChanged, setLocationsChanged] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', email: user.email || '', bank_id: user.bank_id || 1, role_id: user.role_id || null });
    }
  }, [user]);

  const { data: allPermissions } = useQuery({
    queryKey: ['allPermissions'],
    queryFn: getAllPermissions,
    staleTime: 1000 * 60 * 60,
  });

  const { data: userPermissions, isLoading: permissionsLoading, refetch: refetchPermissions } = useQuery({
    queryKey: ['userPermissions', user?.user_id],
    queryFn: () => getUserPermissions(user.user_id),
    enabled: false,
  });

  const { data: activityLog, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['userActivity', user?.user_id],
    queryFn: () => getUserActivityLog(user.user_id),
    enabled: false,
  });

  const { data: allBankLocations } = useQuery({
    queryKey: ['bankLocations'],
    queryFn: getAllBankLocations,
    staleTime: 1000 * 60 * 5,
  });

  const { data: userLocationData, refetch: refetchUserLocations } = useQuery({
    queryKey: ['userLocations', user?.user_id],
    queryFn: () => getUserLocations(user.user_id),
    enabled: false,
  });

  useEffect(() => { if (activeTab === 1 && user) refetchPermissions(); }, [activeTab, user, refetchPermissions]);
  useEffect(() => { if (userPermissions?.permissions) { setSelectedPermissions(userPermissions.permissions); setPermissionsChanged(false); } }, [userPermissions]);
  useEffect(() => { if (activeTab === 2 && user) refetchActivity(); }, [activeTab, user, refetchActivity]);
  useEffect(() => { if (activeTab === 4 && user) refetchUserLocations(); }, [activeTab, user, refetchUserLocations]);
  useEffect(() => { if (userLocationData?.location_ids) { setSelectedLocationIds(userLocationData.location_ids); setLocationsChanged(false); } }, [userLocationData]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => updateUser(user.user_id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSuccessMessage('User updated successfully!'); setTimeout(() => setSuccessMessage(''), 3000); },
    onError: (error) => { setErrorMessage(error.response?.data?.detail || 'Failed to update user'); setTimeout(() => setErrorMessage(''), 5000); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword(user.user_id),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSuccessMessage(`Password reset! Temporary password: ${data.temporary_password}`); },
    onError: (error) => { setErrorMessage(error.response?.data?.detail || 'Failed to reset password'); setTimeout(() => setErrorMessage(''), 5000); },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions) => updateUserPermissions(user.user_id, permissions),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['userPermissions', user.user_id] }); setSuccessMessage('Permissions updated!'); setPermissionsChanged(false); setTimeout(() => setSuccessMessage(''), 3000); },
    onError: (error) => { setErrorMessage(error.response?.data?.detail || 'Failed to update permissions'); setTimeout(() => setErrorMessage(''), 5000); },
  });

  const updateLocationsMutation = useMutation({
    mutationFn: (locationIds) => updateUserLocations(user.user_id, locationIds),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['userLocations', user.user_id] }); queryClient.invalidateQueries({ queryKey: ['users'] }); setSuccessMessage('Locations updated!'); setLocationsChanged(false); setTimeout(() => setSuccessMessage(''), 3000); },
    onError: (error) => { setErrorMessage(error.response?.data?.detail || 'Failed to update locations'); setTimeout(() => setErrorMessage(''), 5000); },
  });

  const handlePermissionChange = (permissionKey) => {
    setSelectedPermissions(prev => {
      let next;
      if (prev.includes(permissionKey)) {
        const dependents = DEPENDENTS_MAP[permissionKey] || [];
        next = prev.filter(p => p !== permissionKey && !dependents.includes(p));
      } else {
        const prerequisite = PREREQUISITE_MAP[permissionKey];
        next = [...prev, permissionKey];
        if (prerequisite && !next.includes(prerequisite)) next.push(prerequisite);
      }
      setPermissionsChanged(true);
      return next;
    });
  };

  const handleSelectAllInGroup = (groupPermKeys) => {
    setSelectedPermissions(prev => {
      const allSelected = groupPermKeys.every(p => prev.includes(p));
      const next = allSelected ? prev.filter(p => !groupPermKeys.includes(p)) : [...new Set([...prev, ...groupPermKeys])];
      setPermissionsChanged(true);
      return next;
    });
  };

  const handleLocationToggle = (locationId) => {
    setSelectedLocationIds(prev => {
      const next = prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId];
      setLocationsChanged(true);
      return next;
    });
  };

  const handleSelectAllLocations = () => {
    const allIds = (allBankLocations || []).map(l => l.location_id);
    const allSelected = allIds.every(id => selectedLocationIds.includes(id));
    setSelectedLocationIds(allSelected ? [] : allIds);
    setLocationsChanged(true);
  };

  const handleResetPassword = () => {
    if (window.confirm(`Reset ${user.name}'s password? They will be required to change it on next login.`)) {
      resetPasswordMutation.mutate();
    }
  };

  const handleClose = () => {
    setActiveTab(0); setSuccessMessage(''); setErrorMessage('');
    setSelectedPermissions([]); setPermissionsChanged(false);
    setSelectedLocationIds([]); setLocationsChanged(false);
    onClose();
  };

  const handleExportActivityLog = () => {
    if (!activityLog || activityLog.length === 0) { alert('No activity log to export'); return; }
    let text = `Activity Log for ${user.name}\nEmail: ${user.email}\nUser ID: ${user.user_id}\nGenerated: ${new Date().toLocaleString()}\n${'='.repeat(60)}\n\n`;
    activityLog.forEach((log, i) => {
      text += `${i + 1}. ${log.action}\n   Item: ${log.item_name || log.item_id || 'N/A'}\n   Details: ${log.details || '-'}\n   Timestamp: ${new Date(log.timestamp).toLocaleString()}\n\n`;
    });
    const w = window.open('', '_blank');
    if (w) { w.document.write(`<pre style="font-family:monospace;padding:20px">${text}</pre>`); w.document.title = `Activity Log - ${user.name}`; w.document.close(); }
    else alert('Please allow pop-ups to view the activity log');
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Manage User: {user.name}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 hover:text-slate-600 transition">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0 px-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === i
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {successMessage && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{successMessage}</div>
          )}
          {errorMessage && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{errorMessage}</div>
          )}

          {/* Tab 0: User Info */}
          {activeTab === 0 && (
            <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate(formData); }} className="space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input className={inputClass} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>Bank ID</label>
                <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={1} disabled />
                <p className="text-xs text-slate-400 mt-1">Bank ID is managed automatically</p>
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select className={inputClass} value={formData.role_id || ''} onChange={e => setFormData({ ...formData, role_id: e.target.value || null })}>
                  <option value="">None</option>
                  <option value={1}>Admin</option>
                  <option value={2}>Manager</option>
                  <option value={3}>User</option>
                </select>
              </div>
              {user.requires_password_change && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  This user must change their password before accessing the system.
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60"
                >
                  <SaveIcon fontSize="small" />
                  {updateUserMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-white rounded-xl text-sm font-medium hover:bg-amber-50 transition disabled:opacity-60"
                >
                  <LockResetIcon fontSize="small" />
                  {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 1: Permissions */}
          {activeTab === 1 && (
            permissionsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <SecurityIcon fontSize="small" /> Select which actions this user can perform
                  </p>
                  <button
                    onClick={() => updatePermissionsMutation.mutate(selectedPermissions)}
                    disabled={!permissionsChanged || updatePermissionsMutation.isPending}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    <SaveIcon fontSize="small" />
                    {updatePermissionsMutation.isPending ? 'Saving…' : 'Save Permissions'}
                  </button>
                </div>

                {user.role_id === 1 && (
                  <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                    This user has the Admin role and automatically has all permissions.
                  </div>
                )}

                {allPermissions?.groups && Object.entries(allPermissions.groups).map(([groupName, groupPermKeys]) => (
                  <div key={groupName} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-slate-700">{groupName}</span>
                      <button
                        onClick={() => handleSelectAllInGroup(groupPermKeys)}
                        className="text-xs text-slate-500 hover:text-slate-700 underline"
                      >
                        {groupPermKeys.every(p => selectedPermissions.includes(p)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                      {groupPermKeys.map(permKey => {
                        const permInfo = allPermissions.permissions.find(p => p.key === permKey);
                        const prerequisite = PREREQUISITE_MAP[permKey];
                        const isDisabled = prerequisite && !selectedPermissions.includes(prerequisite);
                        return (
                          <label key={permKey} className={`flex items-start gap-3 cursor-pointer ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(permKey)}
                              onChange={() => handlePermissionChange(permKey)}
                              disabled={isDisabled}
                              className="mt-0.5 accent-slate-800"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-700">{permInfo?.name || permKey}</p>
                              <p className="text-xs text-slate-400">{permInfo?.description}{isDisabled ? ' (requires View permission)' : ''}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Tab 2: Activity Log */}
          {activeTab === 2 && (
            activityLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              <>
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleExportActivityLog}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <DownloadIcon fontSize="small" /> Export as TXT
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Action', 'Item', 'Details', 'Timestamp'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {activityLog.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${ACTION_STYLES[log.action] || 'bg-slate-100 text-slate-600'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{log.item_name || log.item_id || 'N/A'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{log.details || '-'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-gray-200 rounded-xl">
                No activity found for this user.
              </div>
            )
          )}

          {/* Tab 3: Security */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-700">Security Settings</h3>
              <div className="bg-slate-50 rounded-xl border border-gray-200 p-4 space-y-3">
                {[
                  { label: 'Account Status', value: user.requires_password_change ? 'Pending Password Change' : 'Active', style: user.requires_password_change ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700' },
                  { label: 'User ID', value: user.user_id, plain: true },
                  { label: 'Email Verified', value: 'Not Implemented', style: 'bg-slate-100 text-slate-600' },
                  { label: 'Two-Factor Auth', value: 'Not Enabled', style: 'bg-slate-100 text-slate-600' },
                ].map(({ label, value, style, plain }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">{label}</span>
                    {plain
                      ? <span className="text-sm text-slate-500">{value}</span>
                      : <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style}`}>{value}</span>
                    }
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                Additional security features coming soon:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Login history and session management</li>
                  <li>Two-factor authentication setup</li>
                  <li>Account lock/unlock controls</li>
                  <li>Password expiration policies</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 4: Locations */}
          {activeTab === 4 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <LocationOnIcon fontSize="small" /> Assign locations this user can access
                </p>
                <button
                  onClick={() => updateLocationsMutation.mutate(selectedLocationIds)}
                  disabled={!locationsChanged || updateLocationsMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                >
                  <SaveIcon fontSize="small" />
                  {updateLocationsMutation.isPending ? 'Saving…' : 'Save Locations'}
                </button>
              </div>

              {user.role_id === 1 && (
                <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                  Admin users automatically have access to all locations.
                </div>
              )}

              {!allBankLocations || allBankLocations.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  No locations have been created yet. Add locations in the Locations tab on the Admin page.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  {/* Select all */}
                  <label className="flex items-center gap-3 cursor-pointer pb-2 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={allBankLocations.length > 0 && allBankLocations.every(l => selectedLocationIds.includes(l.location_id))}
                      ref={el => { if (el) el.indeterminate = selectedLocationIds.length > 0 && selectedLocationIds.length < allBankLocations.length; }}
                      onChange={handleSelectAllLocations}
                      className="accent-slate-800"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      Select All ({selectedLocationIds.length} of {allBankLocations.length})
                    </span>
                  </label>
                  {allBankLocations.map(loc => (
                    <label key={loc.location_id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLocationIds.includes(loc.location_id)}
                        onChange={() => handleLocationToggle(loc.location_id)}
                        className="mt-0.5 accent-slate-800"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{loc.name}</p>
                        {loc.address && <p className="text-xs text-slate-400">{loc.address}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
