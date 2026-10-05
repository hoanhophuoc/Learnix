import { useState, useEffect, useRef } from 'react';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Search, BookOpen, User, Filter, X, Users, Clock } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { Link, useSearchParams } from 'react-router-dom';

import { PageContainer } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/use-auth';
import {
  coursesApi,
  type CoursesParams,
} from '@/features/courses/api/courses-api';
import { formatLastUpdated, formatStudentCount } from '@/lib/utils';

// Helper hook for debouncing if you don't have one
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function CoursesPage() {
  const { isAuthenticated, user } = useAuth();

  // Fetch enrolled courses to check status
  const { data: enrolledCourses } = useQuery({
    queryKey: ['courses', 'enrolled'],
    queryFn: () => coursesApi.getEnrolledCourses(),
    enabled: isAuthenticated,
  });

  const enrolledCourseIds = new Set(enrolledCourses?.map((c) => c.id));

  // --- Filter States ---
  const [searchParams, setSearchParams] = useSearchParams();
  // Use URL search param as initial value - controlled by URL
  const initialSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(initialSearch);

  // Sync from URL to local state when URL changes (e.g., from header search)
  // This uses a key pattern instead of useEffect to avoid setState in effect
  const urlSearchKey = searchParams.get('search') ?? '';

  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch available tags for autocomplete
  const { data: availableTags } = useQuery({
    queryKey: ['courses', 'tags'],
    queryFn: coursesApi.getTags,
  });

  // FIX: Initialize selectedTags from URL search params
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tagsParam = searchParams.get('tags');
    return tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  });

  const [sortConfig, setSortConfig] = useState<{
    sort: 'price' | 'date';
    order: 'ASC' | 'DESC';
  }>({ sort: 'date', order: 'DESC' });

  // Use URL search if available, otherwise use local search
  const effectiveSearch = urlSearchKey || search;

  // Handler to update search - clears URL param when typing in filter
  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Clear URL search param when user types in the filter input
    if (urlSearchKey) {
      setSearchParams((prev) => {
        prev.delete('search');
        return prev;
      });
    }
  };

  const debouncedSearch = useDebounceValue(effectiveSearch, 500);
  const { ref, inView } = useInView(); // Infinite scroll trigger
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    },
    [],
  );

  // --- Query Params ---
  const queryParams: CoursesParams = {
    limit: 9,
    search: debouncedSearch,
    level: selectedLevel || undefined,
    tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
    sort: sortConfig.sort,
    order: sortConfig.order,
  };

  // --- Infinite Query ---
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['courses', 'infinite', queryParams], // Key changes when filters change
      queryFn: ({ pageParam = 1 }) =>
        coursesApi.getAllCourses({ ...queryParams, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (lastPage.meta.page < lastPage.meta.totalPages) {
          return lastPage.meta.page + 1;
        }
        return undefined;
      },
    });

  // --- Load more when scrolling to bottom ---
  useEffect(() => {
    if (inView && hasNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // --- Handlers ---
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!selectedTags.includes(tagInput.trim())) {
        setSelectedTags([...selectedTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Browse Courses</h1>
            <p className="text-muted-foreground mt-1">
              Explore our wide range of professional courses
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 font-medium text-primary mb-2">
            <Filter className="w-4 h-4" />
            <span>Filters & Sorting</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Search */}
            <Input
              leftIcon={<Search className="w-4 h-4" />}
              placeholder="Search by title..."
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
            />

            {/* 2. Difficulty Select */}
            <Select
              value={selectedLevel || 'all'}
              onValueChange={(val) =>
                setSelectedLevel(val === 'all' ? '' : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            {/* 3. Sort Select */}
            <Select
              value={`${sortConfig.sort}-${sortConfig.order}`}
              onValueChange={(val) => {
                const [sort, order] = val.split('-') as [
                  'price' | 'date',
                  'ASC' | 'DESC',
                ];
                setSortConfig({ sort, order });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Newest First" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-DESC">Newest First</SelectItem>
                <SelectItem value="date-ASC">Oldest First</SelectItem>
                <SelectItem value="price-ASC">Price: Low to High</SelectItem>
                <SelectItem value="price-DESC">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            {/* 4. Tags Input */}
            <div className="relative group">
              <Input
                placeholder="Type tag & press Enter..."
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                // Delay blur to allow clicking suggestions
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => {
                    setShowSuggestions(false);
                  }, 200);
                }}
                onKeyDown={handleAddTag}
              />

              {/* Tag Suggestions Dropdown */}
              {showSuggestions && (availableTags?.length ?? 0) > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 p-1 bg-popover border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto animate-fade-in">
                  {availableTags
                    ?.filter(
                      (tag) =>
                        !selectedTags.includes(tag) &&
                        tag.toLowerCase().includes(tagInput.toLowerCase()),
                    )
                    .slice(0, 100) // Limit results for performance
                    .map((tag) => (
                      <button
                        key={tag}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-between group/item"
                        onClick={() => {
                          if (!selectedTags.includes(tag)) {
                            setSelectedTags([...selectedTags, tag]);
                          }
                          setTagInput('');
                          setShowSuggestions(false);
                        }}
                      >
                        <span className="font-medium">{tag}</span>
                        <span className="text-xs text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity">
                          Add
                        </span>
                      </button>
                    ))}

                  {/* Empty state for search */}
                  {availableTags?.filter(
                    (tag) =>
                      !selectedTags.includes(tag) &&
                      tag.toLowerCase().includes(tagInput.toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                      No matching tags found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pl-3">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs text-muted-foreground hover:text-primary underline px-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 bg-muted/30 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.pages.map((page) =>
                page.data.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="group block h-full"
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
                            {course.instructor?.fullName ??
                              course.instructor?.name ??
                              'Instructor'}
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
                              <div className="font-bold text-primary">
                                {course.price === 0
                                  ? 'Free'
                                  : `$${course.price}`}
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )),
              )}
            </div>

            {/* Infinite Scroll Trigger */}
            <div
              ref={ref}
              className="h-10 flex items-center justify-center w-full"
            >
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading more courses...</span>
                </div>
              )}
              {!hasNextPage && data && data.pages[0].data.length > 0 && (
                <span className="text-muted-foreground text-sm">
                  You&apos;ve reached the end
                </span>
              )}
              {!hasNextPage && data?.pages[0].data.length === 0 && (
                <span className="text-muted-foreground text-sm">
                  No courses found matching your criteria
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default CoursesPage;
