import { Request, Response, NextFunction } from 'express';
import { getAccountConfigById } from '../services/oauth-storage.service';

/**
 * Middleware to require authentication
 * Checks if user is logged in (has valid session)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Please login to access this resource'
        });
        return;
    }
    next();
};

/**
 * Middleware to require admin role
 * Must be used after requireAuth
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (req.session?.role !== 'admin') {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
        return;
    }
    next();
};

/**
 * Middleware to require access to a specific account
 * Verifies that the account belongs to the current user
 * Expects accountId in req.params.accountId or req.body.accountId
 */
export const requireAccountAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to access this resource'
            });
            return;
        }

        const accountId = req.params.accountId || req.body.accountId;
        if (!accountId) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Account ID is required'
            });
            return;
        }

        const account = await getAccountConfigById(accountId);

        if (!account) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Account not found'
            });
            return;
        }

        if (account.userId !== userId) {
            res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have access to this account'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Error in requireAccountAccess middleware:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to verify account access'
        });
    }
};

/**
 * Middleware to check if user is authenticated (optional)
 * NOTE: Unlike requireAuth, this does not block the request if user is not authenticated
 * Just attaches user info to request if session exists
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    // Session is already attached by session middleware
    // This middleware is just a marker for optional auth routes
    next();
};
