import dotenv from 'dotenv';
dotenv.config();

interface AccountConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
}

const rawAccounts = [
    {
        user: process.env.GMAIL_USER_1,
        password: process.env.GMAIL_APP_PASSWORD_1,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
    },
    {
        user: process.env.GMAIL_USER_2,
        password: process.env.GMAIL_APP_PASSWORD_2,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
    },
    // todo: make it dynamic 
];

export const accounts: AccountConfig[] = rawAccounts.filter(
    (account): account is AccountConfig => {
        return !!account.user && !!account.password && !!account.host;
    }
);

if (accounts.length !== rawAccounts.length) {
    console.warn("Warning: One or more email accounts missing required credentials and have not been loaded.");
}