import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { MailService } from '../mail/mail.service';
import { type User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';

import { AuthService, type OAuthProfile } from './auth.service';
import { ExternalAuth, AuthProvider } from './entities/external-auth.entity';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = {
  compare: bcrypt.compare as jest.MockedFunction<
    (data: string | Buffer, encrypted: string) => Promise<boolean>
  >,
  hash: bcrypt.hash as jest.MockedFunction<
    (data: string | Buffer, saltOrRounds: string | number) => Promise<string>
  >,
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let externalAuthRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    fullName: 'Test User',
    avatarUrl: null,
    oauthAvatarUrl: null,
    role: UserRole.STUDENT,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnverifiedUser: Partial<User> = {
    ...mockUser,
    id: 'user-unverified',
    email: 'unverified@example.com',
    isEmailVerified: false,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      createWithActivationToken: jest.fn(),
      findByActivationToken: jest.fn(),
      activateUser: jest.fn(),
      regenerateActivationToken: jest.fn(),
      updateRole: jest.fn(),
      updateProfile: jest.fn(),
      updateOAuthAvatar: jest.fn(),
      hasPassword: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findByPasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockMailService = {
      sendActivationEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendPasswordChangedEmail: jest.fn(),
    };

    externalAuthRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        {
          provide: getRepositoryToken(ExternalAuth),
          useValue: externalAuthRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect((result as Record<string, unknown>).password).toBeUndefined();
    });

    it('should return null when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'notfound@example.com',
        'password',
      );

      expect(result).toBeNull();
    });

    it('should return null when user has no password (OAuth only)', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: null,
      } as User);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 'user-1',
        role: UserRole.STUDENT,
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unverified email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUnverifiedUser as User);
      mockedBcrypt.compare.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'unverified@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create user and send activation email', async () => {
      const createUserDto = {
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      usersService.createWithActivationToken.mockResolvedValue({
        user: { ...mockUser, email: 'new@example.com' } as User,
        activationToken: 'activation-token',
      });

      const result = await service.register(createUserDto);

      expect(usersService.createWithActivationToken).toHaveBeenCalled();
      expect(mailService.sendActivationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'Test User',
        'activation-token',
      );
      expect(result.message).toContain('check your email');
    });

    it('should not pass role when registering', async () => {
      const createUserDto = {
        email: 'new@example.com',
        password: 'password123',
        role: UserRole.INSTRUCTOR, // This should be ignored
      };

      usersService.createWithActivationToken.mockResolvedValue({
        user: mockUser as User,
        activationToken: 'token',
      });

      await service.register(createUserDto);

      // Verify role was not passed to createWithActivationToken
      expect(usersService.createWithActivationToken).toHaveBeenCalledWith(
        expect.not.objectContaining({ role: UserRole.INSTRUCTOR }),
      );
    });
  });

  describe('activateAccount', () => {
    it('should activate account successfully', async () => {
      const unactivatedUser = {
        ...mockUser,
        isEmailVerified: false,
        activationToken: 'valid-token',
        activationTokenExpiry: new Date(Date.now() + 1000 * 60 * 60),
      } as User;

      usersService.findByActivationToken.mockResolvedValue(unactivatedUser);
      usersService.activateUser.mockResolvedValue({
        ...unactivatedUser,
        isEmailVerified: true,
      });

      const result = await service.activateAccount('valid-token');

      expect(result.message).toContain('activated successfully');
      expect(usersService.activateUser).toHaveBeenCalledWith('user-1');
      expect(mailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      usersService.findByActivationToken.mockResolvedValue(null);

      await expect(service.activateAccount('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        isEmailVerified: false,
        activationToken: 'expired-token',
        activationTokenExpiry: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      } as User;

      usersService.findByActivationToken.mockResolvedValue(expiredUser);

      await expect(service.activateAccount('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return success message for already activated account', async () => {
      const alreadyActivatedUser = {
        ...mockUser,
        isEmailVerified: true,
      } as User;

      usersService.findByActivationToken.mockResolvedValue(
        alreadyActivatedUser,
      );

      const result = await service.activateAccount('token');

      expect(result.alreadyActivated).toBe(true);
      expect(usersService.activateUser).not.toHaveBeenCalled();
    });
  });

  describe('resendActivationEmail', () => {
    it('should resend activation email for unverified user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUnverifiedUser as User);
      usersService.regenerateActivationToken.mockResolvedValue({
        user: mockUnverifiedUser as User,
        activationToken: 'new-token',
      });

      const result = await service.resendActivationEmail(
        'unverified@example.com',
      );

      expect(mailService.sendActivationEmail).toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('should return generic message when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendActivationEmail(
        'nonexistent@example.com',
      );

      // Should not reveal if email exists
      expect(result.message).toContain('If an account exists');
      expect(mailService.sendActivationEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for already verified user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);

      await expect(
        service.resendActivationEmail('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOAuthLogin', () => {
    const mockOAuthProfile: OAuthProfile = {
      email: 'oauth@example.com',
      fullName: 'OAuth User',
      avatarUrl: 'https://avatar.url/image.jpg',
      providerId: 'provider-123',
    };

    it('should return token for existing OAuth user', async () => {
      const existingExternalAuth = {
        provider: AuthProvider.GOOGLE,
        providerId: 'provider-123',
        user: mockUser as User,
      };

      externalAuthRepository.findOne.mockResolvedValue(existingExternalAuth);

      const result = await service.validateOAuthLogin(
        AuthProvider.GOOGLE,
        mockOAuthProfile,
      );

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should create new user for new OAuth login', async () => {
      externalAuthRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: 'oauth@example.com',
      } as User);
      externalAuthRepository.create.mockReturnValue({
        provider: AuthProvider.GOOGLE,
        providerId: 'provider-123',
      });

      const result = await service.validateOAuthLogin(
        AuthProvider.GOOGLE,
        mockOAuthProfile,
      );

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'oauth@example.com',
        fullName: 'OAuth User',
        avatarUrl: 'https://avatar.url/image.jpg',
        oauthAvatarUrl: 'https://avatar.url/image.jpg',
      });
      expect(externalAuthRepository.save).toHaveBeenCalled();
      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('should link OAuth to existing email user', async () => {
      externalAuthRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        email: 'oauth@example.com',
      } as User);
      externalAuthRepository.create.mockReturnValue({
        provider: AuthProvider.GITHUB,
        providerId: 'provider-123',
      });

      const result = await service.validateOAuthLogin(
        AuthProvider.GITHUB,
        mockOAuthProfile,
      );

      expect(usersService.create).not.toHaveBeenCalled();
      expect(externalAuthRepository.save).toHaveBeenCalled();
      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('should update OAuth avatar when it changes', async () => {
      const existingExternalAuth = {
        provider: AuthProvider.GOOGLE,
        providerId: 'provider-123',
        user: { ...mockUser, oauthAvatarUrl: 'old-avatar.jpg' } as User,
      };

      externalAuthRepository.findOne.mockResolvedValue(existingExternalAuth);

      await service.validateOAuthLogin(AuthProvider.GOOGLE, mockOAuthProfile);

      expect(usersService.updateOAuthAvatar).toHaveBeenCalledWith(
        'user-1',
        'https://avatar.url/image.jpg',
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      usersService.updateRole.mockResolvedValue({
        ...mockUser,
        role: UserRole.INSTRUCTOR,
      } as User);

      const result = await service.updateUserRole(
        'user-1',
        UserRole.INSTRUCTOR,
      );

      expect(usersService.updateRole).toHaveBeenCalledWith(
        'user-1',
        UserRole.INSTRUCTOR,
      );
      expect(result.role).toBe(UserRole.INSTRUCTOR);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for valid user with password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      usersService.hasPassword.mockResolvedValue(true);
      usersService.createPasswordResetToken.mockResolvedValue({
        user: mockUser as User,
        resetToken: 'reset-token',
      });

      const result = await service.forgotPassword('test@example.com');

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'reset-token',
      );
      expect(result.message).toBeDefined();
    });

    it('should return generic message for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return generic message for OAuth-only user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      usersService.hasPassword.mockResolvedValue(false);

      const result = await service.forgotPassword('oauth@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const userWithResetToken = {
        ...mockUser,
        passwordResetToken: 'valid-token',
        passwordResetTokenExpiry: new Date(Date.now() + 1000 * 60 * 60),
      } as User;

      usersService.findByPasswordResetToken.mockResolvedValue(
        userWithResetToken,
      );
      usersService.resetPassword.mockResolvedValue(mockUser as User);

      const result = await service.resetPassword(
        'valid-token',
        'newPassword123',
      );

      expect(usersService.resetPassword).toHaveBeenCalledWith(
        'user-1',
        'newPassword123',
      );
      expect(mailService.sendPasswordChangedEmail).toHaveBeenCalled();
      expect(result.message).toContain('reset successfully');
    });

    it('should throw BadRequestException for invalid token', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newPassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        passwordResetToken: 'expired-token',
        passwordResetTokenExpiry: new Date(Date.now() - 1000 * 60 * 60),
      } as User;

      usersService.findByPasswordResetToken.mockResolvedValue(expiredUser);

      await expect(
        service.resetPassword('expired-token', 'newPassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      usersService.changePassword.mockResolvedValue(mockUser as User);
      usersService.findOne.mockResolvedValue(mockUser as User);

      const result = await service.changePassword(
        'user-1',
        'currentPassword',
        'newPassword',
      );

      expect(usersService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'currentPassword',
        'newPassword',
      );
      expect(mailService.sendPasswordChangedEmail).toHaveBeenCalled();
      expect(result.message).toContain('changed successfully');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updatedUser = { ...mockUser, fullName: 'Updated Name' } as User;
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', {
        fullName: 'Updated Name',
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', {
        fullName: 'Updated Name',
      });
      expect(result.fullName).toBe('Updated Name');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account with correct password', async () => {
      usersService.hasPassword.mockResolvedValue(true);
      usersService.findOne.mockResolvedValue(mockUser as User);
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.deleteAccount(
        'user-1',
        'password',
        'DELETE',
      );

      expect(externalAuthRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
      expect(usersService.deleteAccount).toHaveBeenCalledWith('user-1');
      expect(result.message).toContain('deleted successfully');
    });

    it('should throw BadRequestException for wrong confirmation', async () => {
      await expect(
        service.deleteAccount('user-1', 'password', 'WRONG'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when password required but missing', async () => {
      usersService.hasPassword.mockResolvedValue(true);

      await expect(
        service.deleteAccount('user-1', undefined, 'DELETE'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for incorrect password', async () => {
      usersService.hasPassword.mockResolvedValue(true);
      usersService.findOne.mockResolvedValue(mockUser as User);
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.deleteAccount('user-1', 'wrongpassword', 'DELETE'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow OAuth user to delete without password', async () => {
      usersService.hasPassword.mockResolvedValue(false);
      usersService.findOne.mockResolvedValue(mockUser as User);

      const result = await service.deleteAccount('user-1', undefined, 'DELETE');

      expect(usersService.deleteAccount).toHaveBeenCalledWith('user-1');
      expect(result.message).toContain('deleted successfully');
    });
  });

  describe('hasPassword', () => {
    it('should return true when user has password', async () => {
      usersService.hasPassword.mockResolvedValue(true);

      const result = await service.hasPassword('user-1');

      expect(result).toBe(true);
    });

    it('should return false when user has no password', async () => {
      usersService.hasPassword.mockResolvedValue(false);

      const result = await service.hasPassword('user-1');

      expect(result).toBe(false);
    });
  });
});
