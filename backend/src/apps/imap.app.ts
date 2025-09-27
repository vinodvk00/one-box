import { accounts } from '../config/accounts';
import { startSyncForAccount, ImapConfig } from '../services/imap.service';

const initializeEmailSync = () => {
    console.log('Starting email synchronization for all loaded accounts...');

    if (accounts.length === 0) {
        console.warn('No complete email account configurations found. Skipping IMAP sync.');
        return;
    }

    accounts.forEach(account => {
        const config: ImapConfig = {
            host: account.host,
            port: account.port,
            secure: account.tls,
            auth: {
                user: account.user,
                pass: account.password,
            },
        };

        startSyncForAccount(config).catch(err => {
            console.error(`Failed to start sync for ${account.user}:`, err);
        });
    });
};

export default initializeEmailSync;