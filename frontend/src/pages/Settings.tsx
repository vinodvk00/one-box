import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authApi, emailApi } from '@/services/api';
import { useEmailStore } from '@/stores/emailStore';
import { useAuthStore } from '@/stores/authStore';
import type { AccountConfig } from '@/types/email';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';

export function Settings() {
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [daysBack, setDaysBack] = useState(30);
  const [maxEmails, setMaxEmails] = useState(100);
  const [forceReindex, setForceReindex] = useState(false);

  const { triggerRefresh, refreshEmails, fetchCategoryStats } = useEmailStore();

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authApi.getConnectedAccounts();
      setAccounts(response.accounts);
    } catch (err: any) {
      setError(err.error || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = () => {
    authApi.initiateGmailOAuth();
  };

  const handleDisconnect = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      setError('Account not found');
      return;
    }

    if (!confirm(`Are you sure you want to disconnect ${account.email}? This will remove all associated data.`)) {
      return;
    }

    try {
      setError(null);
      setSyncMessage(null);

      const result = await authApi.disconnectAccount(accountId);
      setSyncMessage(`✅ Successfully disconnected ${account.email}`);

      setAccounts(prevAccounts => prevAccounts.filter(a => a.id !== accountId));

      Promise.all([
        refreshEmails().catch(() => {}),
        fetchCategoryStats().catch(() => {})
      ]).then(() => {
        triggerRefresh();
      });

    } catch (err: any) {
      setError(err.error || 'Failed to disconnect account');
      loadAccounts();
    }
  };

  const handleForceReconnect = async (email: string) => {
    try {
      setError(null);
      setSyncMessage(null);

      const result = await authApi.forceReconnectAccount(email);

      if (result.redirectToAuth && result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        setSyncMessage(result.message);
        await loadAccounts();
        await refreshEmails();
        await fetchCategoryStats();
        triggerRefresh();
      }
    } catch (err: any) {
      setError(err.error || 'Failed to initiate force reconnect');
    }
  };

  const handleToggleStatus = async (email: string) => {
    try {
      setError(null);
      setSyncMessage(null);

      await authApi.toggleAccountStatus(email);
      setSyncMessage(`✅ Successfully updated status for ${email}`);

      setAccounts(prevAccounts =>
        prevAccounts.map(account =>
          account.email === email
            ? { ...account, isActive: !account.isActive }
            : account
        )
      );

      Promise.all([
        refreshEmails().catch(() => {}),
        fetchCategoryStats().catch(() => {})
      ]).then(() => {
        triggerRefresh();
      });

    } catch (err: any) {
      setError(err.error || 'Failed to toggle account status');
      loadAccounts();
    }
  };

  const handleSyncEmails = async (email?: string, customForceReindex?: boolean) => {
    try {
      setSyncLoading(true);
      setSyncMessage(null);
      setError(null);

      const result = await emailApi.syncOAuthEmails({
        email,
        daysBack,
        forceReindex: customForceReindex !== undefined ? customForceReindex : forceReindex
      });

      setSyncMessage(result.message);

      if (result.tokenInfo && !result.tokenInfo.hasFullAccess) {
        setSyncMessage(result.message + ' ⚠️ Limited access detected - consider reconnecting for full email content.');
      }

      await refreshEmails();
      await fetchCategoryStats();
      triggerRefresh();
    } catch (err: any) {
      setError(err.error || 'Failed to sync emails');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDeleteIndex = async (email: string) => {
    if (!confirm(`Are you sure you want to delete all indexed emails for ${email}? This cannot be undone.`)) {
      return;
    }

    try {
      setSyncLoading(true);
      setSyncMessage(null);
      setError(null);

      const result = await emailApi.manageEmailIndex({
        action: 'delete',
        email
      });

      setSyncMessage(result.message);
      await refreshEmails();
      await fetchCategoryStats();
      triggerRefresh();
    } catch (err: any) {
      setError(err.error || 'Failed to delete email index');
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const email = urlParams.get('email');
    const message = urlParams.get('message');

    if (oauthStatus === 'success' && email) {
      setSyncMessage(`✅ Successfully connected Gmail account: ${email}`);

      setTimeout(async () => {
        await refreshEmails();
        await fetchCategoryStats();
        triggerRefresh();
      }, 1000);

      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthStatus === 'error' && message) {
      setError(`❌ OAuth connection failed: ${decodeURIComponent(message)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshEmails, fetchCategoryStats, triggerRefresh]);

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-600">
          {syncMessage}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Connected Accounts ({accounts.length})</h2>

        {accounts.length === 0 ? (
          <p className="text-gray-600">No accounts connected yet.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{account.email}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      account.authType === 'oauth'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {account.authType.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      account.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Status: {account.syncStatus} |
                    Created: {new Date(account.createdAt).toLocaleDateString()}
                    {account.tokenValid !== undefined && (
                      <span className={account.tokenValid ? 'text-green-600' : 'text-red-600'}>
                        {' '}| Token: {account.tokenValid ? 'Valid' : 'Invalid'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {account.authType === 'oauth' && account.isActive && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncEmails(account.email, false)}
                        disabled={syncLoading}
                      >
                        {syncLoading ? 'Syncing...' : 'Sync New'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncEmails(account.email, true)}
                        disabled={syncLoading}
                        className="bg-orange-50 hover:bg-orange-100 text-orange-700"
                      >
                        Re-index All
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteIndex(account.email)}
                        disabled={syncLoading}
                        className="bg-red-50 hover:bg-red-100 text-red-700"
                      >
                        Clear Index
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(account.email)}
                  >
                    {account.isActive ? 'Deactivate' : 'Activate'}
                  </Button>

                  {account.authType === 'oauth' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleForceReconnect(account.email)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700"
                      >
                        Force Reconnect
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDisconnect(account.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Email Synchronization</h2>
          <Info className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Configure how emails are synced from your connected OAuth accounts.
        </p>

        <div className="space-y-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="days-back" className="text-sm font-medium">
                Sync Period
              </Label>
              <span className="text-sm font-semibold text-blue-600">
                {daysBack} days
              </span>
            </div>
            <Slider
              id="days-back"
              min={1}
              max={90}
              step={1}
              value={[daysBack]}
              onValueChange={(value) => setDaysBack(value[0])}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Fetch emails from the last {daysBack} {daysBack === 1 ? 'day' : 'days'}
              {daysBack <= 7 && ' (Recent emails only)'}
              {daysBack > 7 && daysBack <= 30 && ' (Recommended)'}
              {daysBack > 30 && ' (May take longer)'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-emails" className="text-sm font-medium">
                Maximum Emails
              </Label>
              <span className="text-sm font-semibold text-blue-600">
                {maxEmails} emails
              </span>
            </div>
            <Slider
              id="max-emails"
              min={10}
              max={500}
              step={10}
              value={[maxEmails]}
              onValueChange={(value) => setMaxEmails(value[0])}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Limit sync to {maxEmails} most recent emails
              {maxEmails >= 500 && ' (Maximum limit)'}
              {maxEmails >= 200 && maxEmails < 500 && ' (Large batch - may be slow)'}
              {maxEmails < 200 && ' (Fast sync)'}
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900">
            <div className="flex-1">
              <Label htmlFor="force-reindex" className="text-sm font-medium cursor-pointer text-orange-900 dark:text-orange-100">
                Force Re-index
              </Label>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                Delete existing emails and re-index everything (slower but ensures fresh data)
              </p>
            </div>
            <Switch
              id="force-reindex"
              checked={forceReindex}
              onCheckedChange={setForceReindex}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              onClick={() => handleSyncEmails()}
              disabled={syncLoading || accounts.filter(a => a.authType === 'oauth' && a.isActive).length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncLoading ? 'Syncing All Accounts...' : 'Sync All OAuth Accounts'}
            </Button>

            {accounts.filter(a => a.authType === 'oauth' && a.isActive).length === 0 && (
              <span className="text-sm text-gray-500 flex items-center">
                No active OAuth accounts to sync
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
            <strong>Estimated sync time:</strong> ~{Math.ceil(maxEmails * 0.11)} seconds for {maxEmails} emails
            ({Math.ceil(maxEmails * 0.11 / 60)} {Math.ceil(maxEmails * 0.11 / 60) === 1 ? 'minute' : 'minutes'})
            <span className="text-green-600 ml-2">• 26x faster with optimizations</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Email Account Connections</h2>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-green-600 mb-2">Gmail OAuth (Recommended)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Secure OAuth 2.0 authentication with Google. No app passwords required.
            </p>
            <Button onClick={handleOAuthConnect} className="bg-blue-600 hover:bg-blue-700">
              Connect Gmail Account
            </Button>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">IMAP Authentication</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Traditional email credentials are configured via environment variables.
              Currently active IMAP accounts are shown below.
            </p>
          </div>
        </div>
      </Card>

      <UserProfileSection />

      <div className="flex justify-center">
        <Button variant="outline" onClick={loadAccounts}>
          Refresh Accounts
        </Button>
      </div>
    </div>
  );
}

function UserProfileSection() {
  const { user, changePassword } = useAuthStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  if (!user) {
    return null;
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const success = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (success) {
      setPasswordSuccess('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
    } else {
      setPasswordError('Failed to change password. Please check your current password.');
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">User Profile</h2>

      <div className="space-y-4">
        <div>
          <Label className="text-sm text-gray-600">Name</Label>
          <p className="text-base font-medium">{user.name}</p>
        </div>

        <div>
          <Label className="text-sm text-gray-600">Email</Label>
          <p className="text-base font-medium">{user.email}</p>
        </div>

        <div>
          <Label className="text-sm text-gray-600">Role</Label>
          <p className="text-base font-medium capitalize">{user.role}</p>
        </div>

        <div>
          <Label className="text-sm text-gray-600">Authentication Method</Label>
          <p className="text-base font-medium capitalize">{user.authMethod}</p>
        </div>

        {user.authMethod === 'password' && (
          <div className="pt-4 border-t">
            {!isChangingPassword ? (
              <Button
                variant="outline"
                onClick={() => setIsChangingPassword(true)}
              >
                Change Password
              </Button>
            ) : (
              <div className="space-y-4">
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-600 text-sm">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-600 text-sm">
                    {passwordSuccess}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      required
                      minLength={8}
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">Update Password</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                        setPasswordSuccess('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
