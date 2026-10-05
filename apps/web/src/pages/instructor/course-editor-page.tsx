import { useEffect, useState, useId } from 'react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Code,
  Save,
  Trash2,
  GripVertical,
  Pencil,
  LayoutList,
  FileQuestion,
  BrainCircuit,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { CodeEditor } from '@/components/ide/code-editor';
import { BlockEditor } from '@/components/instructor/block-editor';
import { PageContainer } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  coursesApi,
  type Course,
  type CreateCourseData,
  type Lesson,
  type CreateLessonData,
  type LessonBlock,
  type LessonResource,
  type CourseSection as Section,
} from '@/features/courses/api/courses-api';
import { LessonResources } from '@/features/courses/components/lesson-resources';
import {
  quizzesApi,
  type CreateQuestionData,
} from '@/features/quizzes/api/quizzes-api';
import { QuizGenerationModal } from '@/features/quizzes/components/quiz-generation-modal';
import { cn } from '@/lib/utils';

const DEFAULT_THUMBNAIL_URL =
  'https://placehold.co/600x400?text=Course+Thumbnail';

const courseSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  price: z.number().min(0, 'Price must be 0 or greater'),
  thumbnailUrl: z.string().optional().or(z.literal('')),
  isPublished: z.boolean().optional(),
});

const sectionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
});

const lessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  isFreePreview: z.boolean().default(false),
  durationSeconds: z.coerce.number().min(0),
  content: z.array(z.any()), // Validated by sub-components
  ideConfig: z
    .object({
      allowedLanguages: z.array(
        z.object({
          language: z.string(),
          initialCode: z.string(),
          expectedOutput: z.string().optional(),
          testCode: z.string().optional(),
        }),
      ),
      defaultLanguage: z.string(),
      instructions: z.string().optional(),
    })
    .nullable(),
});

type CourseFormData = z.infer<typeof courseSchema>;
type SectionFormData = z.infer<typeof sectionSchema>;
type LessonFormData = z.infer<typeof lessonSchema>;

