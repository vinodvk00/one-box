import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authApi, emailApi } from '@/services/api';
import type { AccountConfig } from '@/types/email';

export function Settings() {
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await authApi.getConnectedAccounts();
      setAccounts(response.accounts);
      setError(null);
    } catch (err: any) {
      setError(err.error || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = () => {
    authApi.initiateGmailOAuth();
  };

  const handleDisconnect = async (email: string) => {
    try {
      await authApi.disconnectAccount(email);
      await loadAccounts(); // Reload accounts
    } catch (err: any) {
      setError(err.error || 'Failed to disconnect account');
    }
  };

  const handleForceReconnect = async (email: string) => {
    try {
      setError(null);
      const result = await authApi.forceReconnectAccount(email);

      if (result.redirectToAuth && result.authUrl) {
        // Redirect to OAuth flow
        window.location.href = result.authUrl;
      } else {
        setSyncMessage(result.message);
      }
    } catch (err: any) {
      setError(err.error || 'Failed to initiate force reconnect');
    }
  };

  const handleToggleStatus = async (email: string) => {
    try {
      await authApi.toggleAccountStatus(email);
      await loadAccounts(); // Reload accounts
    } catch (err: any) {
      setError(err.error || 'Failed to toggle account status');
    }
  };

  const handleSyncEmails = async (email?: string, forceReindex: boolean = false) => {
    try {
      setSyncLoading(true);
      setSyncMessage(null);
      setError(null);

      const result = await emailApi.syncOAuthEmails({
        email,
        daysBack: 3,
        forceReindex
      });

      setSyncMessage(result.message);

      // Show token permission info if available
      if (result.tokenInfo && !result.tokenInfo.hasFullAccess) {
        setSyncMessage(result.message + ' ⚠️ Limited access detected - consider reconnecting for full email content.');
      }

      console.log('✅ Email sync completed:', result);
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
    } catch (err: any) {
      setError(err.error || 'Failed to delete email index');
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    // Handle OAuth redirect parameters
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const email = urlParams.get('email');
    const message = urlParams.get('message');

    if (oauthStatus === 'success' && email) {
      setSyncMessage(`✅ Successfully connected Gmail account: ${email}`);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthStatus === 'error' && message) {
      setError(`❌ OAuth connection failed: ${decodeURIComponent(message)}`);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

      {/* Connected Accounts List */}
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
                        onClick={() => handleDisconnect(account.email)}
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

      {/* Email Sync Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Email Synchronization</h2>
        <p className="text-sm text-gray-600 mb-4">
          Sync emails from your connected OAuth accounts. By default, emails from the last 3 days will be fetched.
        </p>

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
      </Card>

      {/* OAuth Connection Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Email Account Connections</h2>

        <div className="space-y-4">
          {/* Gmail OAuth Option */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-green-600 mb-2">🔒 Gmail OAuth (Recommended)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Secure OAuth 2.0 authentication with Google. No app passwords required.
            </p>
            <Button onClick={handleOAuthConnect} className="bg-blue-600 hover:bg-blue-700">
              Connect Gmail Account
            </Button>
          </div>

          {/* IMAP Info */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-600 mb-2">📧 IMAP Authentication</h3>
            <p className="text-sm text-gray-600">
              Traditional email credentials are configured via environment variables.
              Currently active IMAP accounts are shown below.
            </p>
          </div>
        </div>
      </Card>

      

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={loadAccounts}>
          Refresh Accounts
        </Button>
      </div>
    </div>
  );
}
