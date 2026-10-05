import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  User,
  Users,
  Award,
  Globe,
  Brain,
  Video,
  MessageCircle,
  Clock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/use-auth';
import { coursesApi, type Course } from '@/features/courses/api/courses-api';
import { formatLastUpdated, formatStudentCount } from '@/lib/utils';

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Fetch enrolled courses to check status
  const { data: enrolledCourses } = useQuery({
    queryKey: ['courses', 'enrolled'],
    queryFn: () => coursesApi.getEnrolledCourses(),
    enabled: isAuthenticated,
  });

  const enrolledCourseIds = new Set(enrolledCourses?.map((c) => c.id));

  const { data: response, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'latest'],
    // UPDATED: Pass object with limit and sort options
    queryFn: () =>
      coursesApi.getAllCourses({
        limit: 6,
        sort: 'date',
        order: 'DESC',
      }),
  });

  // UPDATED: Handle both legacy array response and new paginated response
  const latestCourses: Course[] | undefined = Array.isArray(response)
    ? response
    : response?.data;

  const { data: tags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['courses', 'tags'],
    queryFn: coursesApi.getTags,
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section ... (No changes here) ... */}
      <section className="relative pt-20 pb-32 overflow-hidden gradient-primary text-white">
        {/* ... hero content ... */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="text-sm font-medium">
              Revolutionizing Online Learning
            </span>
          </div>

          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight animate-fade-in"
            style={{ animationDelay: '100ms' }}
          >
            Master New Skills with <br /> AI-Powered Learning
          </h1>

          <p
            className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            Join Learnix to access interactive courses, personalized quizzes,
            and a community of learners. Start your journey today.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: '300ms' }}
          >
            <Link to="/courses">
              <Button
                size="lg"
                className="bg-white text-white hover:bg-white/90 font-bold h-14 px-8 rounded-2xl text-lg shadow-xl shadow-black/10"
              >
                Browse Courses
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link to="/register">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10 h-14 px-8 rounded-2xl text-lg border border-white/30"
                >
                  Get Started Free
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-10 bg-background -mt-16 relative z-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 bg-card rounded-3xl shadow-xl p-8 border border-border/50">
            {[
              {
                icon: Users,
                label: 'Active Students',
                value: '10k+',
                color: 'text-blue-500',
              },
              {
                icon: BookOpen,
                label: 'Total Courses',
                value: '500+',
                color: 'text-purple-500',
              },
              {
                icon: Award,
                label: 'Expert Instructors',
                value: '100+',
                color: 'text-orange-500',
              },
              {
                icon: Globe,
                label: 'Countries',
                value: '50+',
                color: 'text-green-500',
              },
            ].map((stat, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center space-y-2"
              >
                <div
                  className={`p-3 rounded-full bg-background border border-border/50 shadow-sm ${stat.color}`}
                >
                  <stat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose Learnix?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We provide a comprehensive learning ecosystem designed to help you
              achieve your goals faster and more effectively.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Quizzes',
                description:
                  'Test your knowledge with dynamically generated quizzes tailored to your learning progress.',
                color:
                  'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
              },
              {
                icon: Video,
                title: 'Interactive Lessons',
                description:
                  'Learn through high-quality video content, interactive exercises, and real-world projects.',
                color:
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
              },
              {
                icon: MessageCircle,
                title: 'Community Support',
                description:
                  'Connect with other learners and instructors to get help, share ideas, and grow together.',
                color:
                  'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="border-none shadow-lg hover:shadow-xl transition-colors duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-8 text-center">
                  <div
                    className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}
                  >
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Explore Categories</h2>
            <p className="text-muted-foreground">
              Find courses that match your interests
            </p>
          </div>

          {isLoadingTags ? (
            <div className="flex flex-wrap justify-center gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-10 w-24 bg-muted animate-pulse rounded-full"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
              {tags?.map((tag) => (
                <button
                  key={tag}
                  onClick={() => void navigate(`/courses?tags=${tag}`)}
                  className="px-6 py-3 rounded-full border border-border bg-card hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-colors duration-300 font-medium capitalize shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest Courses Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-4">Latest Courses</h2>
              <p className="text-muted-foreground">
                Fresh content added recently
              </p>
            </div>
            <Link
              to="/courses"
              className="hidden md:flex items-center text-primary font-semibold hover:gap-2 transition-colors group"
            >
              View All Courses{' '}
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoadingCourses
              ? [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-96 bg-card rounded-2xl animate-pulse"
                  />
                ))
              : latestCourses?.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="group h-full"
                  >
                    <Card className="h-full premium-card overflow-hidden hover:shadow-lg transition-colors duration-300 border-border/50 flex flex-col">
                      <div className="h-48 bg-linear-to-br from-primary/5 to-primary/20 relative overflow-hidden">
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
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-background/80 backdrop-blur text-foreground border-transparent capitalize">
                            {course.level}
                          </Badge>
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
                            {course.instructor?.fullName ?? 'Instructor'}
                          </span>
                        </div>

                        {/* Stats Row (Students & Last Updated) */}
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
                              <span>{formatLastUpdated(course.updatedAt)}</span>
                            </div>
                          )}
                        </div>

                        {/* Tags & Price */}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                          <div className="flex flex-wrap gap-1">
                            {course.tags?.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                            {(course.tags?.length ?? 0) > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{(course.tags?.length ?? 0) - 2}
                              </span>
                            )}
                          </div>
                          {(() => {
                            if (user?.id === course.instructor.id) {
                              return (
                                <Badge className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/25 border-violet-500/20 shadow-sm gap-1">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                  </span>
                                  Your Course
                                </Badge>
                              );
                            }
                            if (enrolledCourseIds.has(course.id)) {
                              return (
                                <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20 shadow-sm gap-1">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  Enrolled
                                </Badge>
                              );
                            }
                            return (
                              <span className="font-bold text-primary">
                                {course.price === 0
                                  ? 'Free'
                                  : `$${course.price}`}
                              </span>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>

          <div className="mt-12 text-center md:hidden">
            <Link to="/courses">
              <Button variant="outline" className="w-full">
                View All Courses
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