export default function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const isNew = !courseId;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = searchParams.get('tab') ?? 'details';
  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    });
  };

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId ?? ''),
    enabled: !isNew,
  });

  const submitMutation = useMutation({
    mutationFn: () => coursesApi.submitForApproval(courseId ?? ''),
    onSuccess: () => {
      toast.success('Course submitted for approval');
      void queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: () => {
      toast.error('Failed to submit course');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => coursesApi.unpublishCourse(courseId ?? ''),
    onSuccess: () => {
      toast.success('Course unpublished');
      void queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      setShowUnpublishConfirm(false);
    },
    onError: () => {
      toast.error('Failed to unpublish course');
    },
  });

  if (isLoading && !isNew) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/instructor/courses')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'Create New Course' : `Edit: ${course?.title}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isNew
                ? 'Fill in the details to create your course'
                : 'Manage course content and settings'}
            </p>
          </div>
        </div>

        {!isNew && course && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              {course.status === 'published' && (
                <Badge variant="success">Published</Badge>
              )}
              {course.status === 'pending' && (
                <Badge variant="warning">Pending Approval</Badge>
              )}
              {course.status === 'rejected' && (
                <Badge variant="danger">Rejected</Badge>
              )}
              {(course.status === 'draft' || !course.status) && (
                <Badge variant="secondary">Draft</Badge>
              )}
            </div>

            {course.status === 'published' && (
              <Button
                variant="outline"
                onClick={() => setShowUnpublishConfirm(true)}
                disabled={unpublishMutation.isPending}
                className="text-orange-500 border-orange-500 hover:bg-orange-50 hover:text-orange-600 mr-2"
              >
                {unpublishMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Unpublish Course
              </Button>
            )}

            {(course.status === 'draft' ||
              course.status === 'rejected' ||
              !course.status) && (
              <Button
                variant="primary"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Submit for Approval
              </Button>
            )}

            {course.status === 'pending' && (
              <Button variant="outline" disabled>
                Awaiting Review
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="details">Course Details</TabsTrigger>
          <TabsTrigger value="curriculum" disabled={isNew}>
            Curriculum
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <CourseDetailsForm
            course={course}
            isNew={isNew}
            navigate={navigate}
            onSuccess={(newId) => {
              if (isNew && newId) {
                void navigate(
                  `/instructor/courses/${newId}/edit?tab=curriculum`,
                  {
                    replace: true,
                  },
                );
              }
            }}
          />
        </TabsContent>

        <TabsContent value="curriculum">
          {course && <CurriculumEditor course={course} />}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialogs */}
      <Dialog
        open={showSubmitConfirm}
        onOpenChange={(open) => !open && setShowSubmitConfirm(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this course for admin approval?
              You won&apos;t be able to make changes until it&apos;s reviewed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                submitMutation.mutate();
                setShowSubmitConfirm(false);
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUnpublishConfirm}
        onOpenChange={(open) => !open && setShowUnpublishConfirm(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to unpublish this course? It will revert to
              draft status and no longer be visible to students in the catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowUnpublishConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                unpublishMutation.mutate();
              }}
            >
              Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function CourseDetailsForm({
  course,
  isNew,
  navigate,
  onSuccess,
}: {
  course?: Course;
  isNew: boolean;
  navigate: ReturnType<typeof useNavigate>;
  onSuccess: (id?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(course?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Fetch available tags from API
  const { data: availableTags = [] } = useQuery({
    queryKey: ['course-tags'],
    queryFn: coursesApi.getTags,
  });

  // Filter tag suggestions based on input
  const tagSuggestions = availableTags
    .filter(
      (tag) =>
        tag.toLowerCase().includes(tagInput.toLowerCase()) &&
        !tags.includes(tag),
    )
    .slice(0, 8);

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course?.title ?? '',
      description: course?.description ?? '',
      level: course?.level ?? 'beginner',
      price: course?.price ?? 0,
      thumbnailUrl: course?.thumbnailUrl ?? '',
      isPublished: course?.isPublished ?? false,
    },
  });

  // Use useWatch instead of form.watch to support React Compiler memoization
  const watchedThumbnailUrl = useWatch({
    control: form.control,
    name: 'thumbnailUrl',
  });

  const createMutation = useMutation({
    mutationFn: coursesApi.createCourse,
    onSuccess: (data) => {
      toast.success('Course created successfully');
      onSuccess(data.id);
    },
    onError: () => {
      toast.error(
        'Unable to create course. Please check your information and try again.',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.updateCourse(course?.id ?? '', {
        title: data.title,
        description: data.description,
        level: data.level,
        price: data.price,
        tags,
        thumbnailUrl: data.thumbnailUrl?.trim()
          ? data.thumbnailUrl.trim()
          : DEFAULT_THUMBNAIL_URL,
        isPublished: data.isPublished,
      }),
    onSuccess: () => {
      toast.success('Course updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['course', course?.id] });
    },
    onError: () => {
      toast.error('Unable to save changes. Please try again.');
    },
  });

  const onSubmit = (data: CourseFormData) => {
    const cleanData: CreateCourseData = {
      title: data.title,
      description: data.description,
      level: data.level,
      price: data.price,
      tags,
      thumbnailUrl: data.thumbnailUrl?.trim()
        ? data.thumbnailUrl.trim()
        : DEFAULT_THUMBNAIL_URL,
    };

    if (isNew) {
      createMutation.mutate(cleanData);
    } else {
      updateMutation.mutate(cleanData);
    }
  };

  const handleAddTag = (tagToAdd?: string) => {
    const newTag = (tagToAdd ?? tagInput).trim();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagSuggestions.length > 0) {
        handleAddTag(tagSuggestions[0]);
      } else {
        handleAddTag();
      }
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Title, description and categorization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="course-title" className="text-sm font-medium">
                  Course Title
                </label>
                <Input
                  id="course-title"
                  {...form.register('title')}
                  placeholder="e.g. Mastering React 2024"
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="course-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>
                <textarea
                  id="course-description"
                  {...form.register('description')}
                  className="w-full min-h-[150px] p-3 rounded-xl border border-input bg-background font-sans focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="What will students learn in this course?"
                />
                {form.formState.errors.description && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="course-level" className="text-sm font-medium">
                    Level
                  </label>
                  <Controller
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger id="course-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">
                            Intermediate
                          </SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="course-price" className="text-sm font-medium">
                    Price ($)
                  </label>
                  <Input
                    id="course-price"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('price', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Course Image</CardTitle>
              <CardDescription>
                Upload a course thumbnail (16:9 ratio recommended)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUpload
                value={watchedThumbnailUrl}
                onChange={(url) => form.setValue('thumbnailUrl', url ?? '')}
                type="image"
                previewSize={280}
                placeholder="Upload course thumbnail"
              />
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  Recommended: 1280x720px or 16:9 ratio
                </p>
                <p className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  File types: JPG, PNG, WebP (max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Course Tags</CardTitle>
              <CardDescription>
                Add tags to help students find your course
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="course-tags" className="text-sm font-medium">
                  Tags
                </label>
                <div className="relative">
                  <Input
                    id="course-tags"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onKeyDown={handleTagInputKeyDown}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowTagSuggestions(false), 200);
                    }}
                    placeholder="Type to search or create tags..."
                    className="pr-20"
                  />
                  {tagInput && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                      onClick={() => handleAddTag()}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  )}

                  {showTagSuggestions &&
                    tagInput &&
                    (tagSuggestions.length > 0 || tagInput.trim()) && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                        {tagSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted sticky top-0">
                              Existing tags
                            </div>
                            {tagSuggestions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddTag(tag)}
                                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between group"
                              >
                                <span className="text-sm">{tag}</span>
                                <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                              </button>
                            ))}
                          </>
                        )}
                        {tagInput.trim() &&
                          !availableTags.includes(tagInput.trim()) && (
                            <>
                              {tagSuggestions.length > 0 && (
                                <div className="h-px bg-border" />
                              )}
                              <button
                                type="button"
                                onClick={() => handleAddTag()}
                                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between group"
                              >
                                <span className="text-sm">
                                  Create{' '}
                                  <span className="font-medium">
                                    &quot;{tagInput.trim()}&quot;
                                  </span>
                                </span>
                                <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                              </button>
                            </>
                          )}
                      </div>
                    )}
                </div>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1.5 pl-2.5 pr-1.5 py-1.5 hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-sm">{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 hover:text-destructive hover:bg-destructive/10 rounded-sm p-0.5 transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No tags added yet. Tags help students discover your course.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void navigate('/instructor/courses')}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          {isNew ? 'Create Course' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

function CurriculumEditor({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<{
    sectionId: string;
    lessonId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sectionForm = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    defaultValues: { title: '' },
  });

  const addSectionMutation = useMutation({
    mutationFn: (data: SectionFormData) =>
      coursesApi.createSection(
        course.id,
        data.title,
        (course.sections?.length ?? 0) + 1,
      ),
    onSuccess: () => {
      toast.success('Section added');
      sectionForm.reset();
      setIsAddingSection(false);
      void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: coursesApi.deleteSection,
    onSuccess: () => {
      toast.success('Section deleted');
      void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      setSectionToDelete(null);
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: coursesApi.deleteLesson,
    onSuccess: () => {
      toast.success('Lesson deleted');
      void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      setLessonToDelete(null);
    },
  });

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sections = [...(course.sections ?? [])];
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(sections, oldIndex, newIndex).map(
        (s: Section, i: number) => ({ ...s, orderIndex: i }),
      );
      const sectionIds = reordered.map((s) => s.id);

      queryClient.setQueryData(['course', course.id], {
        ...course,
        sections: reordered,
      });

      void coursesApi.reorderSections(course.id, sectionIds).catch(() => {
        toast.error('Failed to save section order');
        void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Course Curriculum</h2>
        <Button
          onClick={() => setIsAddingSection(true)}
          disabled={isAddingSection}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </Button>
      </div>

      {isAddingSection && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <form
              onSubmit={(e) =>
                void sectionForm.handleSubmit((data) =>
                  addSectionMutation.mutate(data),
                )(e)
              }
              className="flex gap-3 items-start"
            >
              <div className="flex-1">
                <Input
                  {...sectionForm.register('title')}
                  placeholder="Section Title (e.g., Introduction)"
                />
              </div>
              <Button
                size="sm"
                type="submit"
                disabled={addSectionMutation.isPending}
              >
                {addSectionMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setIsAddingSection(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <div className="space-y-4">
          <SortableContext
            items={course.sections?.map((s) => s.id) ?? []}
            strategy={verticalListSortingStrategy}
          >
            {course.sections?.map((section) => (
              <SortableSectionItem
                key={section.id}
                section={section}
                course={course}
                onDeleteSection={setSectionToDelete}
                onDeleteLesson={setLessonToDelete}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* Delete Section Dialog */}
      <Dialog
        open={Boolean(sectionToDelete)}
        onOpenChange={(open) => !open && setSectionToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this section and all its lessons?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (sectionToDelete) {
                  deleteSectionMutation.mutate(sectionToDelete);
                }
              }}
              disabled={deleteSectionMutation.isPending}
            >
              {deleteSectionMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Dialog */}
      <Dialog
        open={Boolean(lessonToDelete)}
        onOpenChange={(open) => !open && setLessonToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lesson</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lesson? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (lessonToDelete) {
                  deleteLessonMutation.mutate(lessonToDelete.lessonId);
                }
              }}
              disabled={deleteLessonMutation.isPending}
            >
              {deleteLessonMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableSectionItem({
  section,
  course,
  onDeleteSection,
  onDeleteLesson,
}: {
  section: Section;
  course: Course;
  onDeleteSection: (id: string) => void;
  onDeleteLesson: (data: { sectionId: string; lessonId: string }) => void;
}) {
  const queryClient = useQueryClient();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const lessons = [...(section.lessons ?? [])];
      const oldIndex = lessons.findIndex((l) => l.id === active.id);
      const newIndex = lessons.findIndex((l) => l.id === over.id);

      const reordered = arrayMove(lessons, oldIndex, newIndex).map(
        (l: Lesson, i: number) => ({ ...l, orderIndex: i }),
      );
      const lessonIds = reordered.map((l) => l.id);

      queryClient.setQueryData(['course', course.id], {
        ...course,
        sections: course.sections?.map((s) =>
          s.id === section.id ? { ...s, lessons: reordered } : s,
        ),
      });

      void coursesApi.reorderLessons(section.id, lessonIds).catch(() => {
        toast.error('Failed to save lesson order');
        void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('transition-colors', isDragging && 'opacity-50')}
    >
      <Card className="overflow-hidden border-border/40 hover:border-primary/30 transition-colors duration-300 shadow-sm hover:shadow-md bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-4 px-6 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between space-y-0 select-none">
          <div className="flex items-center gap-4">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground/50 hover:text-primary"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-base tracking-tight text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
                {section.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[9px] uppercase font-black bg-primary/10 text-primary border-none"
                >
                  {section.lessons?.length ?? 0} ITEMS
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AddLessonDialog
              courseId={course.id}
              sectionId={section.id}
              defaultOrderIndex={section.lessons?.length ?? 0}
            />
            <QuizCreationDialog
              sectionId={section.id}
              courseId={course.id}
              lessons={course.sections?.flatMap((s) => s.lessons) ?? []}
              defaultOrderIndex={section.lessons?.length ?? 0}
            />
            <div className="w-px h-6 bg-border/60 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteSection(section.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <SortableContext
              items={section.lessons?.map((l) => l.id) ?? []}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border/50">
                {section.lessons?.map((lesson) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    courseId={course.id}
                    sectionId={section.id}
                    onDeleteLesson={onDeleteLesson}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {(!section.lessons || section.lessons.length === 0) && (
            <div className="p-8 text-center border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                No lessons added to this section yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SortableLessonItem({
  lesson,
  courseId,
  sectionId,
  onDeleteLesson,
}: {
  lesson: Lesson;
  courseId: string;
  sectionId: string;
  onDeleteLesson: (data: { sectionId: string; lessonId: string }) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-colors',
        isDragging && 'opacity-30 bg-primary/5 shadow-inner scale-[0.98]',
      )}
    >
      <LessonItem
        lesson={lesson}
        courseId={courseId}
        sectionId={sectionId}
        dragHandleProps={{ ...attributes, ...listeners }}
        onDeleteLesson={onDeleteLesson}
      />
    </div>
  );
}

function LessonItem({
  lesson,
  courseId,
  sectionId,
  dragHandleProps,
  onDeleteLesson,
}: {
  lesson: Lesson;
  courseId: string;
  sectionId: string;
  dragHandleProps?: Record<string, unknown>;
  onDeleteLesson: (data: { sectionId: string; lessonId: string }) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="group flex items-center justify-between py-3.5 px-6 hover:bg-primary/2 transition-colors border-l-4 border-transparent hover:border-primary/60 relative overflow-hidden">
      <div className="flex items-center gap-4 flex-1 min-w-0 z-10">
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/30 group-hover:text-primary/60 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-colors duration-300 shadow-sm group-hover:shadow-md',
              (() => {
                if (lesson.type === 'quiz') {
                  return 'bg-orange-500/10 text-orange-600 border border-orange-200/50 group-hover:bg-orange-500 group-hover:text-white';
                }
                if (lesson.ideConfig) {
                  return 'bg-blue-500/10 text-blue-600 border border-blue-200/50 group-hover:bg-blue-500 group-hover:text-white';
                }
                // Default Standard
                return 'bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white';
              })(),
            )}
          >
            {(() => {
              if (lesson.type === 'quiz') {
                return <FileQuestion className="w-5 h-5" />;
              }
              if (lesson.ideConfig) {
                return <Code className="w-5 h-5" />;
              }
              return <LayoutList className="w-5 h-5" />;
            })()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate text-foreground/80 group-hover:text-foreground transition-colors">
              {lesson.title}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  'text-[9px] uppercase font-black tracking-widest',
                  (() => {
                    if (lesson.type === 'quiz') {
                      return 'text-orange-600/80';
                    }
                    if (lesson.ideConfig) {
                      return 'text-blue-600/80';
                    }
                    return 'text-primary/80';
                  })(),
                )}
              >
                {(() => {
                  if (lesson.type === 'quiz') {
                    return 'Interactive Quiz';
                  }
                  if (lesson.ideConfig) {
                    return 'Code Exercise';
                  }
                  return 'Lesson';
                })()}
              </span>
              {lesson.isFreePreview && (
                <Badge className="h-3.5 px-1 text-[8px] bg-green-500/5 text-green-600 border-green-500/20">
                  PREVIEW
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-colors duration-200 translate-x-2 group-hover:translate-x-0 z-10">
        {lesson.type === 'quiz' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg hover:bg-orange-500/10 hover:text-orange-600"
            onClick={() =>
              void navigate(
                `/instructor/courses/${courseId}/quizzes/${lesson.id}/edit`,
              )
            }
          >
            <Pencil className="w-4 h-4" />
          </Button>
        ) : (
          <AddLessonDialog
            sectionId={sectionId}
            courseId={courseId}
            existingLesson={lesson}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            }
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDeleteLesson({ sectionId, lessonId: lesson.id })}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const getDefaultCode = (lang: string) => {
  switch (lang) {
    case 'javascript':
      return `// Write your code here
function solution(a, b) {
    return a + b;
}

// Input Example:
// const n = parseInt(input());              // Read an integer
// const arr = input().split(' ').map(Number); // Read an array

print(solution(1, 2));`;

    case 'typescript':
      return `// Write your code here
function solution(a: number, b: number): number {
    return a + b;
}

// Input Example:
// const n: number = parseInt(input());              // Read an integer
// const arr: number[] = input().split(' ').map(Number); // Read an array

println(solution(1, 2));`;

    case 'python':
      return `# Write your code here
def solution(a, b):
    return a + b

if __name__ == '__main__':
    # Input Example:
    # n = int(input())              # Read an integer
    # arr = list(map(int, input().split())) # Read an array
    
    print(solution(1, 2))`;

    case 'java':
      return `// Write your code here
import java.util.*;
import java.io.*;

public class Main {
    public static int solution(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        
        // Input Example:
        // int n = scanner.nextInt();       // Read an integer
        // String s = scanner.next();       // Read a string token
        // scanner.nextLine();              // Consume newline
        
        System.out.println(solution(1, 2));
    }
}`;

    case 'cpp':
      return `// Write your code here
#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int solution(int a, int b) {
    return a + b;
}

int main() {
    // Input Example:
    // int n;
    // cin >> n;                  // Read an integer
    // string s;
    // cin >> s;                  // Read a string
    
    cout << solution(1, 2) << endl;
    return 0;
}`;

    case 'go':
      return `// Write your code here
package main

import (
    "fmt"
    "bufio"
    "os"
)

func solution(a int, b int) int {
    return a + b
}

func main() {
    // Input Example:
    // scanner := bufio.NewScanner(os.Stdin)
    // scanner.Scan()             // Read next token/line
    // input := scanner.Text()
    
    fmt.Println(solution(1, 2))
}`;

    case 'rust':
      return `// Write your code here
use std::io::{self, Read, BufRead};

fn solution(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    // Input Example:
    // let stdin = io::stdin();
    // let mut lines = stdin.lock().lines();
    // let n: i32 = lines.next().unwrap().unwrap().parse().unwrap();
    
    println!("{}", solution(1, 2));
}`;

    case 'csharp':
      return `// Write your code here
using System;
using System.Collections.Generic;
using System.Linq;

public class Program {
    public static int Solution(int a, int b) {
        return a + b;
    }

    public static void Main() {
        // Input Example:
        // string line = Console.ReadLine();      // Read a line
        // int n = int.Parse(line);               // Parse integer
        
        Console.WriteLine(Solution(1, 2));
    }
}`;

    default:
      return '';
  }
};

const getDefaultTestCode = (lang: string) => {
  switch (lang) {
    case 'javascript':
      return '// Logic Test (Concatenated to end)\nif (solution(2, 2) !== 4) throw new Error("Fail: 2+2 should be 4");\nif (solution(5, 5) !== 10) throw new Error("Fail: 5+5 should be 10");';
    case 'typescript':
      return '// Logic Test (Concatenated to end)\n// Use "import * as fs from \\"fs\\";" if you need Stdin in TS\nif (solution(2, 2) !== 4) throw new Error("Fail: 2+2 should be 4");';
    case 'python':
      return '# Logic Test (Concatenated to end)\nimport sys\ntry:\n    if solution(2, 2) != 4:\n        raise ValueError("Fail: 2+2 != 4")\n    print("All tests passed!")\nexcept Exception as e:\n    print(f"Test Failed: {e}", file=sys.stderr)\n    sys.exit(1)';
    case 'java':
      return '// Logic Test (Concatenated to end)\n// NOTE: If using this, remove main() from student initial code.\nclass TestRunner {\n    public static void main(String[] args) {\n        if (Main.solution(2, 2) != 4) {\n             System.err.println("Fail: 2+2 != 4");\n             System.exit(1);\n        }\n        System.out.println("Success!");\n    }\n}';
    case 'cpp':
      return '// Logic Test (Concatenated to end)\n// NOTE: If using this, remove main() from student initial code.\nint main() {\n    if (solution(2, 2) != 4) {\n        std::cerr << "Fail: 2+2 != 4" << std::endl;\n        return 1;\n    }\n    std::cout << "Success!" << std::endl;\n    return 0;\n}';
    case 'go':
      return '// Logic Test (Concatenated to end)\n// NOTE: Remove main() from student initial code.\nfunc main() {\n    if solution(2, 2) != 4 {\n        panic("Fail: 2+2 != 4")\n    }\n    fmt.Println("Success!")\n}';
    case 'rust':
      return '// Logic Test (Concatenated to end)\n// NOTE: Remove main() from student initial code.\nfn main() {\n    assert_eq!(solution(2, 2), 4, "Fail: 2+2 != 4");\n    println!("Success!");\n}';
    case 'csharp':
      return '// Logic Test (Concatenated to end)\n// NOTE: Remove Main() from Program class in student initial code.\npublic class TestRunner {\n    public static void Main() {\n        if (Program.Solution(2, 2) != 4) {\n            Console.Error.WriteLine("Fail: 2+2 != 4");\n            Environment.Exit(1);\n        }\n        Console.WriteLine("Success!");\n    }\n}';

    default:
      return '';
  }
};

const getDefaultExpectedOutput = (lang: string) => {
  switch (lang) {
    case 'javascript':
    case 'typescript':
    case 'python':
    case 'java':
    case 'cpp':
    case 'go':
    case 'rust':
    case 'csharp':
      return '3';

    default:
      return '';
  }
};

function AddLessonDialog({
  sectionId,
  courseId,
  existingLesson,
  trigger,
  defaultOrderIndex = 0,
}: {
  sectionId: string;
  courseId: string;
  existingLesson?: Lesson;
  trigger?: React.ReactNode;
  defaultOrderIndex?: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const checkboxId = useId();

  const form = useForm({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: existingLesson?.title ?? '',
      isFreePreview: existingLesson?.isFreePreview ?? false,
      durationSeconds: existingLesson?.durationSeconds ?? 0,
      content: existingLesson?.content ?? [],
      ideConfig: existingLesson?.ideConfig ?? null,
    },
  });

  // Use useWatch instead of form.watch to support React Compiler memoization
  const durationSeconds = useWatch({
    control: form.control,
    name: 'durationSeconds',
  });
  const durationInMinutes = Math.round((Number(durationSeconds) || 0) / 60);
  const watchedContent = useWatch({ control: form.control, name: 'content' });
  // Multi-language state
  const [enableIde, setEnableIde] = useState(
    Boolean(existingLesson?.ideConfig),
  );
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState<string>('javascript');
  const [editingLanguage, setEditingLanguage] = useState<string>('javascript');
  const [codeTemplates, setCodeTemplates] = useState<Map<string, string>>(
    new Map(),
  );
  const [expectedOutputs, setExpectedOutputs] = useState<Map<string, string>>(
    new Map(),
  );
  const [testCodes, setTestCodes] = useState<Map<string, string>>(new Map());

  // Pending resources for new/edit lessons
  const [pendingResources, setPendingResources] = useState<LessonResource[]>(
    [],
  );
  const [removedResourceIds, setRemovedResourceIds] = useState<string[]>([]);

  // Initialize state from existing lesson
  useEffect(() => {
    if (open) {
      const config = existingLesson?.ideConfig;

      form.reset({
        title: existingLesson?.title ?? '',
        isFreePreview: existingLesson?.isFreePreview ?? false,
        durationSeconds: existingLesson?.durationSeconds ?? 0,
        content: existingLesson?.content ?? [],
        ideConfig: config ?? null, // TypeScript might complain if types assumed old structure, but ignore for now
      });

      // Use setTimeout to avoid 'setState in effect' warning for synchronous updates
      const timer = setTimeout(() => {
        // Initialize resources
        setPendingResources(existingLesson?.resources ?? []);
        setRemovedResourceIds([]);

        setEnableIde(Boolean(config));

        if (config) {
          // Hydrate from existing config
          const langs = config.allowedLanguages.map((l) => l.language);
          setSelectedLanguages(langs);
          setDefaultLanguage(config.defaultLanguage);
          setEditingLanguage(config.defaultLanguage); // Start editing default

          const templates = new Map<string, string>();
          const outputs = new Map<string, string>();
          const tests = new Map<string, string>();

          config.allowedLanguages.forEach((l) => {
            templates.set(l.language, l.initialCode);
            if (l.expectedOutput) {
              outputs.set(l.language, l.expectedOutput);
            }
            if (l.unitTestCode) {
              tests.set(l.language, l.unitTestCode);
            }
          });
          setCodeTemplates(templates);
          setExpectedOutputs(outputs);
          setTestCodes(tests);
        } else {
          // Default clean state
          setSelectedLanguages(['javascript']);
          setDefaultLanguage('javascript');
          setEditingLanguage('javascript');
          setCodeTemplates(
            new Map([['javascript', getDefaultCode('javascript')]]),
          );
          setExpectedOutputs(
            new Map([['javascript', getDefaultExpectedOutput('javascript')]]),
          );
          setTestCodes(new Map());
          setPendingResources([]);
          setRemovedResourceIds([]);
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [open, existingLesson, form]);

  // Sync state to form
  useEffect(() => {
    if (enableIde) {
      const allowedLanguages = selectedLanguages.map((lang) => ({
        language: lang,
        initialCode: codeTemplates.get(lang) ?? getDefaultCode(lang),
        expectedOutput: expectedOutputs.get(lang),
        unitTestCode: testCodes.get(lang) ?? undefined,
        // Note: We don't force default test code into the value sent to DB if empty,
        // because empty means "Standard Grading". Only if user types something do we send it.
        // But the UI editor should show the template if empty so they can start typing.
      }));

      // Ensure default language is in selected
      const validDefault = selectedLanguages.includes(defaultLanguage)
        ? defaultLanguage
        : selectedLanguages[0] || 'javascript';

      if (allowedLanguages.length > 0) {
        form.setValue(
          'ideConfig',
          {
            allowedLanguages,
            defaultLanguage: validDefault,
          },
          { shouldDirty: true, shouldValidate: true },
        );
      }
    } else {
      form.setValue('ideConfig', null, { shouldDirty: true });
    }
  }, [
    enableIde,
    selectedLanguages,
    defaultLanguage,
    codeTemplates,
    expectedOutputs,
    testCodes,
    form,
  ]);

  const [isBlocksValid, setIsBlocksValid] = useState(true);

  const mutation = useMutation({
    mutationFn: async (data: CreateLessonData) => {
      let lessonId = existingLesson?.id;

      if (existingLesson) {
        await coursesApi.updateLesson(existingLesson.id, data);
      } else {
        const newLesson = await coursesApi.createLesson(sectionId, data);
        lessonId = newLesson.id;
      }

      if (!lessonId) return;

      // Handle Resource Updates
      // 1. Add new resources (those that are present in pending but not in initial existing resources, or all if new lesson)
      const initialResources = existingLesson?.resources ?? [];
      const resourcesToAdd = pendingResources.filter(
        (r) => !initialResources.some((ir) => ir.id === r.id),
      );

      // 2. Remove deleted resources
      // We use the explicit removedResourceIds list
      const resourcesToRemove = removedResourceIds;

      await Promise.all([
        ...resourcesToAdd.map((r) =>
          coursesApi.addResource(lessonId, {
            title: r.title,
            type: r.type,
            url: r.url,
            fileSize: r.fileSize,
          }),
        ),
        ...resourcesToRemove.map((rId) => coursesApi.removeResource(rId)),
      ]);

      return { id: lessonId };
    },
    onSuccess: () => {
      toast.success(`Lesson ${existingLesson ? 'updated' : 'added'}`);

      // If we have pending resources (only for new lessons), save them now
      if (!existingLesson && pendingResources.length > 0) {
        // We need the ID of the newly created lesson.
        // But mutation.data might not be easily accessible here if we don't return it or handle onSuccess data.
        // Let's rely on the fact that for createLesson, we should get the created lesson back.
        // Actually react-query onSuccess passes data as first arg.
      }

      setOpen(false);
      form.reset();
      setPendingResources([]);
      setRemovedResourceIds([]);
      void queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
  });

  const onSubmit = (data: LessonFormData) => {
    mutation.mutate({
      ...data,
      content: data.content as LessonBlock[],
      orderIndex: existingLesson?.orderIndex ?? defaultOrderIndex,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="w-4 h-4 mr-2" /> Add Lesson
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingLesson ? 'Edit Lesson' : 'Add New Lesson'}
          </DialogTitle>
          <DialogDescription>
            Build your lesson content using the block editor.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="lesson-title" className="text-sm font-medium">
                Lesson Title
              </label>
              <Input
                id="lesson-title"
                {...form.register('title')}
                placeholder="e.g. Introduction to Hooks"
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="lesson-duration" className="text-sm font-medium">
                Duration (minutes)
              </label>
              <Input
                id="lesson-duration"
                type="number"
                min="0"
                defaultValue={durationInMinutes}
                onChange={(e) => {
                  const minutes = parseInt(e.target.value) || 0;
                  form.setValue('durationSeconds', minutes * 60);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Content Builder</span>
              <span className="text-xs text-muted-foreground">
                Drag to reorder blocks
              </span>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/10 min-h-[300px]">
              <BlockEditor
                blocks={watchedContent as LessonBlock[]}
                onChange={(newBlocks: LessonBlock[]) =>
                  form.setValue('content', newBlocks, { shouldDirty: true })
                }
                onValidationChange={setIsBlocksValid}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-card">
              <div className="space-y-0.5">
                <label
                  htmlFor="enable-ide"
                  className="text-base font-semibold cursor-pointer"
                >
                  Code Exercise
                </label>
                <p className="text-sm text-muted-foreground">
                  Enable an embedded IDE for students to solve coding problems.
                </p>
              </div>
              <Switch
                id="enable-ide"
                checked={enableIde}
                onCheckedChange={setEnableIde}
              />
            </div>
            {enableIde && (
              <div className="space-y-6 p-4 border border-border rounded-xl bg-muted/20 animate-in fade-in zoom-in-95 duration-200">
                {/* Language Selection */}
                <div className="space-y-3">
                  <span className="text-sm font-medium">
                    Supported Languages
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'javascript', label: 'JavaScript' },
                      { id: 'typescript', label: 'TypeScript' },
                      { id: 'python', label: 'Python' },
                      { id: 'java', label: 'Java' },
                      { id: 'csharp', label: 'C#' },
                      { id: 'cpp', label: 'C++' },
                      { id: 'go', label: 'Go' },
                      { id: 'rust', label: 'Rust' },
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          const { id } = lang;
                          setSelectedLanguages([id]);
                          setDefaultLanguage(id);
                          setEditingLanguage(id);
                          if (!codeTemplates.has(id)) {
                            setCodeTemplates((prev) => {
                              const next = new Map(prev);
                              next.set(id, getDefaultCode(id));
                              return next;
                            });
                          }
                          if (!expectedOutputs.has(id)) {
                            setExpectedOutputs((prev) => {
                              const next = new Map(prev);
                              next.set(id, getDefaultExpectedOutput(id));
                              return next;
                            });
                          }
                          if (!testCodes.has(id)) {
                            setTestCodes((prev) => {
                              const next = new Map(prev);
                              next.set(id, getDefaultTestCode(id));
                              return next;
                            });
                          }
                        }}
                        className={cn(
                          'px-4 py-2 rounded-xl border text-sm font-bold transition-colors duration-300 flex items-center gap-2 group',
                          selectedLanguages.includes(lang.id)
                            ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105'
                            : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full transition-colors',
                            selectedLanguages.includes(lang.id)
                              ? 'bg-white animate-pulse'
                              : 'bg-muted-foreground/30 group-hover:bg-primary',
                          )}
                        />
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {selectedLanguages[0]?.substring(0, 2).toUpperCase() ??
                        'ID'}
                    </div>
                    <div>
                      <p className="text-sm font-bold capitalize">
                        {selectedLanguages[0] ?? 'Select Language'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active configuration for this lesson
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Initial Code Template ({editingLanguage})
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-primary px-2"
                      onClick={() => {
                        const newCode = getDefaultCode(editingLanguage);
                        setCodeTemplates((prev) => {
                          const next = new Map(prev);
                          next.set(editingLanguage, newCode);
                          return next;
                        });
                        toast.success(
                          `Reset ${editingLanguage} template to default`,
                        );
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reset to Default
                    </Button>
                  </div>
                  <div className="h-[300px] border border-border rounded-xl overflow-hidden">
                    <CodeEditor
                      id="template-editor"
                      language={editingLanguage}
                      initialValue={
                        codeTemplates.get(editingLanguage) ??
                        getDefaultCode(editingLanguage)
                      }
                      onChange={(value) =>
                        setCodeTemplates((prev) => {
                          const next = new Map(prev);
                          next.set(editingLanguage, value ?? '');
                          return next;
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="expected-output-input"
                      className="text-sm font-medium"
                    >
                      Expected Output (Standard Method)
                    </label>
                    <Input
                      id="expected-output-input"
                      placeholder="e.g. Hello World"
                      value={expectedOutputs.get(editingLanguage) ?? ''}
                      onChange={(e) =>
                        setExpectedOutputs((prev) => {
                          const next = new Map(prev);
                          next.set(editingLanguage, e.target.value);
                          return next;
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Matches exact string output for auto-grading{' '}
                      {editingLanguage} submissions.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-3 text-muted-foreground font-bold tracking-wider">
                        OR Advanced Grading
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-sm font-medium"
                        htmlFor="unit-test-editor"
                      >
                        Unit Test Code (Hidden)
                      </label>
                      <Badge variant="secondary" className="text-[10px]">
                        Advanced
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Appended to student code. Throw an error or exit with
                      non-zero code to fail the test. Example:{' '}
                      <code>
                        if (add(2,2) !== 4) throw new Error(&quot;Fail&quot;);
                      </code>
                    </p>
                    <div className="h-[200px] border border-border rounded-xl overflow-hidden">
                      <CodeEditor
                        id="test-editor"
                        initialValue={
                          testCodes.get(editingLanguage) ??
                          getDefaultTestCode(editingLanguage)
                        }
                        language={editingLanguage}
                        onChange={(value) =>
                          setTestCodes((prev) => {
                            const next = new Map(prev);
                            next.set(editingLanguage, value ?? '');
                            return next;
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label
              htmlFor={checkboxId}
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <input
                id={checkboxId}
                type="checkbox"
                {...form.register('isFreePreview')}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              Allow as Free Preview
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !isBlocksValid}
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Lesson
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-8">
          <LessonResources
            courseId={courseId}
            lessonId={existingLesson?.id ?? ''}
            resources={pendingResources}
            isInstructor={true}
            onAddResource={(newRes) => {
              const res: LessonResource = {
                ...newRes,
                id: crypto.randomUUID(), // Temp ID
                lessonId: existingLesson?.id ?? '',
              };
              setPendingResources([...pendingResources, res]);
            }}
            onRemoveResource={(resId) => {
              // If it's an existing resource, track it for deletion
              if (existingLesson?.resources.some((r) => r.id === resId)) {
                setRemovedResourceIds([...removedResourceIds, resId]);
              }
              // Remove from UI immediately
              setPendingResources(
                pendingResources.filter((r) => r.id !== resId),
              );
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuizCreationDialog({
  sectionId,
  courseId,
  lessons,
  defaultOrderIndex = 0,
}: {
  sectionId: string;
  courseId: string;
  lessons: { id: string; title: string; type?: 'standard' | 'quiz' }[];
  defaultOrderIndex?: number;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'choice' | 'manual' | 'ai'>('choice');
  const [manualTitle, setManualTitle] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const reset = () => {
    setMethod('choice');
    setManualTitle('');
    setIsSubmittingManual(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      return;
    }

    setIsSubmittingManual(true);
    try {
      const lesson = await coursesApi.createLesson(sectionId, {
        title: manualTitle.trim(),
        type: 'quiz',
        content: [],
        durationSeconds: 0,
        isFreePreview: false,
        orderIndex: defaultOrderIndex,
      });

      await quizzesApi.createQuiz({
        title: manualTitle.trim(),
        lessonId: lesson.id,
      });

      toast.success('Quiz added');
      setOpen(false);
      reset();
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      void navigate(
        `/instructor/courses/${courseId}/quizzes/${lesson.id}/edit`,
        {
          state: { title: manualTitle.trim() },
        },
      );
    } catch (_err: unknown) {
      toast.error('Unable to create quiz');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleAiSave = async ({
    questions,
    title,
  }: {
    questions: CreateQuestionData[];
    title: string;
  }) => {
    try {
      const quizTitle =
        title || `AI Quiz ${new Date().toISOString().slice(0, 10)}`;

      const lesson = await coursesApi.createLesson(sectionId, {
        title: quizTitle,
        type: 'quiz',
        content: [],
        durationSeconds: 0,
        isFreePreview: false,
        orderIndex: defaultOrderIndex,
      });

      await quizzesApi.createQuiz({
        title: quizTitle,
        lessonId: lesson.id,
        courseId,
        questions,
      });

      toast.success('AI Quiz Created!');
      setOpen(false);
      reset();
      void queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    } catch (_err: unknown) {
      toast.error('Failed to save AI quiz');
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            reset();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
          >
            <Plus className="w-4 h-4 mr-2" /> Quiz
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            'sm:max-w-[500px] transition-colors duration-300',
            method !== 'choice' && 'sm:max-w-[400px]',
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-primary" />
              {method === 'choice' && 'Create New Quiz'}
              {method === 'manual' && 'Manual Quiz Details'}
            </DialogTitle>
            <DialogDescription>
              {method === 'choice' && 'How would you like to create your quiz?'}
              {method === 'manual' &&
                'Set a title for your manual quiz. You can add questions later.'}
            </DialogDescription>
          </DialogHeader>

          {method === 'choice' && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                type="button"
                onClick={() => setMethod('manual')}
                className="group premium-card flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
              >
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Pencil className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1 text-foreground">
                    Manual Create
                  </h3>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Add questions and answers yourself
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('ai')}
                className="group premium-card flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors text-center"
              >
                <div className="p-3 rounded-xl bg-muted group-hover:bg-purple-500/10 group-hover:text-purple-600 transition-colors">
                  <BrainCircuit className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1 text-foreground">
                    AI Powered
                  </h3>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Generate from your lesson content
                  </p>
                </div>
              </button>
            </div>
          )}

          {method === 'manual' && (
            <form
              onSubmit={(e) => void handleManualSubmit(e)}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="quiz-title">
                  Quiz Title
                </label>
                <Input
                  id="quiz-title"
                  placeholder="e.g. JavaScript Basics Final"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setMethod('choice')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingManual || !manualTitle.trim()}
                >
                  {isSubmittingManual && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Create Quiz
                </Button>
              </DialogFooter>
            </form>
          )}

          {method === 'choice' && (
            <DialogFooter className="sm:justify-start">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <QuizGenerationModal
        isOpen={method === 'ai'}
        onClose={() => setMethod('choice')}
        courseId={courseId}
        sectionId={sectionId}
        lessons={lessons.filter((l) => l.type !== 'quiz')}
        onSave={(data) => void handleAiSave(data)}
      />
    </>
  );
}
