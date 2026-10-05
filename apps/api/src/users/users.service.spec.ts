import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { NotificationsService } from '../notifications/notifications.service';

import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';

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

describe('UsersService', () => {
  let service: UsersService;
  let notificationsService: NotificationsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
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

  const mockQueryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    getOne: jest.fn(),
  };

  const mockNotificationsService = {
    notifyRoleChange: jest.fn(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    repository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto = {
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      repository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...mockUser, ...createUserDto });
      repository.save.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.create(createUserDto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'hashedPassword',
          isEmailVerified: false,
        }),
      );
      expect(result.email).toBe('new@example.com');
    });

    it('should create OAuth user without password (auto-verified)', async () => {
      const createUserDto = {
        email: 'oauth@example.com',
        fullName: 'OAuth User',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({
        ...mockUser,
        ...createUserDto,
        password: null,
        isEmailVerified: true,
      });
      repository.save.mockResolvedValue({
        ...mockUser,
        ...createUserDto,
        password: null,
        isEmailVerified: true,
      });

      const result = await service.create(createUserDto);

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: null,
          isEmailVerified: true,
        }),
      );
      expect(result.isEmailVerified).toBe(true);
    });

    it('should throw ConflictException for duplicate email', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createWithActivationToken', () => {
    it('should create user with activation token', async () => {
      const createUserDto = {
        email: 'new@example.com',
        password: 'password123',
      };

      repository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({
        ...mockUser,
        isEmailVerified: false,
        activationToken: expect.any(String),
        activationTokenExpiry: expect.any(Date),
      });
      repository.save.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
        activationToken: 'generated-token',
      });

      const result = await service.createWithActivationToken(createUserDto);

      expect(result.user).toBeDefined();
      expect(result.activationToken).toBeDefined();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: false,
          activationToken: expect.any(String),
          activationTokenExpiry: expect.any(Date),
        }),
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.arrayContaining(['id', 'email', 'password', 'role']),
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all users ordered by createdAt', async () => {
      const users = [mockUser as User];
      mockQueryBuilder.getMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'user.createdAt',
        'DESC',
      );
      expect(result).toEqual(users);
    });
  });

  describe('findByActivationToken', () => {
    it('should find user by activation token using query builder', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);

      const result = await service.findByActivationToken('valid-token');

      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'user.activationToken',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.activationToken = :token',
        { token: 'valid-token' },
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('activateUser', () => {
    it('should activate user and set expiry grace period', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
      });

      const result = await service.activateUser('user-1');

      expect(result.isEmailVerified).toBe(true);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.activateUser('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('regenerateActivationToken', () => {
    it('should generate new activation token', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        activationToken: 'new-token',
      });

      const result = await service.regenerateActivationToken('user-1');

      expect(result.activationToken).toBeDefined();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.regenerateActivationToken('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        role: UserRole.INSTRUCTOR,
      });

      const result = await service.updateRole('user-1', UserRole.INSTRUCTOR);

      expect(result.role).toBe(UserRole.INSTRUCTOR);
      expect(notificationsService.notifyRoleChange).toHaveBeenCalledWith(
        'user-1',
        UserRole.INSTRUCTOR,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole('nonexistent', UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update user active status', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.updateStatus('user-1', false);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('count', () => {
    it('should return total user count', async () => {
      repository.count.mockResolvedValue(42);

      const result = await service.count();

      expect(result).toBe(42);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create password reset token', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      mockQueryBuilder.execute.mockResolvedValue({});

      const result = await service.createPasswordResetToken('user-1');

      expect(result.resetToken).toBeDefined();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetTokenExpiry: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.createPasswordResetToken('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPasswordResetToken', () => {
    it('should find user by password reset token', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);

      const result = await service.findByPasswordResetToken('reset-token');

      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'user.passwordResetToken',
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('resetPassword', () => {
    it('should reset password and clear reset token', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword');
      mockQueryBuilder.execute.mockResolvedValue({});

      const result = await service.resetPassword('user-1', 'newPassword123');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'newHashedPassword',
          passwordResetToken: null,
          passwordResetTokenExpiry: null,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent', 'newPassword'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword');
      mockQueryBuilder.execute.mockResolvedValue({});

      const result = await service.changePassword(
        'user-1',
        'currentPassword',
        'newPassword',
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'currentPassword',
        'hashedPassword',
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword', 10);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'current', 'new'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for OAuth-only accounts', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        ...mockUser,
        password: null,
      });

      await expect(
        service.changePassword('user-1', 'current', 'new'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrongPassword', 'new'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProfile', () => {
    it('should update fullName', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        fullName: 'Updated Name',
      });

      const result = await service.updateProfile('user-1', {
        fullName: 'Updated Name',
      });

      expect(result.fullName).toBe('Updated Name');
    });

    it('should update avatarUrl', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        avatarUrl: 'https://new-avatar.url',
      });

      const result = await service.updateProfile('user-1', {
        avatarUrl: 'https://new-avatar.url',
      });

      expect(result.avatarUrl).toBe('https://new-avatar.url');
    });

    it('should clear avatarUrl when set to null', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({
        ...mockUser,
        avatarUrl: null,
      });

      const result = await service.updateProfile('user-1', {
        avatarUrl: null,
      });

      expect(result.avatarUrl).toBeNull();
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent', { fullName: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOAuthAvatar', () => {
    it('should update OAuth avatar using query builder', async () => {
      mockQueryBuilder.execute.mockResolvedValue({});

      await service.updateOAuthAvatar('user-1', 'https://new-oauth-avatar.url');

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        oauthAvatarUrl: 'https://new-oauth-avatar.url',
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 'user-1',
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.remove.mockResolvedValue(mockUser);

      await service.deleteAccount('user-1');

      expect(repository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hasPassword', () => {
    it('should return true when user has password', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);

      const result = await service.hasPassword('user-1');

      expect(result).toBe(true);
    });

    it('should return false when user has no password', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        ...mockUser,
        password: null,
      });

      const result = await service.hasPassword('user-1');

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.hasPassword('nonexistent');

      expect(result).toBe(false);
    });
  });
});
