import { useQuery } from '@tanstack/react-query';
import {
  Users,
  BookOpen,
  GraduationCap,
  TrendingUp,
  BarChart3,
  Activity,
  DollarSign,
  Award,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { PageContainer } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { adminApi } from '@/features/admin/api/admin-api';
import { cn } from '@/lib/utils';

// Skeleton component
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088FE',
  '#00C49F',
];

export function SystemStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getSystemStats,
  });

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
      description: 'Registered accounts',
    },
    {
      label: 'Total Courses',
      value: stats?.totalCourses ?? 0,
      icon: BookOpen,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      description: 'Published courses',
    },
    {
      label: 'Total Enrollments',
      value: stats?.totalEnrollments ?? 0,
      icon: GraduationCap,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      description: 'Course enrollments',
    },
  ];

  const secondaryStats = [
    {
      label: 'Avg. Completion Rate',
      value: `${stats?.avgCompletionRate ?? 0}%`,
      icon: Activity,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
    },
    {
      label: 'Active Instructors',
      value: stats?.activeInstructors ?? 0,
      icon: Award,
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-500',
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 text-white">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-white/80 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-medium">Analytics Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">System Statistics</h1>
            <p className="text-white/80 max-w-xl">
              Real-time overview of platform performance, growth trends, and
              engagement metrics.
            </p>
          </div>
        </div>

        {/* Primary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="group hover:shadow-lg hover:shadow-primary/5 transition-colors duration-300 hover:-translate-y-1 overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'p-3 rounded-xl transition-colors',
                        stat.iconBg,
                      )}
                    >
                      <Icon className={cn('w-6 h-6', stat.iconColor)} />
                    </div>
                  </div>
                  <div className="mt-4 relative z-10">
                    {isLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <p className="text-4xl font-bold text-foreground tracking-tight">
                        {stat.value}
                      </p>
                    )}
                    <p className="text-sm font-medium text-foreground mt-1">
                      {stat.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Charts Row 1: Revenue & User Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <DollarSign className="w-5 h-5" />
                Revenue Growth
              </CardTitle>
              <CardDescription>
                Cumulative revenue over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {isLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.revenueGrowth}>
                      <defs>
                        <linearGradient
                          id="colorRevenue"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#22c55e"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#22c55e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.1}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: string) =>
                          new Date(value).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        minTickGap={30}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        itemStyle={{ color: '#22c55e' }}
                        formatter={(
                          value:
                            | number
                            | string
                            | readonly (string | number)[]
                            | undefined,
                        ) => {
                          const display: number | string =
                            typeof value === 'number' ||
                            typeof value === 'string'
                              ? value
                              : 0;
                          return [`$${display}`, 'Revenue'];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#22c55e"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Growth */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <TrendingUp className="w-5 h-5" />
                User Growth
              </CardTitle>
              <CardDescription>
                New registrations over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {isLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats?.userGrowth}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.1}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: string) =>
                          new Date(value).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        minTickGap={30}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        itemStyle={{ color: '#8b5cf6' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts Row 2: Enrollments & Category Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enrollment Trends */}
          <Card className="lg:col-span-2 hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <BookOpen className="w-5 h-5" />
                Enrollment Trends
              </CardTitle>
              <CardDescription>Daily course enrollments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {isLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.enrollmentGrowth}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.1}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: string) =>
                          new Date(value).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                        minTickGap={30}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        labelFormatter={(label: React.ReactNode) => {
                          const str =
                            typeof label === 'string' ||
                            typeof label === 'number'
                              ? String(label)
                              : '';
                          return new Date(str).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          });
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="New Enrollments"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Course Levels
              </CardTitle>
              <CardDescription>Distribution by difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full flex items-center justify-center">
                {isLoading ? (
                  <Skeleton className="w-full h-full rounded-full" />
                ) : (stats?.categoryDistribution?.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(stats?.categoryDistribution ?? []).map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    No course data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {secondaryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="bg-card hover:bg-accent/5 transition-colors"
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn('p-3 rounded-full', stat.iconBg)}>
                    <Icon className={cn('w-6 h-6', stat.iconColor)} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {isLoading ? '-' : stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}

export default SystemStatsPage;
