import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Clock,
  Target,
  Users,
  Award,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Play,
  ArrowRight,
  Lightbulb,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageContainer } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/use-auth';
import {
  coursesApi,
  type EnrolledCourse,
} from '@/features/courses/api/courses-api';
import { dashboardApi } from '@/features/dashboard/api/dashboard-api';
import {
  cn,
  formatRelativeTime,
  formatLastUpdated,
  formatStudentCount,
} from '@/lib/utils';

// Helper function to get role-based welcome message
function getRoleMessage(role?: string | null): string {
  if (role === 'admin') {
    return 'Monitor platform activity and manage users from your dashboard.';
  }
  if (role === 'instructor') {
    return "Create engaging courses and track your students' progress.";
  }
  return 'Continue your learning journey and track your progress.';
}

// Helper function to get badge variant based on progress
function getProgressBadgeVariant(
  progress: number,
): 'success' | 'warning' | 'default' {
  if (progress >= 80) {
    return 'success';
  }
  if (progress >= 50) {
    return 'warning';
  }
  return 'default';
}

export function DashboardPage() {
  const { user } = useAuth();
  // All authenticated users can be learners
  const isLearner = Boolean(user);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
  });

  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['dashboard', 'progress'],
    queryFn: dashboardApi.getProgress,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: dashboardApi.getActivity,
  });

  // Fetch enrolled courses for "Continue Learning" section (all authenticated users)
  const { data: enrolledCourses, isLoading: enrolledLoading } = useQuery({
    queryKey: ['enrolled-courses', { archived: false }],
    queryFn: () => coursesApi.getEnrolledCourses({ archived: false }),
    enabled: isLearner,
  });

  // Fetch course recommendations based on enrolled course tags
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery(
    {
      queryKey: ['course-recommendations'],
      queryFn: () => coursesApi.getRecommendations(6),
      enabled: isLearner,
    },
  );

  // Get the most recently accessed in-progress course
  const continueLearningCourse: EnrolledCourse | undefined = enrolledCourses
    ?.filter((c) => c.status === 'in-progress')
    ?.sort(
      (a, b) =>
        new Date(b.lastAccessedAt).getTime() -
        new Date(a.lastAccessedAt).getTime(),
    )?.[0];

  // Card config for different stat types
  interface StatCardConfig {
    title: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    subtitle: string;
    valueKey: string;
    format?: (value: number) => string;
    trend?: string;
  }

  const getStatCards = (): StatCardConfig[] => {
    if (user?.role === 'admin') {
      return [
        {
          title: 'Total Users',
          icon: Users,
          iconBg: 'bg-blue-500/10',
          iconColor: 'text-blue-500',
          subtitle: 'Platform users',
          valueKey: 'totalUsers',
          trend:
            (stats?.newUsersCount ?? 0) > 0
              ? `+${stats?.newUsersCount}`
              : undefined,
        },
        {
          title: 'Total Courses',
          icon: BookOpen,
          iconBg: 'bg-purple-500/10',
          iconColor: 'text-purple-500',
          subtitle: 'Published courses',
          valueKey: 'totalCourses',
          trend:
            (stats?.newCoursesCount ?? 0) > 0
              ? `+${stats?.newCoursesCount}`
              : undefined,
        },
        {
          title: 'Active Students',
          icon: TrendingUp,
          iconBg: 'bg-green-500/10',
          iconColor: 'text-green-500',
          subtitle: 'Active last 7 days',
          valueKey: 'activeStudents',
        },
      ];
    }
    if (user?.role === 'instructor') {
      const newStudents = stats?.newStudentsCount ?? 0;
      return [
        {
          title: 'Your Courses',
          icon: BookOpen,
          iconBg: 'bg-purple-500/10',
          iconColor: 'text-purple-500',
          subtitle: 'Created by you',
          valueKey: 'coursesCreated',
        },
        {
          title: 'Total Students',
          icon: Users,
          iconBg: 'bg-blue-500/10',
          iconColor: 'text-blue-500',
          subtitle: 'Enrolled students',
          valueKey: 'totalStudents',
          trend: newStudents > 0 ? `+${newStudents}` : undefined,
        },
        {
          title: 'Active Learners',
          icon: TrendingUp,
          iconBg: 'bg-green-500/10',
          iconColor: 'text-green-500',
          subtitle: 'Active this week',
          valueKey: 'activeStudents',
        },
      ];
    }
    // Student
    return [
      {
        title: 'Enrolled Courses',
        icon: BookOpen,
        iconBg: 'bg-purple-500/10',
        iconColor: 'text-purple-500',
        subtitle: 'Active courses',
        valueKey: 'coursesEnrolled',
      },
      {
        title: 'Hours Learned',
        icon: Clock,
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        subtitle: 'Total study time',
        valueKey: 'hoursLearned',
      },
      {
        title: 'Avg. Score',
        icon: Target,
        iconBg: 'bg-green-500/10',
        iconColor: 'text-green-500',
        subtitle: 'Quiz performance',
        valueKey: 'averageScore',
        format: (v) => `${v}%`,
      },
    ];
  };

  const statCards = getStatCards();

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] p-8 sm:p-10 text-white shadow-2xl transition-colors duration-500 hover:shadow-primary/20">
          {/* Subtle decorative elements without washing out text */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 [clip-path:polygon(100%_0,0_0,100%_100%)]" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-2xl opacity-30" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-white/90">
              <div className="p-1 px-2 bg-white/20 rounded-full backdrop-blur-md flex items-center gap-1.5 border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  AI-Powered Learning
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight drop-shadow-md">
                Welcome back,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
                  {user?.name ?? user?.email.split('@')[0] ?? 'Learner'}
                </span>
                !
              </h1>
              <p className="text-white/90 text-lg font-medium max-w-xl leading-relaxed drop-shadow-sm">
                {getRoleMessage(user?.role)}
              </p>
            </div>
          </div>
        </div>

        {/* Continue Learning Section (All Authenticated Users) */}
        {isLearner && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Continue Learning</h2>
              </div>
              <Link
                to="/my-learning"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View all courses
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {(() => {
              if (enrolledLoading) {
                return (
                  <Card className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      <Skeleton className="w-full md:w-72 h-44" />
                      <div className="flex-1 p-6 space-y-4">
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-10 w-40" />
                      </div>
                    </div>
                  </Card>
                );
              }
              if (continueLearningCourse) {
                return (
                  <Card className="group premium-card overflow-hidden hover:shadow-xl transition-colors duration-300">
                    <div className="flex flex-col md:flex-row">
                      {/* Thumbnail */}
                      <Link
                        to={`/courses/${continueLearningCourse.id}/learn`}
                        className="relative w-full md:w-72 h-44 shrink-0 overflow-hidden"
                      >
                        {continueLearningCourse.thumbnailUrl ? (
                          <img
                            src={continueLearningCourse.thumbnailUrl}
                            alt={continueLearningCourse.title}
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                            <BookOpen className="w-16 h-16 text-primary/50" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                            <Play className="w-7 h-7 text-primary ml-1" />
                          </div>
                        </div>
                      </Link>

                      {/* Content */}
                      <div className="flex-1 p-6 flex flex-col justify-between">
                        <div>
                          <Link
                            to={`/courses/${continueLearningCourse.id}/learn`}
                          >
                            <h3 className="text-xl font-bold hover:text-primary transition-colors line-clamp-1">
                              {continueLearningCourse.title}
                            </h3>
                          </Link>
                          <p className="text-muted-foreground mt-1">
                            {continueLearningCourse.instructor.fullName}
                          </p>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {continueLearningCourse.progress}% complete
                            </span>
                            <span className="text-muted-foreground">
                              {continueLearningCourse.completedLessons} of{' '}
                              {continueLearningCourse.totalLessons} lessons
                            </span>
                          </div>
                          <Progress
                            value={continueLearningCourse.progress}
                            className="h-2"
                          />
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                          <Button asChild size="lg" className="gap-2">
                            <Link
                              to={`/courses/${continueLearningCourse.id}/learn`}
                            >
                              <Play className="w-4 h-4" />
                              Resume Learning
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link to={`/courses/${continueLearningCourse.id}`}>
                              View Course
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              }
              return (
                <Card className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-primary/60" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Start your learning journey
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Browse our catalog and enroll in a course to start learning
                  </p>
                  <Button asChild>
                    <Link to="/courses">Browse Courses</Link>
                  </Button>
                </Card>
              );
            })()}
          </div>
        )}

        {/* Course Recommendations Section */}
        {isLearner && recommendations && recommendations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-bold">Recommended for You</h2>
              </div>
              <Link
                to="/courses"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Browse all courses
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recommendationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-36 w-full" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.map(({ course, matchingTags, score }) => {
                  const isAlreadyEnrolled = enrolledCourses?.some(
                    (ec) => ec.id === course.id,
                  );

                  return (
                    <Link
                      key={course.id}
                      to={
                        isAlreadyEnrolled
                          ? `/courses/${course.id}/learn`
                          : `/courses/${course.id}`
                      }
                      className="group block h-full"
                    >
                      <Card className="h-full premium-card overflow-hidden hover:shadow-lg transition-colors duration-300 border-border/50 flex flex-col">
                        <div className="h-48 bg-linear-to-br from-primary/5 to-primary/20 relative overflow-hidden shrink-0">
                          {course.thumbnailUrl ? (
                            <img
                              src={course.thumbnailUrl}
                              alt={course.title}
                              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <BookOpen className="w-12 h-12 text-primary/20" />
                            </div>
                          )}
                          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                            <Badge className="bg-background/80 backdrop-blur text-foreground border-transparent capitalize">
                              {course.level}
                            </Badge>
                            {score > 0 && (
                              <div className="bg-yellow-500/90 backdrop-blur text-yellow-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                <Sparkles className="w-3 h-3" />
                                {score} {score === 1 ? 'match' : 'matches'}
                              </div>
                            )}
                          </div>
                        </div>

                        <CardContent className="p-5 flex flex-col flex-1">
                          <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                            {course.title}
                          </h3>
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-3 flex-1">
                            {course.description}
                          </p>

                          {/* Instructor */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <User className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              {course.instructor?.fullName ??
                                course.instructor?.name ??
                                'Instructor'}
                            </span>
                          </div>

                          {/* Stats Row */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            {course.studentCount !== undefined && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                <span>
                                  {formatStudentCount(course.studentCount)}
                                </span>
                              </div>
                            )}
                            {course.updatedAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {formatLastUpdated(course.updatedAt)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Tags & Price */}
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                            <div className="flex flex-wrap gap-1">
                              {/* Show matching tags first, then general tags */}
                              {matchingTags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                              {course.tags
                                ?.filter((t) => !matchingTags.includes(t))
                                .slice(0, Math.max(0, 2 - matchingTags.length))
                                .map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                              {isAlreadyEnrolled ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-200/50 hover:bg-green-500/20">
                                  Purchased
                                </Badge>
                              ) : (
                                <div className="font-bold text-primary">
                                  {course.price === 0
                                    ? 'Free'
                                    : `$${Number(course.price).toFixed(2)}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            const statsRecord = stats as Record<string, number> | undefined;
            const value = statsRecord?.[card.valueKey] ?? 0;
            const displayValue = card.format ? card.format(value) : value;

            return (
              <Card
                key={card.title}
                className="group premium-card hover:shadow-lg hover:shadow-primary/5 transition-colors duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={cn('p-3 rounded-xl', card.iconBg)}>
                      <Icon className={cn('w-6 h-6', card.iconColor)} />
                    </div>
                    {card.trend && (
                      <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                        <ArrowUpRight className="w-3 h-3" />
                        {card.trend}
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground">
                        {displayValue}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {card.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Overview (Show for all authenticated learners) */}
          {isLearner && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  Course Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {(() => {
                  if (progressLoading) {
                    return (
                      <div className="space-y-4">
                        {[1, 2].map((i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-2 w-full" />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (
                    progressData?.currentCourses &&
                    progressData.currentCourses.length > 0
                  ) {
                    return progressData.currentCourses.map((course) => (
                      <div key={course.id} className="space-y-3 group">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium group-hover:text-primary transition-colors">
                              {course.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {course.completedLessons} of {course.totalLessons}{' '}
                              lessons completed
                            </p>
                          </div>
                          <Badge
                            variant={getProgressBadgeVariant(course.progress)}
                            className="font-semibold"
                          >
                            {course.progress}%
                          </Badge>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                      </div>
                    ));
                  }
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">
                        No courses yet
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enroll in a course to start learning
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Activity List */}
          <Card
            className={cn('overflow-hidden', isLearner ? '' : 'lg:col-span-2')}
          >
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                if (activityLoading) {
                  return (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start gap-4">
                          <Skeleton className="w-10 h-10 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (
                  activityData?.activities &&
                  activityData.activities.length > 0
                ) {
                  return (
                    <div className="space-y-4">
                      {activityData.activities.map((activity, index) => {
                        const iconConfig: Record<
                          string,
                          { icon: React.ElementType; bg: string; color: string }
                        > = {
                          lesson_completed: {
                            icon: BookOpen,
                            bg: 'bg-green-500/10',
                            color: 'text-green-500',
                          },
                          quiz_completed: {
                            icon: Target,
                            bg: 'bg-blue-500/10',
                            color: 'text-blue-500',
                          },
                          enrollment: {
                            icon: TrendingUp,
                            bg: 'bg-purple-500/10',
                            color: 'text-purple-500',
                          },
                          course_created: {
                            icon: BookOpen,
                            bg: 'bg-blue-500/10',
                            color: 'text-blue-500',
                          },
                          student_enrolled: {
                            icon: Users,
                            bg: 'bg-green-500/10',
                            color: 'text-green-500',
                          },
                          user_registered: {
                            icon: Users,
                            bg: 'bg-blue-500/10',
                            color: 'text-blue-500',
                          },
                          course_approved: {
                            icon: Award,
                            bg: 'bg-yellow-500/10',
                            color: 'text-yellow-500',
                          },
                        };
                        const config = iconConfig[activity.type] ?? {
                          icon: Clock,
                          bg: 'bg-muted',
                          color: 'text-muted-foreground',
                        };
                        const Icon = config.icon;

                        return (
                          <div
                            key={activity.id}
                            className="flex items-start gap-4 group animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div
                              className={cn(
                                'p-2.5 rounded-xl transition-transform group-hover:scale-110',
                                config.bg,
                              )}
                            >
                              <Icon className={cn('w-4 h-4', config.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {activity.title}
                              </p>
                              {activity.course && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {activity.course}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(activity.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">
                      No activity yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your recent actions will appear here
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export default DashboardPage;
