import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authApi } from '@/services/api';
import type { AccountConfig } from '@/types/email';

export function Settings() {
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleToggleStatus = async (email: string) => {
    try {
      await authApi.toggleAccountStatus(email);
      await loadAccounts(); // Reload accounts
    } catch (err: any) {
      setError(err.error || 'Failed to toggle account status');
    }
  };

  useEffect(() => {
    loadAccounts();
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

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(account.email)}
                  >
                    {account.isActive ? 'Deactivate' : 'Activate'}
                  </Button>

                  {account.authType === 'oauth' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDisconnect(account.email)}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
