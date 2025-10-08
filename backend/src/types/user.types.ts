export interface User {
    id: string;
    email: string;
    password?: string; // hashed, optional for OAuth users
    name: string;
    authMethod: 'oauth' | 'password';
    oauthProvider?: string; // 'google' for only for now
    primaryEmailAccountId?: string;
    role: 'user' | 'admin';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

export interface UserDocument extends Omit<User, 'id'> {
    // Elasticsearch document (id is separate)
}

export interface CreateUserInput {
    email: string;
    password?: string;
    name: string;
    authMethod: 'oauth' | 'password';
    oauthProvider?: string;
    role?: 'user' | 'admin';
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    isActive: boolean;
    createdAt: Date;
    lastLoginAt?: Date;
}

// Helper to convert User to UserResponse (removes password)
export const toUserResponse = (user: User): UserResponse => {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
    };
};
