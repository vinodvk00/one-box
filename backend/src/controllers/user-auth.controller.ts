import { Request, Response } from 'express';
import { authService, userService } from '../core/container';
import { toUserResponse } from '../types/user.types';
import { ValidationError, AuthenticationError } from '../services/auth.service';

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        const user = await authService.registerUser({
            email,
            password,
            name,
            authMethod: 'password'
        });

        const userResponse = toUserResponse(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userResponse
        });
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Registration failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await authService.loginUser({ email, password });

        await userService.updateLastLogin(user.id);

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.role = user.role;

        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    error: 'Session creation failed',
                    message: 'Failed to create user session'
                });
            }

            const userResponse = toUserResponse(user);

            res.json({
                success: true,
                message: 'Login successful',
                user: userResponse
            });
        });
    } catch (error) {
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
            return res.status(401).json({
                error: 'Authentication Failed',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Login failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                error: 'Logout failed',
                message: 'Failed to destroy session'
            });
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
};

/**
 * Get current user
 */
export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'No active session found'
            });
        }

        const user = await userService.findUserById(userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const userResponse = toUserResponse(user);

        res.json({
            success: true,
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get user',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
