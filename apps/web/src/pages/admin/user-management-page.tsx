import { useState, useEffect, type ReactNode } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Shield,
  GraduationCap,
  BookOpen,
  X,
  Loader2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { createPortal } from 'react-dom';

import { PageContainer } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminApi, type User } from '@/features/admin/api/admin-api';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

// User Avatar Component with Error Handling
function UserAvatar({ user }: { user: User }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Determine initial source
    let src = user.avatarUrl;
    if (src && !src.startsWith('http')) {
      // Handle relative URLs for local uploads
      // Ensure we don't double slash
      const baseUrl = config.apiUrl.endsWith('/')
        ? config.apiUrl.slice(0, -1)
        : config.apiUrl;
      const path = src.startsWith('/') ? src : `/${src}`;
      src = `${baseUrl}${path}`;
    }

    // Set initial source, preferring dedicated avatarUrl, then oauth, then null
    const timer = setTimeout(() => {
      setImgSrc(src ?? user.oauthAvatarUrl ?? null);
      setError(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [user.avatarUrl, user.oauthAvatarUrl]);

  const handleError = () => {
    // If we're currently trying the primary avatar and failing...
    if (imgSrc !== user.oauthAvatarUrl && user.oauthAvatarUrl) {
      // Fallback to oauth url
      setImgSrc(user.oauthAvatarUrl);
    } else {
      // If we already tried oauth or there isn't one, give up
      setError(true);
    }
  };

  if (!imgSrc || error) {
    return (
      <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-semibold shrink-0 border border-border">
        {user.fullName?.charAt(0).toUpperCase() ??
          user.email.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={user.fullName ?? ''}
      className="w-12 h-12 rounded-full object-cover shrink-0 border border-border"
      onError={handleError}
    />
  );
}

// Skeleton component
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

// Helper function to get button text for status toggle
function getStatusButtonContent(
  isPending: boolean,
  isActive: boolean,
): ReactNode {
  if (isPending) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }
  return isActive ? 'Lock' : 'Unlock';
}

// Helper hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, active, locked
  const [sortFilter, setSortFilter] = useState<string>('createdAt'); // createdAt, fullName, email
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const { data: users, isLoading } = useQuery({
    queryKey: [
      'admin',
      'users',
      {
        role: roleFilter,
        status: statusFilter,
        sortBy: sortFilter,
        sortOrder,
        search: debouncedSearch,
      },
    ],
    queryFn: () =>
      adminApi.getAllUsers({
        role: roleFilter !== 'all' ? roleFilter : undefined,
        isActive:
          statusFilter === 'all' ? undefined : statusFilter === 'active',
        sortBy: sortFilter as 'createdAt' | 'fullName' | 'email',
        sortOrder,
        search: debouncedSearch || undefined,
      }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelectedUser(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'instructor':
        return BookOpen;
      default:
        return GraduationCap;
    }
  };

  const getRoleBadgeVariant = (
    role: string,
  ): 'default' | 'secondary' | 'success' | 'warning' | 'danger' => {
    if (role === 'admin') {
      return 'danger';
    }
    if (role === 'instructor') {
      return 'default';
    }
    if (role === 'student') {
      return 'success';
    }
    return 'secondary';
  };

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage user accounts and permissions
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl">
            <Users className="w-4 h-4" />
            <span>{users?.length ?? 0} users found</span>
          </div>
        </div>

        {/* Filters & Search */}
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <div className="flex gap-2">
              <Select value={sortFilter} onValueChange={setSortFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Date Created</SelectItem>
                  <SelectItem value="fullName">Name (ABC)</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() =>
                  setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
                }
                className="px-3 py-2 border rounded-md hover:bg-muted"
                title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'ASC' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader className="border-b border-border bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Users List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(() => {
              if (isLoading) {
                return (
                  <div className="divide-y divide-border">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-4 flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                );
              }
              if (users && users.length > 0) {
                return (
                  <div className="divide-y divide-border">
                    {users.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);
                      return (
                        <div
                          key={user.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/30 transition-colors"
                        >
                          {/* Avatar & Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <UserAvatar user={user} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {user.fullName ?? 'No name'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          {/* Role & Status */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={getRoleBadgeVariant(user.role)}
                              className="gap-1"
                            >
                              <RoleIcon className="w-3 h-3" />
                              {user.role}
                            </Badge>
                            <Badge
                              variant={user.isActive ? 'success' : 'danger'}
                              className="gap-1"
                            >
                              {user.isActive ? (
                                <UserCheck className="w-3 h-3" />
                              ) : (
                                <UserX className="w-3 h-3" />
                              )}
                              {user.isActive ? 'Active' : 'Locked'}
                            </Badge>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 sm:ml-auto">
                            <button
                              onClick={() => setSelectedUser(user)}
                              disabled={user.role === 'admin'}
                              className={cn(
                                'px-4 py-2 text-sm font-medium rounded-xl transition-colors shadow-sm',
                                user.role === 'admin'
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                              )}
                              title={
                                user.role === 'admin'
                                  ? 'Cannot modify admin accounts'
                                  : 'Change Role'
                              }
                            >
                              Change Role
                            </button>
                            <button
                              onClick={() => {
                                void updateStatusMutation.mutateAsync({
                                  userId: user.id,
                                  isActive: !user.isActive,
                                });
                              }}
                              disabled={
                                updateStatusMutation.isPending ||
                                user.role === 'admin'
                              }
                              className={cn(
                                'px-4 py-2 text-sm font-medium rounded-xl transition-colors shadow-sm',
                                user.role === 'admin'
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                                  : user.isActive
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : 'bg-green-600 text-white hover:bg-green-700',
                              )}
                              title={
                                user.role === 'admin'
                                  ? 'Cannot lock admin accounts'
                                  : user.isActive
                                    ? 'Lock Account'
                                    : 'Unlock Account'
                              }
                            >
                              {getStatusButtonContent(
                                updateStatusMutation.isPending,
                                user.isActive,
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-foreground">No users found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchTerm
                      ? 'Try a different search term'
                      : 'No users have registered yet'}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Role Change Modal */}
        {selectedUser &&
          createPortal(
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
              <div
                className="absolute inset-0 z-0"
                onClick={() => setSelectedUser(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSelectedUser(null);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Close modal"
              />
              <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    Change Role
                  </h2>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-6">
                  <UserAvatar user={selectedUser} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {selectedUser.fullName ?? 'No name'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      role: 'guest',
                      label: 'Guest',
                      desc: 'Limited access, view only',
                      icon: Users,
                    },
                    {
                      role: 'student',
                      label: 'Student',
                      desc: 'Can enroll in courses and take quizzes',
                      icon: GraduationCap,
                    },
                    {
                      role: 'instructor',
                      label: 'Instructor',
                      desc: 'Can create courses and quizzes',
                      icon: BookOpen,
                    },
                    {
                      role: 'admin',
                      label: 'Admin',
                      desc: 'Full platform access and control',
                      icon: Shield,
                    },
                  ].map(({ role, label, desc, icon: Icon }) => (
                    <button
                      key={role}
                      onClick={() => {
                        void updateRoleMutation.mutateAsync({
                          userId: selectedUser.id,
                          role,
                        });
                      }}
                      disabled={updateRoleMutation.isPending}
                      className={cn(
                        'w-full p-4 text-left rounded-xl border-2 transition-colors flex items-center gap-3 disabled:opacity-50',
                        selectedUser.role === role
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50',
                      )}
                    >
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          selectedUser.role === role
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                      {updateRoleMutation.isPending &&
                        selectedUser.role !== role && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="mt-6 w-full py-3 border border-border rounded-xl hover:bg-muted font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </PageContainer>
  );
}

export default UserManagementPage;
