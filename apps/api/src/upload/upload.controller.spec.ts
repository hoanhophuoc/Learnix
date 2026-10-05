import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { CloudinaryService } from './cloudinary.service';
import { UploadController } from './upload.controller';
import { type FileUploadResult, UploadService } from './upload.service';

describe('UploadController', () => {
  let controller: UploadController;

  // Define mocks explicitly with proper types
  const mockUploadService = {
    validateImageFile: jest.fn(),
    validateVideoFile: jest.fn(),
    processUploadedFile: jest.fn<
      Promise<FileUploadResult>,
      [Express.Multer.File]
    >(),
    processUploadedFiles: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockCloudinaryService = {
    isAvailable: jest.fn<boolean, []>().mockReturnValue(false),
    uploadAvatar: jest.fn(),
    uploadGeneralImage: jest.fn(),
    uploadVideo: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCloudinaryService.isAvailable.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: mockUploadService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCloudinaryService.isAvailable.mockReturnValue(false);
  });

  const mockFile = {
    originalname: 'test.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test'),
  } as Express.Multer.File;

  describe('uploadAvatar', () => {
    it('should throw BadRequestException if no file is provided', async () => {
      await expect(controller.uploadAvatar(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload via local service if cloudinary is unavailable', async () => {
      const mockResult: FileUploadResult = {
        filename: 'local.png',
        originalName: 'test.png',
        mimetype: 'image/png',
        size: 1024,
        url: '/uploads/local.png',
      };
      mockUploadService.processUploadedFile.mockResolvedValue(mockResult);

      const result = await controller.uploadAvatar(mockFile);

      expect(mockUploadService.validateImageFile).toHaveBeenCalledWith(
        mockFile,
        'avatar',
      );
      expect(mockUploadService.processUploadedFile).toHaveBeenCalledWith(
        mockFile,
      );
      expect(result).toEqual(mockResult);
    });

    it('should upload via cloudinary if available', async () => {
      // Re-instantiate controller with cloudinary available
      mockCloudinaryService.isAvailable.mockReturnValue(true);
      const controllerWithCloudinary = new UploadController(
        mockUploadService as unknown as UploadService,
        mockCloudinaryService as unknown as CloudinaryService,
        mockConfigService as unknown as ConfigService,
      );

      const mockCloudinaryResult = {
        publicId: 'cloud_id',
        secureUrl: 'https://cloud.url',
        bytes: 1024,
      };
      mockCloudinaryService.uploadAvatar.mockResolvedValue(
        mockCloudinaryResult,
      );

      const result = await controllerWithCloudinary.uploadAvatar(mockFile);

      expect(mockCloudinaryService.uploadAvatar).toHaveBeenCalledWith(mockFile);
      expect(result.url).toBe('https://cloud.url');
    });
  });

  describe('deleteFile', () => {
    it('should try cloudinary deletion if available', async () => {
      mockCloudinaryService.isAvailable.mockReturnValue(true);
      const controllerWithCloudinary = new UploadController(
        mockUploadService as unknown as UploadService,
        mockCloudinaryService as unknown as CloudinaryService,
        mockConfigService as unknown as ConfigService,
      );
      mockCloudinaryService.deleteFile.mockResolvedValue(true);

      await controllerWithCloudinary.deleteFile('some_file');

      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'some_file',
      );
      expect(mockUploadService.deleteFile).not.toHaveBeenCalled();
    });

    it('should fallback to local deletion if cloudinary deletion fails or is unavailable', async () => {
      mockCloudinaryService.deleteFile.mockResolvedValue(false);

      await controller.deleteFile('local_file');

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('local_file');
    });
  });
});
