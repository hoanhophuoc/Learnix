import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { type User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { AuthController } from './auth.controller';
import { AuthService, type OAuthProfile } from './auth.service';

import type { RequestWithUser } from '../types/request.interface';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    password: null,
    fullName: 'Test User',
    role: UserRole.STUDENT,
    isActive: true,
    isEmailVerified: true,
    avatarUrl: null,
    oauthAvatarUrl: null,
    activationToken: null,
    activationTokenExpiry: null,
    passwordResetToken: null,
    passwordResetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
      activateAccount: jest.fn(),
      resendActivationEmail: jest.fn(),
      validateOAuthLogin: jest.fn(),
      updateUserRole: jest.fn(),
      getUserById: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      updateProfile: jest.fn(),
      deleteAccount: jest.fn(),
      hasPassword: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') {
          return 'http://localhost:5173';
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signIn', () => {
    it('should login user and set cookie', async () => {
      const res = mockResponse();
      authService.login.mockResolvedValue({
        access_token: 'jwt-token',
        user: mockUser,
      });

      const result = await controller.signIn(
        { email: 'test@example.com', password: 'password' },
        res,
      );

      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
      expect(result.user).toEqual(mockUser);
      expect(result.message).toBe('Login successful');
    });
  });

  describe('signUp', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      };
      const { password: _, ...userWithoutPassword } = mockUser;
      const expectedResponse: Omit<User, 'password'> & { message: string } = {
        ...userWithoutPassword,
        email: 'new@example.com',
        message: 'Registration successful',
      };

      authService.register.mockResolvedValue(expectedResponse);

      const result = await controller.signUp(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('activateAccount', () => {
    it('should activate account with valid token', async () => {
      authService.activateAccount.mockResolvedValue({
        message: 'Account activated successfully',
      });

      const result = await controller.activateAccount('valid-token');

      expect(authService.activateAccount).toHaveBeenCalledWith('valid-token');
      expect(result.message).toContain('activated');
    });
  });

  describe('resendActivationEmail', () => {
    it('should resend activation email', async () => {
      authService.resendActivationEmail.mockResolvedValue({
        message: 'Activation link sent',
      });

      const result = await controller.resendActivationEmail('test@example.com');

      expect(authService.resendActivationEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result.message).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success message', () => {
      const res = mockResponse();

      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('googleAuthRedirect', () => {
    it('should handle Google OAuth callback', async () => {
      const req = {
        user: {
          email: 'google@example.com',
          fullName: 'Google User',
          avatarUrl: 'https://avatar.url',
          providerId: 'google-123',
        } as OAuthProfile,
      } as unknown as RequestWithUser;
      const res = mockResponse();

      authService.validateOAuthLogin.mockResolvedValue({
        access_token: 'jwt-token',
        user: mockUser,
      });

      await controller.googleAuthRedirect(req, res);

      expect(authService.validateOAuthLogin).toHaveBeenCalled();
      // Token is now encrypted in cookie, not in URL
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/auth/callback',
      );
    });
  });

  describe('githubAuthRedirect', () => {
    it('should handle GitHub OAuth callback', async () => {
      const req = {
        user: {
          email: 'github@example.com',
          fullName: 'GitHub User',
          avatarUrl: 'https://avatar.url',
          providerId: 'github-123',
        } as OAuthProfile,
      } as unknown as RequestWithUser;
      const res = mockResponse();

      authService.validateOAuthLogin.mockResolvedValue({
        access_token: 'jwt-token',
        user: mockUser,
      });

      await controller.githubAuthRedirect(req, res);

      expect(authService.validateOAuthLogin).toHaveBeenCalled();
      // Token is now encrypted in cookie, not in URL
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/auth/callback',
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      authService.getUserById.mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockUser);

      expect(authService.getUserById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('selectRole', () => {
    it('should update user role and return new token', async () => {
      const updatedUser = { ...mockUser, role: UserRole.INSTRUCTOR };
      const mockToken = 'new-jwt-token-with-instructor-role';
      const mockResponse = {
        cookie: jest.fn(),
      } as any;

      authService.updateUserRole.mockResolvedValue(updatedUser);
      authService.signToken = jest.fn().mockReturnValue(mockToken);

      const result = await controller.selectRole(mockResponse, mockUser, {
        role: UserRole.INSTRUCTOR,
      });

      expect(authService.updateUserRole).toHaveBeenCalledWith(
        'user-1',
        UserRole.INSTRUCTOR,
      );
      expect(authService.signToken).toHaveBeenCalledWith({
        sub: updatedUser.id,
        email: updatedUser.email,
        role: UserRole.INSTRUCTOR,
      });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
      expect(result.user.role).toBe(UserRole.INSTRUCTOR);
      expect(result.accessToken).toBe(mockToken);
      expect(result.message).toContain('Role selected successfully');
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email', async () => {
      authService.forgotPassword.mockResolvedValue({
        message: 'Reset link sent',
      });

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      });

      expect(authService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result.message).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      authService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newPassword123',
      });

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'valid-token',
        'newPassword123',
      );
      expect(result.message).toContain('reset');
    });
  });

  describe('changePassword', () => {
    it('should change password for authenticated user', async () => {
      authService.changePassword.mockResolvedValue({
        message: 'Password changed successfully',
      });

      const result = await controller.changePassword(mockUser, {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      });

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'oldPassword',
        'newPassword123',
      );
      expect(result.message).toContain('changed');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updatedUser = { ...mockUser, fullName: 'Updated Name' };
      authService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, {
        fullName: 'Updated Name',
      });

      expect(authService.updateProfile).toHaveBeenCalledWith('user-1', {
        fullName: 'Updated Name',
      });
      expect(result.user.fullName).toBe('Updated Name');
      expect(result.message).toBe('Profile updated successfully');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and clear cookie', async () => {
      const res = mockResponse();
      authService.deleteAccount.mockResolvedValue({
        message: 'Account deleted successfully',
      });

      const result = await controller.deleteAccount(
        mockUser,
        { password: 'password', confirmation: 'DELETE' },
        res,
      );

      expect(authService.deleteAccount).toHaveBeenCalledWith(
        'user-1',
        'password',
        'DELETE',
      );
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(result.message).toContain('deleted');
    });
  });

  describe('hasPassword', () => {
    it('should return password status', async () => {
      authService.hasPassword.mockResolvedValue(true);

      const result = await controller.hasPassword(mockUser);

      expect(authService.hasPassword).toHaveBeenCalledWith('user-1');
      expect(result.hasPassword).toBe(true);
    });
  });
});
