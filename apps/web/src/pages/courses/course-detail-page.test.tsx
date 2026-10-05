import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { toast } from 'sonner';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as useAuthModule from '@/contexts/use-auth';
import { coursesApi } from '@/features/courses/api/courses-api';

import { CourseDetailPage } from './course-detail-page';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    promise: vi.fn((p) => p),
  },
}));

// Mock courses API
vi.mock('@/features/courses/api/courses-api');

// Mock useAuth
vi.mock('@/contexts/use-auth', () => ({
  useAuth: vi.fn(),
}));

// Mock AuthRequiredModal
vi.mock('@/features/auth/components/auth-required-modal', () => ({
  AuthRequiredModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Auth Modal</div> : null,
}));

const mockCourse = {
  id: 'course-1',
  title: 'React Masterclass',
  description: 'Learn React from beginner to advanced',
  level: 'intermediate' as 'intermediate' | 'beginner' | 'advanced',
  price: 29.99,
  tags: ['react', 'javascript'],
  instructor: {
    id: 'instructor-1',
    userId: 'instructor-1',
    fullName: 'John Doe',
    email: 'instructor@example.com',
    role: 'instructor',
  },
  thumbnailUrl: undefined,
  studentCount: 150,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  status: 'published' as 'published' | 'draft' | 'pending' | 'rejected',
  isPublished: true,
  sections: [
    {
      id: 'section-1',
      title: 'Getting Started',
      orderIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction',
          type: 'standard' as 'standard' | 'quiz',
          content: [],
          resources: [],
          durationSeconds: 600,
          isFreePreview: true,
          orderIndex: 0,
        },
        {
          id: 'lesson-2',
          title: 'Setting Up',
          type: 'standard' as 'standard' | 'quiz',
          content: [],
          resources: [],
          durationSeconds: 300,
          isFreePreview: false,
          orderIndex: 1,
        },
      ],
    },
  ],
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithProviders = (courseId = 'course-1') => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
        <Routes>
          <Route path="/courses/:id" element={<CourseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('CourseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coursesApi.getCourse).mockResolvedValue(mockCourse);
    vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
      isEnrolled: false,
      isInstructor: false,
      isAdmin: false,
      hasAccess: false,
      progress: null,
    });

    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it('renders course title', async () => {
    renderWithProviders();

    expect(await screen.findByText('React Masterclass')).toBeInTheDocument();
  });

  it('renders course description', async () => {
    renderWithProviders();

    expect(
      await screen.findByText('Learn React from beginner to advanced'),
    ).toBeInTheDocument();
  });

  it('renders course level badge', async () => {
    renderWithProviders();

    expect(await screen.findByText('intermediate')).toBeInTheDocument();
  });

  it('renders course price', async () => {
    renderWithProviders();

    expect(await screen.findByText('$29.99')).toBeInTheDocument();
  });

  it('renders instructor name', async () => {
    renderWithProviders();

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
  });

  it('renders course content section', async () => {
    renderWithProviders();

    expect(
      await screen.findByRole('heading', { name: /Course Content/i }),
    ).toBeInTheDocument();
  });

  it('renders section and lessons', async () => {
    renderWithProviders();

    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Setting Up')).toBeInTheDocument();
  });

  it('shows enroll button for guest users', async () => {
    renderWithProviders();

    expect(
      await screen.findByRole('button', { name: /Enroll Now/i }),
    ).toBeInTheDocument();
  });

  it('shows auth modal when guest clicks enroll', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const enrollButton = await screen.findByRole('button', {
      name: /Enroll Now/i,
    });
    await user.click(enrollButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows Preview button for free preview lessons', async () => {
    renderWithProviders();

    expect(
      await screen.findByRole('button', { name: /Preview/i }),
    ).toBeInTheDocument();
  });

  it('shows lock icon for non-preview lessons for guests', async () => {
    renderWithProviders();

    // Wait for content to load
    await screen.findByText('Setting Up');

    // Check for lock icons in the document
    const lockButtons = document.querySelectorAll(
      'button:has([class*="lock" i])',
    );
    expect(lockButtons.length).toBeGreaterThan(0);
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      // Reset auth mock for this block
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: {
          id: 'user-1',
          userId: 'user-1',
          email: 'test@example.com',
          role: 'student',
        },
        isLoading: false,
        isAuthenticated: true,
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
    });

    it('shows enroll button for non-enrolled authenticated user', async () => {
      vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
        isEnrolled: false,
        isInstructor: false,
        isAdmin: false,
        hasAccess: false,
        progress: null,
      });
      renderWithProviders();
      expect(
        await screen.findByRole('button', { name: /Enroll Now/i }),
      ).toBeInTheDocument();
    });

    it('shows success toast when enrollment is successful', async () => {
      const user = userEvent.setup();
      // Mock a free course so enrollment happens directly (not via checkout)
      vi.mocked(coursesApi.getCourse).mockResolvedValue({
        ...mockCourse,
        price: 0, // Free course triggers direct enrollment
      });
      vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
        isEnrolled: false,
        isInstructor: false,
        isAdmin: false,
        hasAccess: false,
        progress: null,
      });
      vi.mocked(coursesApi.enroll).mockResolvedValue({
        success: true,
        message: 'Enrolled successfully',
      });

      renderWithProviders();

      const enrollButton = await screen.findByRole('button', {
        name: /Enroll Now/i,
      });
      await user.click(enrollButton);

      await waitFor(() => {
        expect(coursesApi.enroll).toHaveBeenCalledWith('course-1');
        expect(toast.promise).toHaveBeenCalledWith(
          expect.any(Promise),
          expect.objectContaining({
            success: 'Successfully enrolled!',
          }),
        );
      });
    });

    it('shows enrolled badge and continue button for enrolled user', async () => {
      vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
        isEnrolled: true,
        isInstructor: false,
        isAdmin: false,
        hasAccess: true,
        progress: {
          id: 'progress-1',
          completedLessonIds: ['lesson-1'],
          lastAccessedAt: new Date().toISOString(),
        },
      });

      renderWithProviders();

      // Wait for the enrolled text, using findByText which waits/retries
      expect(await screen.findByText(/You are enrolled/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /Continue Learning|View Course Content/i,
        }),
      ).toBeInTheDocument();
    });

    it('shows View button for lessons when enrolled', async () => {
      vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
        isEnrolled: true,
        isInstructor: false,
        isAdmin: false,
        hasAccess: true,
        progress: {
          id: 'progress-1',
          completedLessonIds: [],
          lastAccessedAt: new Date().toISOString(),
        },
      });

      renderWithProviders();

      // Wait for enrolled text first to confirm state
      await screen.findByText(/You are enrolled/i);

      const viewButtons = await screen.findAllByRole('button', {
        name: /View/i,
      });
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('shows Review Course button for admin when course is pending', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: {
          id: 'admin-1',
          userId: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
        },
        isLoading: false,
        isAuthenticated: true,
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      vi.mocked(coursesApi.getCourse).mockResolvedValue({
        ...mockCourse,
        status: 'pending',
        isPublished: false,
      });
      vi.mocked(coursesApi.getEnrollment).mockResolvedValue({
        isEnrolled: false,
        isInstructor: false,
        isAdmin: true,
        hasAccess: true,
        progress: null,
      });

      renderWithProviders();

      expect(
        await screen.findByRole('button', { name: /Review Course/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    vi.mocked(coursesApi.getCourse).mockImplementation(
      () =>
        new Promise(() => {
          /* pending */
        }),
    ); // Never resolves
    renderWithProviders();

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows not found message for invalid course', async () => {
    vi.mocked(coursesApi.getCourse).mockResolvedValue(
      null as unknown as ReturnType<
        typeof coursesApi.getCourse
      > extends Promise<infer T>
        ? T
        : never,
    );
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/Course not found/i)).toBeInTheDocument();
    });
  });

  it('displays total lesson count', async () => {
    renderWithProviders();

    // Wait for page to load
    await screen.findByText('React Masterclass');

    // Multiple elements show lesson count, use getAllByText
    const lessonCountElements = screen.getAllByText(/2\s*lessons/i);
    expect(lessonCountElements.length).toBeGreaterThan(0);
  });
});
