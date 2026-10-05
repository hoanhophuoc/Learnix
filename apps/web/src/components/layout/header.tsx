import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Moon,
  Sun,
  Menu,
  X,
  Clock,
  TrendingUp,
  BookOpen,
  ArrowRight,
  Loader2,
  GraduationCap,
  LayoutDashboard,
  Library,
  Settings,
  LogOut,
  Shield,
  Users,
  BarChart3,
  ChevronDown,
  Home,
  Plus,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/contexts/use-auth';
import { coursesApi, type Course } from '@/features/courses/api/courses-api';
import { NotificationDropdown } from '@/features/notifications/components/notification-dropdown';
import { cn } from '@/lib/utils';

// Get initial theme from DOM
const getInitialTheme = () => {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark');
  }
  return false;
};

// Recent searches storage key
const RECENT_SEARCHES_KEY = 'learnix_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Get recent searches from localStorage
const getRecentSearches = (): string[] => {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) {
      return [];
    }
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
    return [];
  } catch {
    return [];
  }
};

// Save search to recent searches
const saveRecentSearch = (query: string) => {
  if (!query.trim()) {
    return;
  }
  const recent = getRecentSearches();
  const filtered = recent.filter(
    (s) => s.toLowerCase() !== query.toLowerCase(),
  );
  const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
};

// Clear recent searches
const clearRecentSearches = () => {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
};

// Navigation items for main nav
interface NavItem {
  icon: typeof Home;
  label: string;
  href: string;
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: BookOpen, label: 'Courses', href: '/courses' },
];

const authenticatedNavItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['student', 'instructor'],
  },
  {
    icon: Library,
    label: 'My Learning',
    href: '/my-learning',
    roles: ['student', 'instructor'],
  },
];

const additionalDropdownItems: NavItem[] = [
  {
    icon: BookOpen,
    label: 'Browse Courses',
    href: '/courses',
    roles: ['instructor', 'admin'],
  },
];

const instructorNavItems: NavItem[] = [
  {
    icon: BookOpen,
    label: 'My Courses',
    href: '/instructor/courses',
    roles: ['instructor'],
  },
];

