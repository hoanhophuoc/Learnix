import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, Brackets } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import {
  AiQuizGeneratorService,
  GeneratedQuestion,
} from '../quizzes/services/ai-quiz-generator.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';

import { CreateCourseDto } from './dto/create-course.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CourseFilterOptions } from './dto/filter-course.dto';
import { GenerateQuizPreviewDto } from './dto/generate-quiz-preview.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CourseSection } from './entities/course-section.entity';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { LessonResource } from './entities/lesson-resource.entity';
import { Lesson } from './entities/lesson.entity';
import { CourseStatus } from './enums/course-status.enum';

export interface CourseDailyStat {
  date: string;
  count: number;
}

export interface EnrolledCourseDto {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  level: string;
  instructor: {
    id: string;
    fullName: string;
  };
  progress: number;
  totalLessons: number;
  completedLessons: number;
  status: 'in-progress' | 'completed';
  isArchived: boolean;
  lastAccessedAt: string;
  enrolledAt: string;
}

export interface EnrolledCoursesFilterOptions {
  archived?: boolean;
  status?: 'all' | 'in-progress' | 'completed';
}

export interface CoursesListResult {
  data: Course[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CourseRecommendation {
  course: Course;
  matchingTags: string[];
  score: number;
}

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Lesson)
    private lessonRepository: Repository<Lesson>,
    @InjectRepository(CourseSection)
    private sectionRepository: Repository<CourseSection>,
    @InjectRepository(LessonResource)
    private resourceRepository: Repository<LessonResource>,
    private aiQuizService: AiQuizGeneratorService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  async findAllPublished(
    options: CourseFilterOptions,
  ): Promise<CoursesListResult> {
    const {
      page = 1,
      limit = 10,
      search,
      level,
      tags,
      sort = 'date',
      order = 'DESC',
    } = options;

    const queryBuilder = this.coursesRepository.createQueryBuilder('course');

    // Base condition: Must be published
    queryBuilder
      .leftJoinAndSelect('course.instructor', 'instructor')
      .loadRelationCountAndMap('course.studentCount', 'course.enrollments')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED });

    // 1. UPDATED: Multi-field Search (Title, Description, Tags)
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(course.title) LIKE :search', { search: searchLower })
            .orWhere('LOWER(course.description) LIKE :search', {
              search: searchLower,
            })
            // Search within the comma-separated string of tags
            .orWhere('course.tags LIKE :search', { search: searchLower });
        }),
      );
    }

    // 2. Filter by Difficulty Level
    if (level) {
      queryBuilder.andWhere('course.level = :level', { level });
    }

    // 3. Filter by Specific Tags (Strict Filter)
    // This remains useful if the user clicks a specific tag pill in the UI
    if (tags && tags.length > 0) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          tags.forEach((tag, index) => {
            const paramName = `tag_${index}`;
            qb.orWhere(`course.tags LIKE :${paramName}`, {
              [paramName]: `%${tag}%`,
            });
          });
        }),
      );
    }

    // 4. Sorting
    const sortColumn = sort === 'price' ? 'course.price' : 'course.createdAt';
    queryBuilder.orderBy(sortColumn, order);

    // 5. Pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUniqueTags(): Promise<string[]> {
    const courses = await this.coursesRepository.find({
      where: { isPublished: true, status: CourseStatus.PUBLISHED },
      select: ['tags'],
    });

    const uniqueTags = new Set<string>();
    courses.forEach((course) => {
      course.tags?.forEach((tag) => uniqueTags.add(tag));
    });

    return Array.from(uniqueTags);
  }

  async findOne(id: string, user?: Partial<User>): Promise<Course> {
    const course = await this.coursesRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .leftJoinAndSelect('course.sections', 'sections')
      .leftJoinAndSelect('sections.lessons', 'lessons')
      .leftJoinAndSelect('lessons.resources', 'resources')
      .loadRelationCountAndMap('course.studentCount', 'course.enrollments')
      .where('course.id = :id', { id })
      .orderBy('sections.orderIndex', 'ASC')
      .addOrderBy('lessons.orderIndex', 'ASC')
      .getOne();

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Access Control:
    // If course is NOT published OR not approved (status != PUBLISHED), only the Instructor or Admin can view it.
    if (!course.isPublished || course.status !== CourseStatus.PUBLISHED) {
      const isInstructor = user?.id === course.instructor?.id;
      // Admin can view ANY course regardless of status
      const isAdmin = user?.role === UserRole.ADMIN;

      if (!isInstructor && !isAdmin) {
        throw new NotFoundException('Course not found');
      }
    }

    return course;
  }

  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    // Check if course exists and is accessible
    // Passing generic user object to allow enrollment only if visible
    const course = await this.findOne(courseId, { id: userId });

    // Check for self-enrollment is REMOVED to allow instructors to check their own courses as students
    // if (course.instructor?.id === userId) {
    //   throw new ConflictException('Cannot enroll in your own course');
    // }

    // Check if already enrolled
    const existing = await this.enrollmentRepository.findOne({
      where: { userId, courseId },
    });

    if (existing) {
      throw new ConflictException('Already enrolled in this course');
    }

    const enrollment = this.enrollmentRepository.create({
      userId,
      courseId,
      completedLessonIds: [],
    });

    const savedEnrollment = await this.enrollmentRepository.save(enrollment);

    // Notify user of successful enrollment (for free courses - paid courses get notified via payment)
    if (Number(course.price) === 0) {
      await this.notificationsService.notifyEnrollment(
        userId,
        course.title,
        course.id,
      );
    }

    return savedEnrollment;
  }

  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { userId, courseId },
      relations: ['course'],
    });

    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    await this.notificationsService.notifyUnenrollment(
      userId,
      enrollment.course.title,
      courseId,
    );

    await this.enrollmentRepository.remove(enrollment);
  }

  async checkEnrollment(
    userId: string,
    courseId: string,
  ): Promise<Enrollment | null> {
    return await this.enrollmentRepository.findOne({
      where: { userId, courseId },
    });
  }

  /**
   * Check if user has access to a course (either enrolled OR is the instructor)
   * This is used by the frontend to determine if "Continue Learning" button should be shown
   */
  async checkCourseAccess(
    user: User,
    courseId: string,
  ): Promise<{
    isEnrolled: boolean;
    isInstructor: boolean;
    isAdmin: boolean;
    hasAccess: boolean;
    enrollment: Enrollment | null;
  }> {
    const userId = user.id;
    // Check enrollment first
    const enrollment = await this.checkEnrollment(userId, courseId);

    // Check if user is the instructor
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      select: ['instructorId', 'status'],
    });

    const isInstructor = course?.instructorId === userId;
    const isAdmin = user.role === UserRole.ADMIN;

    // Admin has FULL access to everything, always.
    // We treat them as having "Admin Access" which overrides other checks.
    const hasAdminAccess = isAdmin;

    // Sanitize enrollment data to only include existing lessons
    if (enrollment) {
      const fullCourse = await this.coursesRepository.findOne({
        where: { id: courseId },
        relations: ['sections', 'sections.lessons'],
      });
      if (fullCourse) {
        const allLessonIds = fullCourse.sections
          .flatMap((s) => s.lessons)
          .map((l) => l.id);
        enrollment.completedLessonIds = (
          enrollment.completedLessonIds ?? []
        ).filter((id) => allLessonIds.includes(id));
      }
    }

    return {
      isEnrolled: Boolean(enrollment),
      isInstructor,
      isAdmin,
      // Admin always has access
      hasAccess: Boolean(enrollment) || isInstructor || hasAdminAccess,
      enrollment,
    };
  }

  async completeLesson(
    user: User,
    courseId: string,
    lessonId: string,
  ): Promise<Enrollment | null> {
    const userId = user.id;
    // Check if user is the instructor or admin - they don't need enrollment to access or track completion
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['section', 'section.course'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const isInstructor = lesson.section.course.instructorId === userId;
    const isAdmin = user.role === UserRole.ADMIN;

    // Instructors and Admins generally don't need enrollment to access lessons
    // BUT if they ARE enrolled (to test as student), we should track their progress.

    // Check if enrolled first
    const enrollment = await this.checkEnrollment(userId, courseId);

    // If not enrolled, but has special role, just return null (access allowed, no tracking)
    if (!enrollment) {
      if (isInstructor || isAdmin) {
        return null;
      }
      throw new NotFoundException('User is not enrolled in this course');
    }

    // Initialize array if null (legacy data safety - DB column is nullable)
    enrollment.completedLessonIds ??= [];

    // Add lesson ID if not already present
    if (!enrollment.completedLessonIds.includes(lessonId)) {
      enrollment.completedLessonIds.push(lessonId);
      enrollment.lastAccessedAt = new Date();
      await this.enrollmentRepository.save(enrollment);

      // Check if course is now completed
      const fullCourse = await this.coursesRepository.findOne({
        where: { id: courseId },
        relations: ['sections', 'sections.lessons'],
      });

      if (fullCourse) {
        const allLessonIds = fullCourse.sections.flatMap((s) =>
          s.lessons.map((l) => l.id),
        );
        const isCompleted =
          allLessonIds.length > 0 &&
          allLessonIds.every((id) =>
            enrollment.completedLessonIds?.includes(id),
          );

        if (isCompleted && !enrollment.completedAt) {
          enrollment.completedAt = new Date();
          await this.enrollmentRepository.save(enrollment);
          await this.notificationsService.notifyCourseCompleted(
            userId,
            fullCourse.title,
            fullCourse.id,
          );
        }
      }
    }

    return enrollment;
  }

  /**
   * Get a specific lesson with access control
   * Returns full lesson content only if:
   * 1. User is enrolled in the course, OR
   * 2. Lesson is marked as free preview
   * Otherwise, throws ForbiddenException
   */
  async getLessonWithAccessControl(
    user: User,
    courseId: string,
    lessonId: string,
  ): Promise<{ lesson: Lesson; hasAccess: boolean }> {
    const userId = user.id;
    // Find the lesson
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['section', 'section.course', 'resources'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Verify the lesson belongs to the specified course
    if (lesson.section.course.id !== courseId) {
      throw new NotFoundException('Lesson not found in this course');
    }

    // Check if user is enrolled
    const enrollment = await this.checkEnrollment(userId, courseId);
    const isEnrolled = Boolean(enrollment);

    // Check access: enrolled OR free preview OR is instructor OR is admin reviewing
    const isInstructor = lesson.section.course.instructorId === userId;
    const isAdmin = user.role === UserRole.ADMIN;
    const hasAccess =
      isEnrolled || lesson.isFreePreview || isInstructor || isAdmin; // Admin always has access regardless of course status

    if (!hasAccess) {
      throw new ForbiddenException(
        'You must enroll in this course to access this lesson',
      );
    }

    return { lesson, hasAccess: true };
  }

  /**
   * Get all enrolled courses for a user with progress calculation
   */
  async getEnrolledCourses(
    userId: string,
    options: EnrolledCoursesFilterOptions = {},
  ): Promise<EnrolledCourseDto[]> {
    const { archived = false, status = 'all' } = options;

    const enrollments = await this.enrollmentRepository.find({
      where: {
        userId,
        isArchived: archived,
        course: {
          isPublished: true,
          status: CourseStatus.PUBLISHED,
        },
      },
      relations: [
        'course',
        'course.instructor',
        'course.sections',
        'course.sections.lessons',
      ],
      order: { lastAccessedAt: 'DESC' },
    });

    const result: EnrolledCourseDto[] = enrollments.map((enrollment) => {
      const allLessons = enrollment.course.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;

      // Filter completed IDs to only count existing lessons
      const validCompletedIds = (enrollment.completedLessonIds ?? []).filter(
        (id) => allLessons.some((l) => l.id === id),
      );
      const completedLessons = validCompletedIds.length;

      const progress =
        totalLessons > 0
          ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
          : 0;
      const courseStatus: 'in-progress' | 'completed' =
        progress === 100 ? 'completed' : 'in-progress';

      return {
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
        thumbnailUrl: enrollment.course.thumbnailUrl,
        level: enrollment.course.level,

        instructor: {
          id: enrollment.course.instructor?.id ?? '',
          fullName:
            enrollment.course.instructor?.fullName ?? 'Unknown Instructor',
        },
        progress,
        totalLessons,
        completedLessons,
        status: courseStatus,
        isArchived: enrollment.isArchived,
        lastAccessedAt: enrollment.lastAccessedAt.toISOString(),
        enrolledAt: enrollment.enrolledAt.toISOString(),
      };
    });

    // Filter by status if specified
    if (status !== 'all') {
      return result.filter((course) => course.status === status);
    }

    return result;
  }

  /**
   * Archive a course enrollment (hide from main list but preserve progress)
   */
  async archiveCourse(userId: string, courseId: string): Promise<Enrollment> {
    const enrollment = await this.checkEnrollment(userId, courseId);
    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    if (enrollment.isArchived) {
      throw new ConflictException('Course is already archived');
    }

    enrollment.isArchived = true;
    enrollment.archivedAt = new Date();

    return await this.enrollmentRepository.save(enrollment);
  }

  /**
   * Unarchive a course enrollment (restore to main list)
   */
  async unarchiveCourse(userId: string, courseId: string): Promise<Enrollment> {
    const enrollment = await this.checkEnrollment(userId, courseId);
    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    if (!enrollment.isArchived) {
      throw new ConflictException('Course is not archived');
    }

    enrollment.isArchived = false;
    enrollment.archivedAt = null as unknown as Date;

    return await this.enrollmentRepository.save(enrollment);
  }

  /**
   * Get course recommendations based on tags from user's enrolled courses
   * Algorithm:
   * 1. Collect all unique tags from user's enrolled courses
   * 2. Find published courses that share at least one tag
   * 3. Exclude courses the user is already enrolled in
   * 4. Score courses by number of matching tags
   * 5. Return top recommendations sorted by score
   */
  async getRecommendations(
    userId: string,
    limit = 6,
  ): Promise<CourseRecommendation[]> {
    // Step 1: Get all enrolled courses for the user
    const enrollments = await this.enrollmentRepository.find({
      where: { userId },
      relations: ['course'],
    });

    if (enrollments.length === 0) {
      // No enrolled courses - return popular courses instead
      const popularCourses = await this.coursesRepository
        .createQueryBuilder('course')
        .leftJoinAndSelect('course.instructor', 'instructor')
        .loadRelationCountAndMap('course.studentCount', 'course.enrollments')
        .where('course.isPublished = :isPublished', { isPublished: true })
        .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
        .orderBy('course.createdAt', 'DESC')
        .take(limit)
        .getMany();

      return popularCourses.map((course) => ({
        course,
        matchingTags: [],
        score: 0,
      }));
    }

    // Step 2: Collect unique tags from enrolled courses
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
    const userTags = new Set<string>();
    enrollments.forEach((enrollment) => {
      enrollment.course.tags?.forEach((tag) => userTags.add(tag.toLowerCase()));
    });

    if (userTags.size === 0) {
      // No tags in enrolled courses - return popular courses
      const popularCourses = await this.coursesRepository
        .createQueryBuilder('course')
        .leftJoinAndSelect('course.instructor', 'instructor')
        .loadRelationCountAndMap('course.studentCount', 'course.enrollments')
        .where('course.isPublished = :isPublished', { isPublished: true })
        .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
        .andWhere('course.id NOT IN (:...enrolledIds)', {
          enrolledIds: Array.from(enrolledCourseIds),
        })
        .orderBy('course.createdAt', 'DESC')
        .take(limit)
        .getMany();

      return popularCourses.map((course) => ({
        course,
        matchingTags: [],
        score: 0,
      }));
    }

    // Step 3: Find all published courses (excluding enrolled ones)
    const queryBuilder = this.coursesRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .loadRelationCountAndMap('course.studentCount', 'course.enrollments')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .andWhere('course.id NOT IN (:...enrolledIds)', {
        enrolledIds: Array.from(enrolledCourseIds),
      });

    // Add tag matching conditions (OR for any tag match)
    const tagConditions = Array.from(userTags).map(
      (_, index) => `LOWER(course.tags) LIKE :tag_${index}`,
    );
    if (tagConditions.length > 0) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          Array.from(userTags).forEach((tag, index) => {
            if (index === 0) {
              qb.where(`LOWER(course.tags) LIKE :tag_${index}`, {
                [`tag_${index}`]: `%${tag}%`,
              });
            } else {
              qb.orWhere(`LOWER(course.tags) LIKE :tag_${index}`, {
                [`tag_${index}`]: `%${tag}%`,
              });
            }
          });
        }),
      );
    }

    const candidateCourses = await queryBuilder.getMany();

    // Step 4: Score courses by number of matching tags
    const scoredCourses = candidateCourses.map((course) => {
      const courseTags = course.tags?.map((t) => t.toLowerCase()) ?? [];
      const matchingTags = courseTags.filter((tag) => userTags.has(tag));
      return {
        course,
        matchingTags,
        score: matchingTags.length,
      };
    });

    // Step 5: Sort by score (descending) and return top recommendations
    scoredCourses.sort((a, b) => b.score - a.score);

    return scoredCourses.slice(0, limit);
  }

  // --- Instructor: Course Management ---

  async create(
    createCourseDto: CreateCourseDto,
    instructorId: string,
  ): Promise<Course> {
    const course = this.coursesRepository.create({
      ...createCourseDto,
      instructor: { id: instructorId },
      status: CourseStatus.DRAFT, // Default to draft
      isPublished: false, // Legacy field
    });
    return await this.coursesRepository.save(course);
  }

  async update(
    id: string,
    updateCourseDto: UpdateCourseDto,
    instructorId: string,
  ): Promise<Course> {
    const course = await this.findOne(id, {
      id: instructorId,
      role: UserRole.INSTRUCTOR,
    });
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You can only update your own courses');
    }
    Object.assign(course, updateCourseDto);
    return await this.coursesRepository.save(course);
  }

  async unpublishCourse(id: string, instructorId: string): Promise<Course> {
    const course = await this.findOne(id, {
      id: instructorId,
      role: UserRole.INSTRUCTOR,
    });

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You can only unpublish your own courses');
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Course is not published');
    }

    course.status = CourseStatus.DRAFT;
    course.isPublished = false;

    return await this.coursesRepository.save(course);
  }

  async remove(id: string, instructorId: string): Promise<void> {
    const course = await this.findOne(id, {
      id: instructorId,
      role: UserRole.INSTRUCTOR,
    });
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You can only delete your own courses');
    }
    await this.coursesRepository.softRemove(course);
  }

  async findInstructorCourses(instructorId: string): Promise<Course[]> {
    return await this.coursesRepository.find({
      where: { instructorId },
      order: { createdAt: 'DESC' },
      relations: ['sections', 'sections.lessons'], // Load structure
    });
  }

  // --- Instructor: Section Management ---

  async createSection(
    courseId: string,
    dto: CreateSectionDto,
    instructorId: string,
  ): Promise<CourseSection> {
    const course = await this.findOne(courseId, {
      id: instructorId,
      role: UserRole.INSTRUCTOR,
    });
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only add sections to your own courses',
      );
    }

    // We need to inject CourseSection repository or use dataSource in constructor
    // Assuming you inject it as @InjectRepository(CourseSection) private sectionRepo: Repository<CourseSection>
    // For now, using query runner or assuming it's injected (add to constructor if missing)

    // Quick fix: Add CourseSection to constructor injection if not present:
    // @InjectRepository(CourseSection) private sectionRepository: Repository<CourseSection>

    // Temporary implementation using createQueryBuilder if repo not available directly in snippet context
    // Ideally, update constructor to include sectionRepository

    return await this.sectionRepository.save(
      this.sectionRepository.create({ ...dto, courseId }),
    );
  }

  async removeSection(sectionId: string, instructorId: string): Promise<void> {
    const section = await this.sectionRepository.findOne({
      where: { id: sectionId },
      relations: ['course'],
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    await this.sectionRepository.remove(section);
  }

  // --- Instructor: Lesson Management ---

  async createLesson(
    sectionId: string,
    dto: CreateLessonDto,
    instructorId: string,
  ): Promise<Lesson> {
    const section = await this.sectionRepository.findOne({
      where: { id: sectionId },
      relations: ['course'],
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    return await this.lessonRepository.save(
      this.lessonRepository.create({ ...dto, sectionId }),
    );
  }

  async updateLesson(
    lessonId: string,
    dto: UpdateLessonDto,
    instructorId: string,
  ): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['section', 'section.course'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(lesson, dto);
    return await this.lessonRepository.save(lesson);
  }

  async removeLesson(lessonId: string, instructorId: string): Promise<void> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['section', 'section.course'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    await this.lessonRepository.remove(lesson);
  }

  async reorderSections(
    courseId: string,
    sectionIds: string[],
    instructorId: string,
  ): Promise<void> {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      select: ['id', 'instructorId'],
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    await this.sectionRepository.manager.transaction(async (manager) => {
      for (const [index, sectionId] of sectionIds.entries()) {
        await manager.update(CourseSection, sectionId, { orderIndex: index });
      }
    });
  }

  // --- Instructor: Resource Management ---

  async addResource(
    lessonId: string,
    dto: CreateResourceDto,
    instructorId: string,
  ): Promise<LessonResource> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['section', 'section.course'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    const resource = this.resourceRepository.create({
      ...dto,
      type: dto.type,
      lessonId,
    });

    return await this.resourceRepository.save(resource);
  }

  async removeResource(
    resourceId: string,
    instructorId: string,
  ): Promise<void> {
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId },
      relations: ['lesson', 'lesson.section', 'lesson.section.course'],
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource.lesson.section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    await this.resourceRepository.remove(resource);
  }

  async reorderLessons(
    sectionId: string,
    lessonIds: string[],
    instructorId: string,
  ): Promise<void> {
    const section = await this.sectionRepository.findOne({
      where: { id: sectionId },
      relations: ['course'],
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.course.instructorId !== instructorId) {
      throw new ForbiddenException('Access denied');
    }

    // Validate that all lessons belong to the section
    const lessons = await this.lessonRepository.find({
      where: lessonIds.map((id) => ({ id })),
    });

    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    for (const id of lessonIds) {
      const lesson = lessonMap.get(id);
      if (!lesson) {
        throw new BadRequestException(`Lesson ${id} not found`);
      }
      if (lesson.sectionId !== sectionId) {
        throw new BadRequestException(
          `Lesson ${id} does not belong to section ${sectionId}`,
        );
      }
    }

    await this.lessonRepository.manager.transaction(async (manager) => {
      for (const [index, lessonId] of lessonIds.entries()) {
        await manager.update(Lesson, lessonId, { orderIndex: index });
      }
    });
  }

  async count(): Promise<number> {
    return await this.coursesRepository.count();
  }

  async countPublished(): Promise<number> {
    return await this.coursesRepository.count({
      where: { isPublished: true, status: CourseStatus.PUBLISHED },
    });
  }

  // --- Statistics ---

  async countEnrollments(): Promise<number> {
    return await this.enrollmentRepository.count();
  }

  async countPublishedEnrollments(): Promise<number> {
    return await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin('enrollment.course', 'course')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .getCount();
  }

  // --- Moderation ---

  async submitForApproval(id: string, userId: string): Promise<Course> {
    const course = await this.findOne(id, {
      id: userId,
      role: UserRole.INSTRUCTOR,
    });
    if (
      course.status !== CourseStatus.DRAFT &&
      course.status !== CourseStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only draft or rejected courses can be submitted',
      );
    }

    course.status = CourseStatus.PENDING;
    const savedCourse = await this.coursesRepository.save(course);

    // Notify all admins about the new course submission
    const admins = await this.usersService.findAllAdmins();
    const adminIds = admins.map((admin) => admin.id);
    const instructorName = course.instructor?.fullName ?? 'Unknown Instructor';
    await this.notificationsService.notifyCourseSubmitted(
      adminIds,
      course.title,
      instructorName,
      course.id,
    );

    return savedCourse;
  }

  async approveCourse(id: string): Promise<Course> {
    const course = await this.findOne(id, { role: UserRole.ADMIN });
    if (course.status !== CourseStatus.PENDING) {
      throw new BadRequestException('Course is not pending approval');
    }

    course.status = CourseStatus.PUBLISHED;
    course.isPublished = true;
    const savedCourse = await this.coursesRepository.save(course);

    // Notify instructor that their course was approved
    await this.notificationsService.notifyCourseApproved(
      course.instructorId,
      course.title,
      course.id,
    );

    return savedCourse;
  }

  async rejectCourse(id: string, reason: string): Promise<Course> {
    const course = await this.findOne(id, { role: UserRole.ADMIN });
    if (course.status !== CourseStatus.PENDING) {
      throw new BadRequestException('Course is not pending approval');
    }

    course.status = CourseStatus.REJECTED;
    const savedCourse = await this.coursesRepository.save(course);

    // Notify instructor that their course was rejected
    await this.notificationsService.notifyCourseRejected(
      course.instructorId,
      course.title,
      course.id,
      reason,
    );

    return savedCourse;
  }

  async findAllPending(): Promise<Course[]> {
    return await this.coursesRepository.find({
      where: { status: CourseStatus.PENDING },
      relations: ['instructor'],
      order: { createdAt: 'DESC' },
    });
  }

  // --- Stats for Admin ---

  async getCourseGrowthStats(_days = 30): Promise<CourseDailyStat[]> {
    const data = await this.coursesRepository
      .createQueryBuilder('course')
      .select("TO_CHAR(course.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(*)', 'count')
      .where("course.createdAt >= NOW() - INTERVAL '30 days'")
      .andWhere('course.isPublished = :isPublished', { isPublished: true })
      .groupBy("TO_CHAR(course.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return (data as { date: string; count: string }[]).map((d) => ({
      date: d.date,
      count: Number(d.count),
    }));
  }

  async getEnrollmentGrowthStats(_days = 30): Promise<CourseDailyStat[]> {
    const data = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin('enrollment.course', 'course')
      .select("TO_CHAR(enrollment.enrolledAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("enrollment.enrolledAt >= NOW() - INTERVAL '30 days'")
      .andWhere('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .groupBy("TO_CHAR(enrollment.enrolledAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return (data as { date: string; count: string }[]).map((d) => ({
      date: d.date,
      count: Number(d.count),
    }));
  }

  async getRevenueGrowthStats(_days = 30): Promise<CourseDailyStat[]> {
    const data = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin('enrollment.course', 'course')
      .select("TO_CHAR(enrollment.enrolledAt, 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(course.price)', 'count') // Reusing 'count' field for value to match interface
      .where("enrollment.enrolledAt >= NOW() - INTERVAL '30 days'")
      .andWhere('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .groupBy("TO_CHAR(enrollment.enrolledAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return (data as { date: string; count: string }[]).map((d) => ({
      date: d.date,
      count: Number(d.count || 0),
    }));
  }

  async getAverageCompletionRate(): Promise<number> {
    // This is a simplified calculation.
    // In a real app, we'd check % of lessons completed per enrollment.
    // For now, let's look at enrollments with 'completedAt' set vs total enrollments
    const totalEnrollments = await this.enrollmentRepository.count();
    if (totalEnrollments === 0) return 0;

    const completedEnrollments = await this.enrollmentRepository.count({
      where: { completedAt: Not(IsNull()) },
    });

    return Math.round((completedEnrollments / totalEnrollments) * 100);
  }

  async getTotalRevenue(): Promise<number> {
    const result: { total?: string } | undefined =
      await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .leftJoin('enrollment.course', 'course')
        .where('course.isPublished = :isPublished', { isPublished: true })
        .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
        .select('SUM(course.price)', 'total')
        .getRawOne();

    return Number(result?.total ?? 0);
  }

  async getCourseCategoryDistribution(): Promise<
    { name: string; value: number }[]
  > {
    const result = await this.coursesRepository
      .createQueryBuilder('course')
      .select('course.level', 'name')
      .addSelect('COUNT(*)', 'value')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .groupBy('course.level')
      .getRawMany();

    return (result as { name: string; value: string }[]).map((r) => ({
      name: r.name.charAt(0).toUpperCase() + r.name.slice(1), // Capitalize
      value: Number(r.value),
    }));
  }

  async generateQuizPreview(
    dto: GenerateQuizPreviewDto,
  ): Promise<{ title: string; questions: GeneratedQuestion[] }> {
    const { lessonIds, count, topic, preferredTypes } = dto;

    const lessons = await this.lessonRepository.find({
      where: lessonIds.map((id) => ({ id })),
    });

    if (lessons.length === 0) {
      throw new NotFoundException('Selected lessons not found');
    }

    let combinedText = '';

    for (const lesson of lessons) {
      for (const block of lesson.content) {
        if (block.type === 'text') {
          combinedText += `${block.content}\n\n`;
        } else if (block.type === 'video') {
          const videoTitle =
            block.metadata?.caption ?? block.metadata?.filename ?? 'Video';
          combinedText += `\n[Video Content: ${videoTitle}]\n(Video URL: ${block.content})\n\n`;
        }
      }
    }

    if (!combinedText.trim()) {
      throw new ConflictException(
        'Selected lessons contain no text content to generate quiz from.',
      );
    }

    // If topic provided, prepend it to text
    if (topic) {
      combinedText = `TOPIC/FOCUS: ${topic}\n\nLESSON CONTENT:\n${combinedText}`;
    }

    // Call AI service
    return await this.aiQuizService.generateQuizFromText(
      combinedText,
      count,
      preferredTypes,
    );
  }
}
