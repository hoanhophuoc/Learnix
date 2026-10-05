import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { AiQuizGeneratorService } from '../quizzes/services/ai-quiz-generator.service';
import { type User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';

import { CoursesService } from './courses.service';
import { CourseSection } from './entities/course-section.entity';
import { Course, CourseLevel } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { LessonResource } from './entities/lesson-resource.entity';
import { Lesson } from './entities/lesson.entity';
import { CourseStatus } from './enums/course-status.enum';

interface MockEnrollmentRepository {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

const mockEnrollmentRepositoryValue: MockEnrollmentRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

interface MockLessonRepository {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

const mockLessonRepositoryValue: MockLessonRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

interface MockCourseSectionRepository {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

const mockCourseSectionRepositoryValue: MockCourseSectionRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

interface MockResourceRepository {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

const mockResourceRepositoryValue: MockResourceRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

interface MockCourseRepository {
  createQueryBuilder: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

describe('CoursesService', () => {
  let service: CoursesService;
  let courseRepository: MockCourseRepository;

  const mockCourse = (
    id: string,
    title: string,
    tags: string[],
  ): Partial<Course> => ({
    id,
    title,
    description: `Description for ${title}`,
    tags,
    level: CourseLevel.BEGINNER,
    status: CourseStatus.PUBLISHED,
    isPublished: true,
    instructor: { id: 'instructor-1', fullName: 'Test Instructor' } as never,
    sections: [], // Added sections
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockEnrollment = (
    userId: string,
    courseId: string,
    course: Partial<Course>,
  ): Partial<Enrollment> => ({
    id: `enrollment - ${courseId} `,
    userId,
    courseId,
    course: course as Course,
    completedLessonIds: [],
    isArchived: false,
    enrolledAt: new Date(),
    lastAccessedAt: new Date(),
  });

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };

  const mockCourseRepository: MockCourseRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCourseRepository.createQueryBuilder.mockImplementation(
      () => mockQueryBuilder,
    );
    mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
    mockEnrollmentRepositoryValue.find.mockResolvedValue([]);
    mockCourseRepository.findOne.mockResolvedValue(null);
    mockCourseRepository.find.mockResolvedValue([]);
    mockLessonRepositoryValue.findOne.mockResolvedValue(null);
    mockCourseSectionRepositoryValue.findOne.mockResolvedValue(null);
    mockResourceRepositoryValue.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getRepositoryToken(Course),
          useValue: mockCourseRepository,
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: mockEnrollmentRepositoryValue,
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: mockLessonRepositoryValue,
        },
        {
          provide: getRepositoryToken(CourseSection),
          useValue: mockCourseSectionRepositoryValue,
        },
        {
          provide: getRepositoryToken(LessonResource),
          useValue: mockResourceRepositoryValue,
        },
        {
          provide: AiQuizGeneratorService,
          useValue: {
            generateQuizFromText: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyEnrollment: jest.fn().mockResolvedValue({}),
            notifyCourseCompleted: jest.fn().mockResolvedValue({}),
            notifyCourseApproved: jest.fn().mockResolvedValue({}),
            notifyCourseRejected: jest.fn().mockResolvedValue({}),
            notifyCourseSubmitted: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findAllAdmins: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    courseRepository = module.get(getRepositoryToken(Course));
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCourseRepository.createQueryBuilder.mockImplementation(
      () => mockQueryBuilder,
    );
    mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
  });

  describe('getRecommendations', () => {
    it('should return popular courses when user has no enrollments', async () => {
      const userId = 'user-1';
      const popularCourses = [
        mockCourse('course-1', 'Popular Course 1', ['react']),
        mockCourse('course-2', 'Popular Course 2', ['typescript']),
      ];

      mockEnrollmentRepositoryValue.find.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue(popularCourses);

      const result = await service.getRecommendations(userId, 6);

      expect(result).toHaveLength(2);
      expect(result[0].matchingTags).toEqual([]);
      expect(result[0].score).toBe(0);
    });

    it('should return recommendations based on matching tags', async () => {
      const userId = 'user-1';
      const enrolledCourse = mockCourse('enrolled-1', 'React Basics', [
        'react',
        'javascript',
      ]);
      const recommendedCourse1 = mockCourse('rec-1', 'Advanced React', [
        'react',
        'redux',
      ]);
      const recommendedCourse2 = mockCourse('rec-2', 'TypeScript Intro', [
        'typescript',
        'javascript',
      ]);

      mockEnrollmentRepositoryValue.find.mockResolvedValue([
        mockEnrollment(userId, 'enrolled-1', enrolledCourse),
      ] as Enrollment[]);

      mockQueryBuilder.getMany.mockResolvedValue([
        recommendedCourse1,
        recommendedCourse2,
      ]);

      const result = await service.getRecommendations(userId, 6);

      expect(result).toHaveLength(2);
      // Advanced React should have 'react' matching
      expect(result.find((r) => r.course.id === 'rec-1')?.matchingTags).toEqual(
        ['react'],
      );
      // TypeScript Intro should have 'javascript' matching
      expect(result.find((r) => r.course.id === 'rec-2')?.matchingTags).toEqual(
        ['javascript'],
      );
    });

    it('should sort recommendations by score (number of matching tags)', async () => {
      const userId = 'user-1';
      const enrolledCourse = mockCourse('enrolled-1', 'Full Stack Course', [
        'react',
        'node',
        'typescript',
      ]);
      const courseWith1Match = mockCourse('rec-1', 'React Only', ['react']);
      const courseWith2Matches = mockCourse('rec-2', 'React + Node', [
        'react',
        'node',
      ]);
      const courseWith3Matches = mockCourse('rec-3', 'Full Match', [
        'react',
        'node',
        'typescript',
      ]);

      mockEnrollmentRepositoryValue.find.mockResolvedValue([
        mockEnrollment(userId, 'enrolled-1', enrolledCourse),
      ] as Enrollment[]);

      mockQueryBuilder.getMany.mockResolvedValue([
        courseWith1Match,
        courseWith2Matches,
        courseWith3Matches,
      ]);

      const result = await service.getRecommendations(userId, 6);

      expect(result).toHaveLength(3);
      // Should be sorted by score descending
      expect(result[0].score).toBe(3);
      expect(result[1].score).toBe(2);
      expect(result[2].score).toBe(1);
    });

    it('should exclude already enrolled courses', async () => {
      const userId = 'user-1';
      const enrolledCourse = mockCourse('enrolled-1', 'React Basics', [
        'react',
      ]);

      mockEnrollmentRepositoryValue.find.mockResolvedValue([
        mockEnrollment(userId, 'enrolled-1', enrolledCourse),
      ] as Enrollment[]);

      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.getRecommendations(userId, 6);

      // Verify that the query builder was called with the enrolled course ID to exclude
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'course.id NOT IN (:...enrolledIds)',

        expect.objectContaining({
          enrolledIds: expect.arrayContaining(['enrolled-1']),
        }),
      );
    });

    it('should respect the limit parameter', async () => {
      const userId = 'user-1';
      const enrolledCourse = mockCourse('enrolled-1', 'React', ['react']);
      const recommendations: Partial<Course>[] = Array.from(
        { length: 10 },
        (_, i) => mockCourse(`rec - ${i} `, `Course ${i} `, ['react']),
      );

      mockEnrollmentRepositoryValue.find.mockResolvedValue([
        mockEnrollment(userId, 'enrolled-1', enrolledCourse),
      ] as Enrollment[]);

      mockQueryBuilder.getMany.mockResolvedValue(recommendations);

      const result = await service.getRecommendations(userId, 3);

      expect(result).toHaveLength(3);
    });
  });

  describe('findAllPublished', () => {
    const paginatedQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn(),
      getOne: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return paginated courses with default options', async () => {
      const courses = [mockCourse('c1', 'Course 1', ['react'])];
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([courses, 1]);

      // Access the injected repository and update the mock
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      const result = await service.findAllPublished({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should apply search filter', async () => {
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      await service.findAllPublished({ search: 'react' });

      expect(paginatedQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply level filter', async () => {
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      await service.findAllPublished({ level: CourseLevel.BEGINNER });

      expect(paginatedQueryBuilder.andWhere).toHaveBeenCalledWith(
        'course.level = :level',
        { level: CourseLevel.BEGINNER },
      );
    });

    it('should apply tag filters', async () => {
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      await service.findAllPublished({ tags: ['react', 'typescript'] });

      expect(paginatedQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply sorting', async () => {
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      await service.findAllPublished({ sort: 'price', order: 'ASC' });

      expect(paginatedQueryBuilder.orderBy).toHaveBeenCalledWith(
        'course.price',
        'ASC',
      );
    });

    it('should calculate correct pagination metadata', async () => {
      paginatedQueryBuilder.getManyAndCount.mockResolvedValue([[], 25]);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(paginatedQueryBuilder);

      const result = await service.findAllPublished({ page: 2, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
      expect(paginatedQueryBuilder.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    const singleQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn(),
    };

    it('should return a published course by id for public user', async () => {
      const course = mockCourse('course-1', 'Test Course', ['react']);
      course.isPublished = true;
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);

      const result = await service.findOne('course-1');

      expect(result).toEqual(course);
    });

    it('should throw NotFoundException for unpublished course if no user', async () => {
      const course = mockCourse('course-1', 'Unpublished', []);
      course.isPublished = false;
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);

      await expect(service.findOne('course-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for unpublished course if user is not instructor', async () => {
      const course = mockCourse('course-1', 'Unpublished', []);
      course.isPublished = false;
      course.instructor = { id: 'instructor-1', fullName: 'Inst' } as any;
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);

      await expect(
        service.findOne('course-1', { id: 'student-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return unpublished course if user is instructor', async () => {
      const course = mockCourse('course-1', 'Unpublished', []);
      course.isPublished = false;
      course.instructor = { id: 'instructor-1', fullName: 'Inst' } as any;
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);

      const result = await service.findOne('course-1', {
        id: 'instructor-1',
      });

      expect(result).toEqual(course);
    });

    it('should throw NotFoundException when course not found', async () => {
      singleQueryBuilder.getOne.mockResolvedValue(null);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('enroll', () => {
    const singleQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn(),
    };

    it('should enroll user in a course', async () => {
      const course = mockCourse('course-1', 'Test Course', ['react']);
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      mockEnrollmentRepositoryValue.create.mockReturnValue({
        userId: 'user-1',
        courseId: 'course-1',
      });
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        id: 'enrollment-1',
        userId: 'user-1',
        courseId: 'course-1',
      });

      const result = await service.enroll('user-1', 'course-1');

      expect(mockEnrollmentRepositoryValue.create).toHaveBeenCalledWith({
        userId: 'user-1',
        courseId: 'course-1',
        completedLessonIds: [],
      });
      expect(result.courseId).toBe('course-1');
    });

    it('should throw ConflictException when already enrolled', async () => {
      const course = mockCourse('course-1', 'Test Course', ['react']);
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue({
        id: 'existing-enrollment',
      });

      await expect(service.enroll('user-1', 'course-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow instructor to enroll in own course', async () => {
      const course = mockCourse('course-1', 'Test Course', ['react']);
      course.instructor = {
        id: 'instructor-1',
        fullName: 'Test Instructor',
      } as any;
      singleQueryBuilder.getOne.mockResolvedValue(course);
      const courseRepo = courseRepository;
      courseRepo.createQueryBuilder.mockReturnValue(singleQueryBuilder);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      mockEnrollmentRepositoryValue.create.mockReturnValue({
        userId: 'instructor-1',
        courseId: 'course-1',
      });
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        id: 'enrollment-2',
        userId: 'instructor-1',
        courseId: 'course-1',
      });

      const result = await service.enroll('instructor-1', 'course-1');

      expect(mockEnrollmentRepositoryValue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'instructor-1',
          courseId: 'course-1',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('checkEnrollment', () => {
    it('should return enrollment when user is enrolled', async () => {
      const enrollment = { id: 'enrollment-1', userId: 'user-1' };
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);

      const result = await service.checkEnrollment('user-1', 'course-1');

      expect(result).toEqual(enrollment);
    });

    it('should return null when user is not enrolled', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      const result = await service.checkEnrollment('user-1', 'course-1');

      expect(result).toBeNull();
    });
  });

  describe('checkCourseAccess', () => {
    it('should return isEnrolled=true when user is enrolled', async () => {
      const enrollment = { id: 'enrollment-1', userId: 'user-1' };
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);
      courseRepository.findOne.mockResolvedValue({
        id: 'course-1',
        instructorId: 'instructor-1',
        status: CourseStatus.PUBLISHED,
        sections: [],
      });

      const result = await service.checkCourseAccess(
        { id: 'user-1', role: UserRole.STUDENT } as User,
        'course-1',
      );

      expect(result.isEnrolled).toBe(true);
      expect(result.isInstructor).toBe(false);
      expect(result.hasAccess).toBe(true);
      expect(result.enrollment).toEqual(enrollment);
    });

    it('should return hasAccess=true and isEnrolled=false when user is the instructor', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      courseRepository.findOne.mockResolvedValue({
        id: 'course-1',
        instructorId: 'instructor-1',
        status: CourseStatus.PUBLISHED,
        sections: [],
      });

      const result = await service.checkCourseAccess(
        { id: 'instructor-1', role: UserRole.INSTRUCTOR } as User,
        'course-1',
      );

      expect(result.isEnrolled).toBe(false);
      expect(result.isInstructor).toBe(true);
      expect(result.hasAccess).toBe(true);
      expect(result.enrollment).toBeNull();
    });

    it('should return hasAccess=false when user is neither enrolled nor instructor', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      courseRepository.findOne.mockResolvedValue({
        id: 'course-1',
        instructorId: 'instructor-1',
        status: CourseStatus.PUBLISHED,
        sections: [],
      });

      const result = await service.checkCourseAccess(
        { id: 'user-1', role: UserRole.STUDENT } as User,
        'course-1',
      );

      expect(result.isEnrolled).toBe(false);
      expect(result.isInstructor).toBe(false);
      expect(result.hasAccess).toBe(false);
      expect(result.enrollment).toBeNull();
    });

    it('should return hasAccess=true for admin on published course', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      courseRepository.findOne.mockResolvedValue({
        id: 'course-1',
        instructorId: 'instructor-1',
        status: CourseStatus.PUBLISHED,
        sections: [],
      });

      const result = await service.checkCourseAccess(
        { id: 'admin-1', role: UserRole.ADMIN } as User,
        'course-1',
      );

      expect(result.isEnrolled).toBe(false);
      expect(result.isInstructor).toBe(false);
      expect(result.isAdmin).toBe(true);
      expect(result.hasAccess).toBe(true);
      expect(result.enrollment).toBeNull();
    });

    it('should return hasAccess=true for admin on draft course', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);
      courseRepository.findOne.mockResolvedValue({
        id: 'course-1',
        instructorId: 'instructor-1',
        status: CourseStatus.DRAFT,
        sections: [],
      });

      const result = await service.checkCourseAccess(
        { id: 'admin-1', role: UserRole.ADMIN } as User,
        'course-1',
      );

      expect(result.isAdmin).toBe(true);
      expect(result.hasAccess).toBe(true);
    });
  });

  describe('completeLesson', () => {
    it('should return null for instructors without tracking completion', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);

      const result = await service.completeLesson(
        { id: 'instructor-1', role: UserRole.INSTRUCTOR } as User,
        'course-1',
        'lesson-1',
      );

      expect(result).toBeNull();
      expect(mockEnrollmentRepositoryValue.save).not.toHaveBeenCalled();
    });

    it('should add lesson to completed list for enrolled students', async () => {
      const lesson = {
        id: 'lesson-2',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      const enrollment = {
        id: 'enrollment-1',
        completedLessonIds: ['lesson-1'],
        lastAccessedAt: new Date(),
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        ...enrollment,
        completedLessonIds: ['lesson-1', 'lesson-2'],
      });

      const result = await service.completeLesson(
        { id: 'user-1', role: UserRole.STUDENT } as User,
        'course-1',
        'lesson-2',
      );

      expect(result?.completedLessonIds).toContain('lesson-2');
    });

    it('should not duplicate completed lesson', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      const enrollment = {
        id: 'enrollment-1',
        completedLessonIds: ['lesson-1', 'lesson-2'],
        lastAccessedAt: new Date(),
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);

      const result = await service.completeLesson(
        { id: 'user-1', role: UserRole.STUDENT } as User,
        'course-1',
        'lesson-1',
      );

      expect(mockEnrollmentRepositoryValue.save).not.toHaveBeenCalled();
      expect(result?.completedLessonIds).toHaveLength(2);
    });

    it('should throw NotFoundException when lesson not found', async () => {
      mockLessonRepositoryValue.findOne.mockResolvedValue(null);

      await expect(
        service.completeLesson(
          { id: 'user-1', role: UserRole.STUDENT } as User,
          'course-1',
          'lesson-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when not enrolled', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      await expect(
        service.completeLesson(
          { id: 'user-1', role: UserRole.STUDENT } as User,
          'course-1',
          'lesson-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should initialize completedLessonIds if null', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      const enrollment = {
        id: 'enrollment-1',
        completedLessonIds: null,
        lastAccessedAt: new Date(),
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        ...enrollment,
        completedLessonIds: ['lesson-1'],
      });

      await service.completeLesson(
        { id: 'user-1', role: UserRole.STUDENT } as User,
        'course-1',
        'lesson-1',
      );

      expect(mockEnrollmentRepositoryValue.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completedLessonIds: ['lesson-1'],
        }),
      );
    });
  });

  describe('getLessonWithAccessControl', () => {
    it('should return lesson for instructor of the course', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      const result = await service.getLessonWithAccessControl(
        { id: 'instructor-1', role: UserRole.INSTRUCTOR } as User,
        'course-1',
        'lesson-1',
      );

      expect(result.lesson).toEqual(lesson);
      expect(result.hasAccess).toBe(true);
    });

    it('should return lesson for enrolled student', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue({
        id: 'enrollment-1',
      });

      const result = await service.getLessonWithAccessControl(
        { id: 'student-1', role: UserRole.STUDENT } as User,
        'course-1',
        'lesson-1',
      );

      expect(result.lesson).toEqual(lesson);
      expect(result.hasAccess).toBe(true);
    });

    it('should return lesson for admin on published course', async () => {
      const lesson = {
        id: 'lesson-1',
        isFreePreview: false,
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
            status: CourseStatus.PUBLISHED,
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      const result = await service.getLessonWithAccessControl(
        { id: 'admin-1', role: UserRole.ADMIN } as User,
        'course-1',
        'lesson-1',
      );

      expect(result.lesson).toEqual(lesson);
      expect(result.hasAccess).toBe(true);
    });

    it('should return lesson for admin on draft course', async () => {
      const lesson = {
        id: 'lesson-1',
        isFreePreview: false,
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
            status: CourseStatus.DRAFT,
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      const result = await service.getLessonWithAccessControl(
        { id: 'admin-1', role: UserRole.ADMIN } as User,
        'course-1',
        'lesson-1',
      );

      expect(result.lesson).toEqual(lesson);
      expect(result.hasAccess).toBe(true);
    });

    it('should throw NotFoundException if lesson does not belong to course', async () => {
      const lesson = {
        id: 'lesson-1',
        section: {
          course: {
            id: 'other-course',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);

      await expect(
        service.getLessonWithAccessControl(
          { id: 'student-1', role: UserRole.STUDENT } as User,
          'course-1',
          'lesson-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-enrolled student and non-preview lesson', async () => {
      const lesson = {
        id: 'lesson-1',
        isFreePreview: false,
        section: {
          course: {
            id: 'course-1',
            instructorId: 'instructor-1',
          },
        },
      };
      mockLessonRepositoryValue.findOne.mockResolvedValue(lesson);
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      await expect(
        service.getLessonWithAccessControl(
          { id: 'student-1', role: UserRole.STUDENT } as User,
          'course-1',
          'lesson-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEnrolledCourses', () => {
    it('should return enrolled courses with progress', async () => {
      const enrollments = [
        {
          course: {
            id: 'course-1',
            title: 'Test Course',
            description: 'Test',
            thumbnailUrl: null,
            level: CourseLevel.BEGINNER,
            instructor: { id: 'i1', fullName: 'Instructor' },
            sections: [
              {
                lessons: [
                  { id: 'l1' },
                  { id: 'l2' },
                  { id: 'l3' },
                  { id: 'l4' },
                ],
              },
            ],
          },
          completedLessonIds: ['l1', 'l2'],
          isArchived: false,
          lastAccessedAt: new Date(),
          enrolledAt: new Date(),
        },
      ];
      mockEnrollmentRepositoryValue.find.mockResolvedValue(enrollments);

      const result = await service.getEnrolledCourses('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(50);
      expect(result[0].status).toBe('in-progress');
    });

    it('should mark completed courses', async () => {
      const enrollments = [
        {
          course: {
            id: 'course-1',
            title: 'Test Course',
            description: 'Test',
            thumbnailUrl: null,
            level: CourseLevel.BEGINNER,
            instructor: { id: 'i1', fullName: 'Instructor' },
            sections: [{ lessons: [{ id: 'l1' }, { id: 'l2' }] }],
          },
          completedLessonIds: ['l1', 'l2'],
          isArchived: false,
          lastAccessedAt: new Date(),
          enrolledAt: new Date(),
        },
      ];
      mockEnrollmentRepositoryValue.find.mockResolvedValue(enrollments);

      const result = await service.getEnrolledCourses('user-1');

      expect(result[0].progress).toBe(100);
      expect(result[0].status).toBe('completed');
    });

    it('should filter by status', async () => {
      const enrollments = [
        {
          course: {
            id: 'course-1',
            title: 'Complete',
            description: '',
            thumbnailUrl: null,
            level: CourseLevel.BEGINNER,
            instructor: { id: 'i1', fullName: 'I' },
            sections: [{ lessons: [{ id: 'l1' }] }],
          },
          completedLessonIds: ['l1'],
          isArchived: false,
          lastAccessedAt: new Date(),
          enrolledAt: new Date(),
        },
        {
          course: {
            id: 'course-2',
            title: 'Incomplete',
            description: '',
            thumbnailUrl: null,
            level: CourseLevel.BEGINNER,
            instructor: { id: 'i1', fullName: 'I' },
            sections: [{ lessons: [{ id: 'l1' }, { id: 'l2' }] }],
          },
          completedLessonIds: ['l1'],
          isArchived: false,
          lastAccessedAt: new Date(),
          enrolledAt: new Date(),
        },
      ];
      mockEnrollmentRepositoryValue.find.mockResolvedValue(enrollments);

      const result = await service.getEnrolledCourses('user-1', {
        status: 'in-progress',
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Incomplete');
    });
  });

  describe('archiveCourse', () => {
    it('should archive a course enrollment', async () => {
      const enrollment = { id: 'e1', isArchived: false, archivedAt: null };
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        ...enrollment,
        isArchived: true,
      });

      const result = await service.archiveCourse('user-1', 'course-1');

      expect(result.isArchived).toBe(true);
    });

    it('should throw NotFoundException when not enrolled', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      await expect(service.archiveCourse('user-1', 'course-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already archived', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue({
        id: 'e1',
        isArchived: true,
      });

      await expect(service.archiveCourse('user-1', 'course-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unarchiveCourse', () => {
    it('should unarchive a course enrollment', async () => {
      const enrollment = {
        id: 'e1',
        isArchived: true,
        archivedAt: new Date(),
      };
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(enrollment);
      mockEnrollmentRepositoryValue.save.mockResolvedValue({
        ...enrollment,
        isArchived: false,
      });

      const result = await service.unarchiveCourse('user-1', 'course-1');

      expect(result.isArchived).toBe(false);
    });

    it('should throw NotFoundException when not enrolled', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue(null);

      await expect(
        service.unarchiveCourse('user-1', 'course-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not archived', async () => {
      mockEnrollmentRepositoryValue.findOne.mockResolvedValue({
        id: 'e1',
        isArchived: false,
      });

      await expect(
        service.unarchiveCourse('user-1', 'course-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUniqueTags', () => {
    it('should return unique tags from all courses', async () => {
      const courses = [
        { tags: ['react', 'javascript'] },
        { tags: ['typescript', 'react'] },
        { tags: ['node', 'javascript'] },
      ];
      const courseRepo = courseRepository;
      courseRepo.find.mockResolvedValue(courses);

      const result = await service.getUniqueTags();

      expect(result).toHaveLength(4);
      expect(result).toContain('react');
      expect(result).toContain('javascript');
      expect(result).toContain('typescript');
      expect(result).toContain('node');
    });

    it('should handle courses with no tags', async () => {
      const courses = [{ tags: null }, { tags: ['react'] }];
      const courseRepo = courseRepository;
      courseRepo.find.mockResolvedValue(courses);

      const result = await service.getUniqueTags();

      expect(result).toHaveLength(1);
      expect(result).toContain('react');
    });
  });
});