const adminNavItems: NavItem[] = [
  { icon: Shield, label: 'Admin Dashboard', href: '/admin', roles: ['admin'] },
  {
    icon: Users,
    label: 'Users',
    href: '/admin/users',
    roles: ['admin'],
  },
  {
    icon: BarChart3,
    label: 'Statistics',
    href: '/admin/stats',
    roles: ['admin'],
  },
  {
    icon: BookOpen,
    label: 'Moderation',
    href: '/admin/courses',
    roles: ['admin'],
  },
];

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(getInitialTheme);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync recent searches from localStorage
  const syncRecentSearches = () => {
    const stored = getRecentSearches();
    if (JSON.stringify(stored) !== JSON.stringify(recentSearches)) {
      setRecentSearches(stored);
    }
  };

  const handleSearchFocus = () => {
    syncRecentSearches();
    setIsSearchFocused(true);
  };

  // Keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (isSearchFocused) {
          setIsSearchFocused(false);
          searchInputRef.current?.blur();
        }
        if (isUserMenuOpen) {
          setIsUserMenuOpen(false);
        }
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, isUserMenuOpen, isMobileMenuOpen]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track pathname changes to close menus on navigation
  const [currentPath, setCurrentPath] = useState(location.pathname);

  // When pathname changes, close menus (derived state pattern)
  if (location.pathname !== currentPath) {
    setCurrentPath(location.pathname);
    // Only update if menus are actually open to avoid unnecessary renders
    if (isMobileMenuOpen || isUserMenuOpen) {
      // Schedule the close for after this render
      queueMicrotask(() => {
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
      });
    }
  }

  // Fetch search suggestions
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['course-search', debouncedQuery],
    queryFn: () =>
      coursesApi.getAllCourses({ search: debouncedQuery, limit: 5 }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const suggestions = searchResults?.data ?? [];
  const showDropdown =
    isSearchFocused && (searchQuery || recentSearches.length > 0);

  // Handle search submit
  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        return;
      }
      saveRecentSearch(query);
      setRecentSearches(getRecentSearches());
      setIsSearchFocused(false);
      setSearchQuery('');
      setIsMobileSearchOpen(false);
      void navigate(`/courses?search=${encodeURIComponent(query)}`);
    },
    [navigate],
  );

  // Handle course click
  const handleCourseClick = useCallback(
    (course: Course) => {
      saveRecentSearch(course.title);
      setRecentSearches(getRecentSearches());
      setIsSearchFocused(false);
      setSearchQuery('');
      setIsMobileSearchOpen(false);
      void navigate(`/courses/${course.id}`);
    },
    [navigate],
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = suggestions.length + (searchQuery ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex === -1 || selectedIndex === suggestions.length) {
        handleSearch(searchQuery);
      } else if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        const selectedCourse = suggestions.at(selectedIndex);
        if (selectedCourse) {
          handleCourseClick(selectedCourse);
        }
      }
    }
  };

  // Clear a recent search
  const handleClearRecent = (searchToClear: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== searchToClear);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // Clear all recent searches
  const handleClearAllRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    setIsUserMenuOpen(false);
    void navigate('/');
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  };

  const isActive = (href: string, exact = false) => {
    if (exact || href === '/') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  // Filter nav items based on user role
  const getVisibleNavItems = (items: NavItem[]) =>
    items.filter(
      (item) =>
        !item.roles ||
        item.roles.length === 0 ||
        (user?.role && item.roles.includes(user.role)),
    );

  const getVisibleMainNavItems = () =>
    mainNavItems.filter((item) => {
      if (user?.role === 'instructor' && item.label === 'Courses') {
        return false;
      }
      return true;
    });

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-border">
      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div className="absolute inset-0 lg:hidden bg-background z-50 flex flex-col px-4 pt-3 gap-2 h-screen">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSearch(searchQuery);
                  }
                }}
                placeholder="Search courses..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              />
            </div>
            <button
              onClick={() => {
                setIsMobileSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Mobile search results */}
          <div className="flex-1 overflow-y-auto pb-4">
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isSearching && suggestions.length > 0 && (
              <div className="space-y-1 mt-2">
                {suggestions.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {course.title}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {course.level} •{' '}
                        {course.instructor?.fullName ?? course.instructor?.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Left: Logo & Navigation */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="p-1.5 gradient-primary rounded-xl glow-primary">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground hidden sm:block">
                Learnix
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label="Main navigation"
            >
              {/* Public Items */}
              {getVisibleMainNavItems().map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover-highlight',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}

              {/* Roles-based Primary Links */}
              {user && user.role !== 'admin' && (
                <>
                  {getVisibleNavItems(authenticatedNavItems).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover-highlight',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </>
              )}

              {/* Administration Dropdown (Desktop) */}
              {user?.role === 'admin' && (
                <div className="relative group/nav">
                  <button
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover-highlight',
                      isActive('/admin', true) ||
                        adminNavItems.some((item) =>
                          isActive(item.href, item.href === '/admin'),
                        )
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    Administration
                    <ChevronDown className="w-3 h-3 opacity-50 group-hover/nav:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute top-full left-0 pt-2 w-56 hidden group-hover/nav:block animate-in fade-in slide-in-from-top-1 duration-200 z-50">
                    <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-1.5 font-medium">
                      <p className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                        Management
                      </p>
                      {adminNavItems.map((item) => {
                        const Icon = item.icon;
                        const isDashboard = item.href === '/admin';
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                              isActive(item.href, isDashboard)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Instructor Tool Dropdown (Desktop) */}
              {user?.role === 'instructor' && (
                <div className="relative group/nav">
                  <button
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover-highlight',
                      instructorNavItems.some((item) => isActive(item.href))
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Instructor
                    <ChevronDown className="w-3 h-3 opacity-50 group-hover/nav:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute top-full left-0 pt-2 w-56 hidden group-hover/nav:block animate-in fade-in slide-in-from-top-1 duration-200 z-50">
                    <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-1.5 font-medium">
                      {instructorNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                              isActive(item.href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                      <div className="my-1.5 border-t border-border" />
                      <Link
                        to="/instructor/courses/new"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Course
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </nav>
          </div>

          {/* Center: Search (Desktop) */}
          <div
            ref={searchContainerRef}
            className="relative hidden lg:block flex-1 max-w-md mx-4"
          >
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                onFocus={handleSearchFocus}
                onKeyDown={handleKeyDown}
                placeholder="Search courses..."
                className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              />
              {isSearching ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-muted-foreground bg-background border border-border rounded-md">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Recent Searches */}
                {!searchQuery && recentSearches.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Recent Searches
                      </span>
                      <button
                        onClick={handleClearAllRecent}
                        className="text-xs text-primary hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        onClick={() => handleSearch(search)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left group"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{search}</span>
                        <X
                          className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                          onClick={(e) => handleClearRecent(search, e)}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Trending/Popular */}
                {!searchQuery && recentSearches.length === 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Popular Searches
                      </span>
                    </div>
                    {['React', 'JavaScript', 'Python', 'Machine Learning'].map(
                      (term) => (
                        <button
                          key={term}
                          onClick={() => handleSearch(term)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left"
                        >
                          <Search className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{term}</span>
                        </button>
                      ),
                    )}
                  </div>
                )}

                {/* Search Results */}
                {searchQuery && suggestions.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Courses
                      </span>
                    </div>
                    {suggestions.map((course, index) => (
                      <button
                        key={course.id}
                        onClick={() => handleCourseClick(course)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          selectedIndex === index
                            ? 'bg-primary/10'
                            : 'hover:bg-muted',
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {course.title}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {course.level} •{' '}
                            {course.instructor?.fullName ??
                              course.instructor?.name}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                    <button
                      onClick={() => handleSearch(searchQuery)}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-3 py-3 mt-1 rounded-lg text-sm font-medium text-primary transition-colors',
                        selectedIndex === suggestions.length
                          ? 'bg-primary/10'
                          : 'hover:bg-muted',
                      )}
                    >
                      See all results for &quot;{searchQuery}&quot;
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* No results */}
                {searchQuery &&
                  debouncedQuery === searchQuery &&
                  suggestions.length === 0 &&
                  !isSearching && (
                    <div className="p-6 text-center">
                      <Search className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No courses found for &quot;{searchQuery}&quot;
                      </p>
                      <button
                        onClick={() => handleSearch(searchQuery)}
                        className="mt-2 text-sm text-primary hover:underline"
                      >
                        Browse all courses
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile search button */}
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="md:hidden p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {user ? (
              /* Logged In State */
              <>
                {/* Notifications */}
                {/* Notifications */}
                <NotificationDropdown />

                {/* User Menu */}
                <div className="relative ml-2" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label="User menu"
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <UserAvatar
                      avatarUrl={user?.avatarUrl}
                      oauthAvatarUrl={user?.oauthAvatarUrl}
                      fullName={user?.fullName ?? user?.name}
                      email={user?.email}
                      alt={`${user?.fullName ?? user?.name ?? 'User'} avatar`}
                      size="sm"
                    />
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform hidden sm:block',
                        isUserMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* User Dropdown */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* User Info */}
                      <div className="p-4 border-b border-border bg-muted/30">
                        <p className="font-medium text-sm">
                          {getGreeting()},{' '}
                          {user?.fullName ??
                            user?.name ??
                            user?.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {user?.email}
                        </p>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full capitalize">
                          {user?.role ?? 'Student'}
                        </span>
                      </div>

                      {/* Navigation Items */}
                      <div className="p-2">
                        {getVisibleNavItems(authenticatedNavItems).map(
                          (item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                                  isActive(item.href)
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                )}
                              >
                                <Icon className="w-4 h-4" />
                                {item.label}
                              </Link>
                            );
                          },
                        )}

                        {/* Additional Dropdown Items */}
                        {getVisibleNavItems(additionalDropdownItems).map(
                          (item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                                  isActive(item.href)
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                )}
                              >
                                <Icon className="w-4 h-4" />
                                {item.label}
                              </Link>
                            );
                          },
                        )}

                        {/* Admin Items */}
                        {getVisibleNavItems(adminNavItems).length > 0 && (
                          <>
                            <div className="my-2 border-t border-border" />
                            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Administration
                            </p>
                            {getVisibleNavItems(adminNavItems).map((item) => {
                              const Icon = item.icon;
                              return (
                                <Link
                                  key={item.href}
                                  to={item.href}
                                  className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                                    isActive(item.href, item.href === '/admin')
                                      ? 'bg-primary/10 text-primary'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                  )}
                                >
                                  <Icon className="w-4 h-4" />
                                  {item.label}
                                </Link>
                              );
                            })}
                          </>
                        )}

                        <div className="my-2 border-t border-border" />

                        {/* Settings */}
                        <Link
                          to="/settings"
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                            isActive('/settings')
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                          )}
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>

                        {/* Logout */}
                        <button
                          onClick={() => void handleLogout()}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Guest State */
              <div className="flex items-center gap-2 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigate('/login')}
                  className="hidden sm:flex"
                >
                  Log in
                </Button>
                <Button size="sm" onClick={() => void navigate('/register')}>
                  Sign up
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl hover:bg-muted text-muted-foreground ml-1"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-border animate-in slide-in-from-top-2 duration-200">
            <nav className="p-4 space-y-1" aria-label="Mobile navigation">
              {/* Main Navigation */}
              {getVisibleMainNavItems().map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}

              {/* Authenticated Navigation */}
              {user && (
                <>
                  <div className="my-3 border-t border-border" />
                  {getVisibleNavItems(authenticatedNavItems).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}

                  {/* Additional Dropdown Items (Mobile) */}
                  {getVisibleNavItems(additionalDropdownItems).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}

                  {/* Instructor Items */}
                  {getVisibleNavItems(instructorNavItems).length > 0 && (
                    <>
                      <div className="my-3 border-t border-border" />
                      <p className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Instructor Tools
                      </p>
                      {getVisibleNavItems(instructorNavItems).map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                              isActive(item.href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            {item.label}
                          </Link>
                        );
                      })}
                      {/* ADDED: Create Course Button for Mobile */}
                      <Link
                        to="/instructor/courses/new"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-muted-foreground hover:text-primary hover:bg-primary/5"
                      >
                        <Plus className="w-5 h-5" />
                        Create Course
                      </Link>
                    </>
                  )}

                  {/* Admin Items */}
                  {getVisibleNavItems(adminNavItems).length > 0 && (
                    <>
                      <div className="my-3 border-t border-border" />
                      <p className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Administration
                      </p>
                      {getVisibleNavItems(adminNavItems).map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                              isActive(item.href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
