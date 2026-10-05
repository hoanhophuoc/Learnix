import { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Play,
  CheckCircle,
  Clock,
  GraduationCap,
  Search,
  FolderArchive,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageContainer } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  coursesApi,
  type EnrolledCourse,
} from '@/features/courses/api/courses-api';
import { cn, formatRelativeTime } from '@/lib/utils';

type TabValue = 'all' | 'in-progress' | 'completed' | 'archived';

export function MyLearningPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch active courses (not archived)
  const { data: activeCourses, isLoading: isLoadingActive } = useQuery({
    queryKey: ['enrolled-courses', { archived: false }],
    queryFn: () => coursesApi.getEnrolledCourses({ archived: false }),
  });

  // Fetch archived courses
  const { data: archivedCourses, isLoading: isLoadingArchived } = useQuery({
    queryKey: ['enrolled-courses', { archived: true }],
    queryFn: () => coursesApi.getEnrolledCourses({ archived: true }),
  });

  // Archive mutation with optimistic update
  const archiveMutation = useMutation({
    mutationFn: coursesApi.archiveCourse,
    onMutate: async (courseId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['enrolled-courses'] });

      // Snapshot previous values
      const previousActive = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: false },
      ]);
      const previousArchived = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: true },
      ]);

      // Optimistically update
      const courseToArchive = previousActive?.find((c) => c.id === courseId);
      if (courseToArchive) {
        queryClient.setQueryData<EnrolledCourse[]>(
          ['enrolled-courses', { archived: false }],
          (old) => old?.filter((c) => c.id !== courseId) ?? [],
        );
        queryClient.setQueryData<EnrolledCourse[]>(
          ['enrolled-courses', { archived: true }],
          (old) => [...(old ?? []), { ...courseToArchive, isArchived: true }],
        );
      }

      return { previousActive, previousArchived };
    },
    onError: (_err, _courseId, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ['enrolled-courses', { archived: false }],
        context?.previousActive,
      );
      queryClient.setQueryData(
        ['enrolled-courses', { archived: true }],
        context?.previousArchived,
      );
      toast.error('Unable to archive course. Please try again.');
    },
    onSuccess: () => {
      toast.success('Course archived successfully');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrolled-courses'] });
    },
  });

  // Unarchive mutation with optimistic update
  const unarchiveMutation = useMutation({
    mutationFn: coursesApi.unarchiveCourse,
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey: ['enrolled-courses'] });

      const previousActive = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: false },
      ]);
      const previousArchived = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: true },
      ]);

      const courseToUnarchive = previousArchived?.find(
        (c) => c.id === courseId,
      );
      if (courseToUnarchive) {
        queryClient.setQueryData<EnrolledCourse[]>(
          ['enrolled-courses', { archived: true }],
          (old) => old?.filter((c) => c.id !== courseId) ?? [],
        );
        queryClient.setQueryData<EnrolledCourse[]>(
          ['enrolled-courses', { archived: false }],
          (old) => [
            { ...courseToUnarchive, isArchived: false },
            ...(old ?? []),
          ],
        );
      }

      return { previousActive, previousArchived };
    },
    onError: (_err, _courseId, context) => {
      queryClient.setQueryData(
        ['enrolled-courses', { archived: false }],
        context?.previousActive,
      );
      queryClient.setQueryData(
        ['enrolled-courses', { archived: true }],
        context?.previousArchived,
      );
      toast.error('Unable to restore course. Please try again.');
    },
    onSuccess: () => {
      toast.success('Course restored to My Learning');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrolled-courses'] });
    },
  });

  // Unenroll mutation with optimistic update
  const unenrollMutation = useMutation({
    mutationFn: coursesApi.unenrollFromCourse,
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey: ['enrolled-courses'] });

      const previousActive = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: false },
      ]);
      const previousArchived = queryClient.getQueryData<EnrolledCourse[]>([
        'enrolled-courses',
        { archived: true },
      ]);

      // Remove from active courses
      queryClient.setQueryData<EnrolledCourse[]>(
        ['enrolled-courses', { archived: false }],
        (old) => old?.filter((c) => c.id !== courseId) ?? [],
      );

      // Also ensure it's removed from archived if present (though unlikely to be called from there)
      queryClient.setQueryData<EnrolledCourse[]>(
        ['enrolled-courses', { archived: true }],
        (old) => old?.filter((c) => c.id !== courseId) ?? [],
      );

      return { previousActive, previousArchived };
    },
    onError: (_err, _courseId, context) => {
      queryClient.setQueryData(
        ['enrolled-courses', { archived: false }],
        context?.previousActive,
      );
      queryClient.setQueryData(
        ['enrolled-courses', { archived: true }],
        context?.previousArchived,
      );
      toast.error('Unable to unenroll. Please try again.');
    },
    onSuccess: () => {
      toast.success('Unenrolled successfully');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrolled-courses'] });
    },
  });

  // Filter courses based on active tab and search query
  const getFilteredCourses = (): EnrolledCourse[] => {
    const getCoursesByTab = (tab: TabValue): EnrolledCourse[] => {
      switch (tab) {
        case 'archived':
          return archivedCourses ?? [];
        case 'all':
          return activeCourses ?? [];
        case 'in-progress':
          return activeCourses?.filter((c) => c.status === 'in-progress') ?? [];
        case 'completed':
          return activeCourses?.filter((c) => c.status === 'completed') ?? [];
        default:
          return [];
      }
    };

    let courses = getCoursesByTab(activeTab);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.instructor.fullName.toLowerCase().includes(query),
      );
    }

    return courses;
  };

  const filteredCourses = getFilteredCourses();
  const isLoading = isLoadingActive || isLoadingArchived;

  const getTabCount = (tab: TabValue): number => {
    switch (tab) {
      case 'all':
        return activeCourses?.length ?? 0;
      case 'in-progress':
        return (
          activeCourses?.filter((c) => c.status === 'in-progress').length ?? 0
        );
      case 'completed':
        return (
          activeCourses?.filter((c) => c.status === 'completed').length ?? 0
        );
      case 'archived':
        return archivedCourses?.length ?? 0;
      default:
        return 0;
    }
  };

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Learning</h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and continue learning
            </p>
          </div>
          <div className="w-full md:w-80">
            <Input
              leftIcon={<Search className="w-4 h-4" />}
              placeholder="Search your courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid h-12 p-1 bg-muted/50">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">All Courses</span>
              <span className="sm:hidden">All</span>
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {getTabCount('all')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">In Progress</span>
              <span className="sm:hidden">Active</span>
              <span className="text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full">
                {getTabCount('in-progress')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Completed</span>
              <span className="sm:hidden">Done</span>
              <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full">
                {getTabCount('completed')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
            >
              <FolderArchive className="w-4 h-4" />
              <span className="hidden sm:inline">Archived</span>
              <span className="sm:hidden">Archive</span>
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {getTabCount('archived')}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content - Same for all tabs, just filtered */}
          {['all', 'in-progress', 'completed', 'archived'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-6">
              {renderTabContent({
                isLoading,
                filteredCourses,
                tab: tab as TabValue,
                searchQuery,
                archiveMutation,
                unarchiveMutation,
                unenrollMutation,
              })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageContainer>
  );
}

// Helper function to render tab content (avoids nested ternary)
interface RenderTabContentProps {
  isLoading: boolean;
  filteredCourses: EnrolledCourse[];
  tab: TabValue;
  searchQuery: string;
  archiveMutation: { mutate: (id: string) => void };
  unarchiveMutation: { mutate: (id: string) => void };
  unenrollMutation: { mutate: (id: string) => void };
}

function renderTabContent({
  isLoading,
  filteredCourses,
  tab,
  searchQuery,
  archiveMutation,
  unarchiveMutation,
  unenrollMutation,
}: RenderTabContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (filteredCourses.length === 0) {
    return (
      <EmptyState tab={tab} hasSearchQuery={Boolean(searchQuery.trim())} />
    );
  }

  return (
    <div className="space-y-4">
      {filteredCourses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          onArchive={() => void archiveMutation.mutate(course.id)}
          onUnarchive={() => void unarchiveMutation.mutate(course.id)}
          onUnenroll={() => void unenrollMutation.mutate(course.id)}
        />
      ))}
    </div>
  );
}

// Helper function to render action button content
function renderActionButtonContent(isCompleted: boolean) {
  if (isCompleted) {
    return (
      <>
        <GraduationCap className="w-4 h-4 mr-2" />
        Review Course
      </>
    );
  }
  return (
    <>
      <Play className="w-4 h-4 mr-2" />
      Continue Learning
    </>
  );
}

// Course Card Component (Udemy-style)
interface CourseCardProps {
  course: EnrolledCourse;
  onArchive: () => void;
  onUnarchive: () => void;
  onUnenroll: () => void;
}

function CourseCard({
  course,
  onArchive,
  onUnarchive,
  onUnenroll,
}: CourseCardProps) {
  const isCompleted = course.status === 'completed';

  return (
    <Card className="group premium-card overflow-hidden hover:shadow-lg transition-colors duration-300 hover:-translate-y-0.5">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Thumbnail */}
          <Link
            to={`/courses/${course.id}/learn`}
            className="relative w-full md:w-64 h-40 md:h-36 shrink-0 overflow-hidden"
          >
            {course.thumbnailUrl ? (
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-primary/10 to-primary/30 flex items-center justify-center">
                <BookOpen className="w-12 h-12 text-primary/40" />
              </div>
            )}
            {/* Play overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-5 h-5 text-primary ml-0.5" />
              </div>
            </div>
            {/* Completed badge */}
            {isCompleted && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Completed
              </div>
            )}
          </Link>

          {/* Content */}
          <div className="flex-1 p-4 md:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <Link
                  to={`/courses/${course.id}/learn`}
                  className="group/title"
                >
                  <h3 className="font-semibold text-lg leading-tight group-hover/title:text-primary transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link
                        to={`/courses/${course.id}`}
                        className="cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        View Course Page
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {course.isArchived ? (
                      <DropdownMenuItem
                        onClick={onUnarchive}
                        className="cursor-pointer"
                      >
                        <ArchiveRestore className="w-4 h-4 mr-2" />
                        Restore to My Learning
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={onArchive}
                          className="cursor-pointer text-muted-foreground"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive Course
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={onUnenroll}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Unenroll
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {course.instructor.fullName}
              </p>
            </div>

            {/* Progress Section */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'font-medium',
                      isCompleted ? 'text-green-600' : 'text-foreground',
                    )}
                  >
                    {course.progress}% complete
                  </span>
                  <span className="text-muted-foreground">
                    {course.completedLessons} / {course.totalLessons} lessons
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(course.lastAccessedAt)}
                </div>
              </div>
              <Progress
                value={course.progress}
                className={cn('h-2', isCompleted && '[&>div]:bg-green-600')}
              />
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
              <Button asChild className="flex-1 md:flex-none">
                <Link to={`/courses/${course.id}/learn`}>
                  {renderActionButtonContent(isCompleted)}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton Loader
function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <Skeleton className="w-full md:w-64 h-40 md:h-36" />
          <div className="flex-1 p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty State
interface EmptyStateProps {
  tab: TabValue;
  hasSearchQuery: boolean;
}

function EmptyState({ tab, hasSearchQuery }: EmptyStateProps) {
  if (hasSearchQuery) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Search className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No courses found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          We couldn&apos;t find any courses matching your search. Try different
          keywords.
        </p>
      </div>
    );
  }

  // Helper function to get empty state config using switch for safe access
  const getEmptyStateConfig = (
    tabValue: TabValue,
  ): {
    icon: React.ElementType;
    title: string;
    description: string;
    cta?: string;
  } => {
    switch (tabValue) {
      case 'all':
        return {
          icon: BookOpen,
          title: 'Start your learning journey',
          description:
            "You haven't enrolled in any courses yet. Browse our catalog to find courses that interest you.",
          cta: 'Browse Courses',
        };
      case 'in-progress':
        return {
          icon: Play,
          title: 'No courses in progress',
          description:
            "Start a new course or continue one you've enrolled in to see it here.",
        };
      case 'completed':
        return {
          icon: GraduationCap,
          title: 'No completed courses yet',
          description:
            'Keep learning! Your completed courses will appear here once you finish them.',
        };
      case 'archived':
        return {
          icon: FolderArchive,
          title: 'No archived courses',
          description:
            'Courses you archive will appear here. You can restore them anytime.',
        };
      default:
        return {
          icon: BookOpen,
          title: 'No courses',
          description: 'No courses found.',
        };
    }
  };

  const state = getEmptyStateConfig(tab);
  const Icon = state.icon;

  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/5 flex items-center justify-center">
        <Icon className="w-10 h-10 text-primary/60" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{state.title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {state.description}
      </p>
      {state.cta && (
        <Button asChild>
          <Link to="/courses">{state.cta}</Link>
        </Button>
      )}
    </div>
  );
}

export default MyLearningPage;
