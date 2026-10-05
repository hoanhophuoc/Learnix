import { useQuery } from '@tanstack/react-query';
import {
  Users,
  BarChart3,
  BookOpen,
  Shield,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageContainer } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/features/admin/api/admin-api';
import { cn } from '@/lib/utils';

export function AdminDashboardPage() {
  const adminCards = [
    {
      title: 'User Management',
      description:
        'View, edit roles, and manage user accounts across the platform',
      icon: Users,
      href: '/admin/users',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      available: true,
    },
    {
      title: 'System Statistics',
      description: 'View platform analytics, metrics, and performance data',
      icon: BarChart3,
      href: '/admin/stats',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      available: true,
    },
    {
      title: 'Course Moderation',
      description: 'Review and approve instructor course submissions',
      icon: BookOpen,
      href: '/admin/courses',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      available: true,
    },
  ];

  /* Fetch system stats */
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getSystemStats,
    staleTime: 60000, // 1 minute
  });

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 text-white">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 text-white/80 mb-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Administration Panel</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-white/80 max-w-xl">
              Manage users, monitor system activity, and oversee platform
              operations from this central hub.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-colors duration-300 hover:-translate-y-1">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.totalUsers ?? '—'}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-colors duration-300 hover:-translate-y-1">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <BookOpen className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.totalCourses ?? '—'}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Total Courses</p>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-colors duration-300 hover:-translate-y-1">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10">
                <GraduationCap className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.totalEnrollments ?? '—'}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Total Enrollments
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Sections */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Administration Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminCards.map((card) => {
              const Icon = card.icon;

              if (!card.available) {
                return (
                  <Card
                    key={card.title}
                    className="opacity-60 cursor-not-allowed"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={cn('p-3 rounded-xl', card.iconBg)}>
                          <Icon className={cn('w-6 h-6', card.iconColor)} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      </div>
                      <CardTitle className="text-lg mt-4">
                        {card.title}
                      </CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              }

              return (
                <Link key={card.title} to={card.href}>
                  <Card className="h-full group hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-colors duration-300 hover:-translate-y-1 cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            'p-3 rounded-xl transition-transform group-hover:scale-110',
                            card.iconBg,
                          )}
                        >
                          <Icon className={cn('w-6 h-6', card.iconColor)} />
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-4 group-hover:text-primary transition-colors">
                        {card.title}
                      </CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default AdminDashboardPage;
