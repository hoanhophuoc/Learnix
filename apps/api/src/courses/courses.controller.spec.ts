import { Test, type TestingModule } from '@nestjs/testing';

import { type User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { CoursesController } from './courses.controller';
import { CoursesService, type EnrolledCourseDto } from './courses.service';
import { type Course, CourseLevel } from './entities/course.entity';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: jest.Mocked<CoursesService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    role: UserRole.STUDENT,
    isEmailVerified: true,
    isActive: true,
  } as User;

  const mockCourse: Partial<Course> = {
    id: 'course-1',
    title: 'Test Course',
    description: 'Test Description',
    level: CourseLevel.BEGINNER,
    isPublished: true,
    price: 0,
    tags: ['react', 'javascript'],
    instructorId: 'instructor-1',
    instructor: { id: 'instructor-1', fullName: 'Instructor' } as User,
    sections: [],
    enrollments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEnrollment = {
    id: 'enrollment-1',
    userId: 'user-1',
    courseId: 'course-1',
    completedLessonIds: ['lesson-1'],
    enrolledAt: new Date(),
    lastAccessedAt: new Date(),
    isArchived: false,
  };

  beforeEach(async () => {
    const mockCoursesService = {
      findAllPublished: jest.fn(),
      getUniqueTags: jest.fn(),
      findOne: jest.fn(),
      enroll: jest.fn(),
      checkCourseAccess: jest.fn(),
      completeLesson: jest.fn(),
      getEnrolledCourses: jest.fn(),
      archiveCourse: jest.fn(),
      unarchiveCourse: jest.fn(),
      getRecommendations: jest.fn(),
      findInstructorCourses: jest.fn(),
      findAllPending: jest.fn(),
      getLessonWithAccessControl: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createSection: jest.fn(),
      removeSection: jest.fn(),
      createLesson: jest.fn(),
      updateLesson: jest.fn(),
      removeLesson: jest.fn(),
      addResource: jest.fn(),
      removeResource: jest.fn(),
      reorderSections: jest.fn(),
      reorderLessons: jest.fn(),
      submitForApproval: jest.fn(),
      approveCourse: jest.fn(),
      rejectCourse: jest.fn(),
      generateQuizPreview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: mockCoursesService,
        },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    service = module.get(CoursesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated courses', async () => {
      const mockResponse = {
        data: [mockCourse as Course],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      service.findAllPublished.mockResolvedValue(mockResponse);

      const result = await controller.findAll(1, 10, 'react');

      expect(service.findAllPublished).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'react',
        level: undefined,
        tags: undefined,
        sort: undefined,
        order: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should parse tags from comma-separated string', async () => {
      const mockResponse = {
        data: [] as Course[],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      service.findAllPublished.mockResolvedValue(mockResponse);

      await controller.findAll(1, 10, undefined, undefined, 'react,typescript');

      expect(service.findAllPublished).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['react', 'typescript'],
        }),
      );
    });
  });

  describe('getTags', () => {
    it('should return unique tags', async () => {
      const mockTags = ['react', 'typescript', 'javascript'];
      service.getUniqueTags.mockResolvedValue(mockTags);

      const result = await controller.getTags();

      expect(service.getUniqueTags).toHaveBeenCalled();
      expect(result).toEqual(mockTags);
    });
  });

  describe('findOne', () => {
    it('should return a single course', async () => {
      service.findOne.mockResolvedValue(mockCourse as never);

      const result = await controller.findOne('course-1', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('course-1', mockUser);
      expect(result).toEqual(mockCourse);
    });
  });

  describe('enroll', () => {
    it('should enroll user in course', async () => {
      service.enroll.mockResolvedValue(mockEnrollment as never);

      const result = await controller.enroll('course-1', mockUser);

      expect(service.enroll).toHaveBeenCalledWith('user-1', 'course-1');
      expect(result).toEqual(mockEnrollment);
    });
  });

  describe('checkEnrollment', () => {
    it('should return enrollment status using checkCourseAccess', async () => {
      const mockAccessInfo = {
        isEnrolled: true,
        isInstructor: false,
        isAdmin: false,
        hasAccess: true,
        enrollment: mockEnrollment as any,
      };
      service.checkCourseAccess.mockResolvedValue(mockAccessInfo);

      const result = await controller.checkEnrollment('course-1', mockUser);

      expect(service.checkCourseAccess).toHaveBeenCalledWith(
        mockUser,
        'course-1',
      );
      expect(result).toEqual({
        isEnrolled: true,
        isInstructor: false,
        isAdmin: false,
        hasAccess: true,
        progress: mockEnrollment,
      });
    });
  });

  describe('completeLesson', () => {
    it('should mark lesson as complete', async () => {
      const updatedEnrollment = {
        ...mockEnrollment,
        completedLessonIds: ['lesson-1', 'lesson-2'],
      };
      service.completeLesson.mockResolvedValue(updatedEnrollment as never);

      const result = await controller.completeLesson(
        'course-1',
        'lesson-2',
        mockUser,
      );

      expect(service.completeLesson).toHaveBeenCalledWith(
        mockUser,
        'course-1',
        'lesson-2',
      );
      expect(result).toEqual(updatedEnrollment);
    });
  });

  describe('getEnrolledCourses', () => {
    it('should return enrolled courses for user', async () => {
      const mockEnrolledCourses: EnrolledCourseDto[] = [
        {
          id: 'course-1',
          title: 'Test Course',
          description: 'Description',
          thumbnailUrl: null,
          level: 'beginner',
          instructor: { id: 'instructor-1', fullName: 'Instructor' },
          progress: 50,
          totalLessons: 10,
          completedLessons: 5,
          status: 'in-progress',
          isArchived: false,
          lastAccessedAt: new Date().toISOString(),
          enrolledAt: new Date().toISOString(),
        },
      ];
      service.getEnrolledCourses.mockResolvedValue(mockEnrolledCourses);

      const result = await controller.getEnrolledCourses(mockUser);

      expect(service.getEnrolledCourses).toHaveBeenCalledWith('user-1', {
        archived: false,
        status: 'all',
      });
      expect(result).toEqual(mockEnrolledCourses);
    });

    it('should filter by archived status', async () => {
      service.getEnrolledCourses.mockResolvedValue([]);

      await controller.getEnrolledCourses(mockUser, 'true', 'completed');

      expect(service.getEnrolledCourses).toHaveBeenCalledWith('user-1', {
        archived: true,
        status: 'completed',
      });
    });
  });

  describe('archiveCourse', () => {
    it('should archive a course', async () => {
      service.archiveCourse.mockResolvedValue(mockEnrollment as never);

      const result = await controller.archiveCourse('course-1', mockUser);

      expect(service.archiveCourse).toHaveBeenCalledWith('user-1', 'course-1');
      expect(result).toEqual({
        success: true,
        message: 'Course archived successfully',
      });
    });
  });

  describe('unarchiveCourse', () => {
    it('should unarchive a course', async () => {
      service.unarchiveCourse.mockResolvedValue(mockEnrollment as never);

      const result = await controller.unarchiveCourse('course-1', mockUser);

      expect(service.unarchiveCourse).toHaveBeenCalledWith(
        'user-1',
        'course-1',
      );
      expect(result).toEqual({
        success: true,
        message: 'Course unarchived successfully',
      });
    });
  });

  describe('getRecommendations', () => {
    it('should return course recommendations', async () => {
      const mockRecommendations = [
        {
          course: mockCourse as Course,
          matchingTags: ['react'],
          score: 1,
        },
      ];
      service.getRecommendations.mockResolvedValue(mockRecommendations);

      const result = await controller.getRecommendations(mockUser, 6);

      expect(service.getRecommendations).toHaveBeenCalledWith('user-1', 6);
      expect(result).toEqual(mockRecommendations);
    });
  });
});
