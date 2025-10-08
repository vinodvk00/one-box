export interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface TokenSet {
    accessToken: string;
    refreshToken?: string;
    expiryDate?: number;
    scope?: string[];
}

export interface BaseAccountConfig {
    id: string;
    email: string;
    authType: 'imap' | 'oauth';
    isActive: boolean;
    createdAt: Date;
    lastSyncAt?: Date;
    syncStatus: 'idle' | 'syncing' | 'error' | 'disconnected';
}

export interface ImapAccountConfig extends BaseAccountConfig {
    authType: 'imap';
    host: string;
    port: number;
    tls: boolean;
    password: string;
}

export interface OAuthAccountConfig extends BaseAccountConfig {
    authType: 'oauth';
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scope: string[];
}

export type AccountConfig = ImapAccountConfig | OAuthAccountConfig;

export interface OAuthTokenDocument {
    id: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scope: string[];
    createdAt: Date;
    lastUsed?: Date;
}

export interface AccountConfigDocument {
    id: string;
    userId: string;
    email: string;
    authType: 'imap' | 'oauth';
    isPrimary: boolean;
    isActive: boolean;
    imapConfig?: {
        host: string;
        port: number;
        secure: boolean;
        password?: string; // encrypted
    };
    createdAt: Date;
    lastSyncAt?: Date;
    syncStatus: 'idle' | 'syncing' | 'error' | 'disconnected';
}