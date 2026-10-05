import { useState, useEffect, useRef } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  FileText,
  CheckCircle,
  ChevronLeft,
  Menu,
  X,
  Loader2,
  Lock,
  Code as CodeIcon,
  CircleHelp,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
  Link,
} from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { IdePanel } from '@/components/ide/ide-panel';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/use-auth';
import { AuthRequiredModal } from '@/features/auth/components/auth-required-modal';
import {
  coursesApi,
  type Lesson,
  type LessonBlock,
  type CourseSection,
} from '@/features/courses/api/courses-api';
import { LessonResources } from '@/features/courses/components/lesson-resources';
import { quizzesApi } from '@/features/quizzes/api/quizzes-api';
import { QuizPlayer } from '@/features/quizzes/components/quiz-player';
import { cn, getYoutubeId, getVimeoId } from '@/lib/utils';
import { NotFoundPage } from '@/pages/not-found-page';

// --- Block Renderers ---

function VideoBlock({
  content,
  onComplete,
}: {
  content: string;
  onComplete?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const youtubeId = getYoutubeId(content);
  const vimeoId = getVimeoId(content);

  // Note: For YouTube/Vimeo iframes, we cannot robustly detect 'end' events
  // without using their respective heavy SDKs (YouTube IFrame API / Vimeo Player SDK).
  // For this implementation, we will trust the user's scroll for embeds,
  // or you could implement a timer-based approximation if strictly required.
  // We will trigger onComplete immediately for embeds to avoid blocking completion,
  // unless we want to force valid "watch time" which is hard with simple iframes.
  // User requested "must finish video", so for direct videos we use onEnded.
  // For embeds, we'll mark as complete when they load for now to prevent getting stuck,
  // since we can't track them.
  useEffect(() => {
    if (youtubeId || vimeoId) {
      // Simulate completion for embeds since we can't track them without SDKs
      requestAnimationFrame(() => onComplete?.());
    }
  }, [youtubeId, vimeoId, onComplete]);

  if (!content) {
    return null;
  }

  if (youtubeId) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm my-6 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          className="w-full h-full"
          title="YouTube Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm my-6 bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="w-full h-full"
          title="Vimeo Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(content);
  if (isDirectVideo) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm my-6 bg-black">
        <video
          ref={videoRef}
          controls
          className="w-full h-full"
          onEnded={() => onComplete?.()}
        >
          <source src={content} />
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Fallback for upload/generic video
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm my-6 bg-black font-medium">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        src={content}
        onEnded={() => onComplete?.()}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

function CodeBlock({
  content,
  language = 'javascript',
}: {
  content: string;
  language?: string;
}) {
  return (
    <div className="my-6 rounded-xl overflow-hidden border border-border bg-[#1e1e1e] text-white">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CodeIcon className="w-3 h-3" />
          <span className="uppercase">{language}</span>
        </div>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(content).then(() => {
              toast.success('Code copied!');
            });
          }}
          className="text-xs hover:text-white transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function ImageBlock({
  content,
  caption,
}: {
  content: string;
  caption?: string;
}) {
  const youtubeId = getYoutubeId(content);
  const vimeoId = getVimeoId(content);
  const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(content);
  const isVideo = Boolean(youtubeId ?? vimeoId ?? isDirectVideo);

  return (
    <figure className="my-8">
      {isVideo ? (
        <VideoBlock content={content} />
      ) : (
        <img
          src={content}
          alt={caption ?? 'Lesson image'}
          className="rounded-xl w-full object-contain max-h-100 border border-border shadow-sm bg-black/5"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://placehold.co/600x400?text=Invalid+Media+URL';
          }}
        />
      )}
      {caption && (
        <figcaption className="text-center text-sm text-muted-foreground mt-2 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// --- Custom Markdown Components ---
const markdownComponents = {
  h1: ({
    className,
    kids,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement> & { kids?: React.ReactNode }) => (
    <h1 className={cn('text-3xl font-bold mt-8 mb-4', className)} {...props}>
      {kids}
    </h1>
  ),
  h2: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={cn('text-2xl font-bold mt-6 mb-3', className)} {...props}>
      {children}
    </h2>
  ),
  h3: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn('text-xl font-semibold mt-4 mb-2', className)} {...props}>
      {children}
    </h3>
  ),
  p: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn('leading-7 mb-4', className)} {...props}>
      {children}
    </p>
  ),
  ul: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn('list-disc list-outside ml-6 mb-4', className)}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn('list-decimal list-outside ml-6 mb-4', className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn('mb-1', className)} {...props}>
      {children}
    </li>
  ),
  blockquote: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn('border-l-4 border-primary/30 pl-4 italic my-4', className)}
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({
    className,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className={cn(
        'text-primary underline underline-offset-4 hover:text-primary/80',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        'bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  ),
  del: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement>) => (
    <del
      className={cn('line-through text-muted-foreground/80', className)}
      {...props}
    >
      {children}
    </del>
  ),
};

// --- Main Content Renderer ---

function LessonContent({
  blocks,
  onVideoComplete,
}: {
  blocks: LessonBlock[];
  onVideoComplete: (blockId: string) => void;
}) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No content available for this lesson.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-4">
      {blocks
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((block) => {
          switch (block.type) {
            case 'text': {
              return (
                <div key={block.id} className="max-w-none my-6 text-foreground">
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkGfm]}
                  >
                    {block.content}
                  </ReactMarkdown>
                </div>
              );
            }
            case 'video': {
              return (
                <VideoBlock
                  key={block.id}
                  content={block.content}
                  onComplete={() => onVideoComplete(block.id)}
                />
              );
            }
            case 'image': {
              return (
                <ImageBlock
                  key={block.id}
                  content={block.content}
                  caption={block.metadata?.caption}
                />
              );
            }
            case 'code': {
              return (
                <CodeBlock
                  key={block.id}
                  content={block.content}
                  language={block.metadata?.language}
                />
              );
            }
            default: {
              return null;
            }
          }
        })}
    </div>
  );
}

// --- Quiz Component ---

function QuizSection({
  lessonId,
  isEnrolled,
  onComplete,
  onHasQuiz,
}: {
  lessonId: string;
  isEnrolled: boolean;
  onComplete: () => void;
  onHasQuiz: (hasQuiz: boolean) => void;
}) {
  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', 'lesson', lessonId],
    queryFn: async () => {
      try {
        return await quizzesApi.getQuizByLessonId(lessonId);
      } catch (error) {
        const err = error as { response?: { status?: number } };
        // Silence 404s for initial checks
        if (err.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(lessonId) && isEnrolled,
    retry: false,
  });

  useEffect(() => {
    if (!isLoading) {
      onHasQuiz(Boolean(quiz && quiz.questions.length > 0));
    }
  }, [quiz, isLoading, onHasQuiz]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return null;
  }

  return (
    <div className="my-10">
      <h2 className="text-2xl font-bold mb-6">Lesson Quiz</h2>
      <QuizPlayer quiz={quiz} onComplete={onComplete} />
    </div>
  );
}

// --- Main Page Component ---

export function LessonViewerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const completionTriggeredRef = useRef(false); // Prevents duplicate calls

  // Lesson Completion Restrictions
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [_hasQuiz, setHasQuiz] = useState(false);

  const lessonIdFromUrl = searchParams.get('lesson');

  const {
    data: course,
    isLoading: isLoadingCourse,
    error: courseError,
  } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourse(id),
    enabled: Boolean(id),
    retry: (failureCount: number, error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const {
    data: enrollment,
    isLoading: isLoadingEnrollment,
    isFetching: isFetchingEnrollment,
    status: enrollmentStatus,
    error: enrollmentError,
    refetch: refetchEnrollment,
  } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => coursesApi.getEnrollment(id),
    enabled: Boolean(id) && isAuthenticated,
  });

  const isEnrolled = enrollment?.isEnrolled ?? false;
  const activeLessonId =
    lessonIdFromUrl ?? course?.sections?.[0]?.lessons?.[0]?.id;

  const currentLesson: Lesson | undefined = course?.sections?.reduce<
    Lesson | undefined
  >(
    (found: Lesson | undefined, section: CourseSection) =>
      found ?? section.lessons.find((l) => l.id === activeLessonId),
    undefined,
  );

  const completedIds = enrollment?.progress?.completedLessonIds ?? [];
  const isLessonCompleted =
    currentLesson && completedIds.includes(currentLesson.id);

  // Calculate next lesson
  const allLessons =
    course?.sections?.flatMap((s: CourseSection) => s.lessons) ?? [];
  const currentIndex = allLessons.findIndex(
    (l: Lesson) => l.id === activeLessonId,
  );
  const nextLesson =
    currentIndex !== -1 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  // Identify stats about the lesson

  const isInstructor = Boolean(
    isAuthenticated && user?.id && course?.instructor?.id === user.id,
  );
  const isAdmin = Boolean(isAuthenticated && user?.role === 'admin');

  const { mutate: completeLesson, isPending: isCompletingLesson } = useMutation(
    {
      mutationFn: (variables: { lessonId: string; suppressToast?: boolean }) =>
        coursesApi.completeLesson(id, variables.lessonId),
      onSuccess: (
        _data: unknown,
        variables: { lessonId: string; suppressToast?: boolean },
      ) => {
        void queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
        if (!variables.suppressToast) {
          toast.success('Lesson completed!');
        }
      },
    },
  );

  // Reset state when lesson changes - scroll to top like Udemy
  useEffect(() => {
    // Reset quiz state via callback to avoid direct setState in effect
    const resetQuizState = () => setHasQuiz(false);
    resetQuizState();
    completionTriggeredRef.current = false;

    // Scroll content container to top with smooth animation
    // Since the layout is fixed height (h-screen), only the content container scrolls
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeLessonId]);

  // Main completion logic
  useEffect(() => {
    // Auto-completion on scroll removed per user request.
    // Lessons should only be completed manually or via code execution.
  }, []);

  // --- Handlers ---

  // --- Handlers ---

  // const checkScroll = useCallback(() => {
  //   if (scrollContainerRef.current) {
  //     const { scrollTop, scrollHeight, clientHeight } =
  //       scrollContainerRef.current;
  //     // Triggers if:
  //     // 1. User scrolled to bottom (within 50px buffer)
  //     // 2. Content is smaller than viewport (fully visible)
  //     if (
  //       scrollHeight <= clientHeight + 50 ||
  //       scrollTop + clientHeight >= scrollHeight - 50
  //     ) {
  //       setHasScrolledToBottom(true);
  //     }
  //   }
  // }, []);

  // // Check scroll on mount, resize, and content change
  // useEffect(() => {
  //   // Use requestAnimationFrame to defer the initial check, avoiding synchronous setState in effect
  //   const frameId = requestAnimationFrame(checkScroll);
  //   window.addEventListener('resize', checkScroll);
  //   return () => {
  //     cancelAnimationFrame(frameId);
  //     window.removeEventListener('resize', checkScroll);
  //   };
  // }, [checkScroll, currentLesson]);

  // // Re-check when content likely loads/renders (e.g. slight delay for images/markdown)
  // useEffect(() => {
  //   const timer = setTimeout(checkScroll, 500);
  //   return () => clearTimeout(timer);
  // }, [checkScroll, currentLesson]);

  const handleScroll = () => {
    // checkScroll();
  };

  const handleVideoComplete = (_blockId: string) => {
    // Video tracking removed
  };

  // --- Loading / Auth Checks ---

  const accessRedirectedRef = useRef(false);
  const enrollGraceAttemptsRef = useRef(0);

  // Auth/Access Redirect Logic
  useEffect(() => {
    // Wait until both course and enrollment queries have settled.
    // React Query can be in a refetching state where isLoading=false but isFetching=true.
    if (isLoadingCourse || isFetchingEnrollment) {
      return;
    }

    const isPreviewLesson = currentLesson?.isFreePreview ?? false;
    const hasCourseAccess = enrollment?.hasAccess ?? false;
    const hasAccess = hasCourseAccess || isPreviewLesson;

    if (course && !hasAccess && isAuthenticated) {
      const cameFromEnroll = Boolean(
        (location.state as { fromEnroll?: boolean } | null)?.fromEnroll,
      );

      // Enrollment can briefly lag behind after enrolling, and in some cases the
      // enrollment endpoint can return a transient 404 right after navigation or refresh.
      // Give it a few short retries before showing an error + redirecting back.
      const status = isAxiosError(enrollmentError)
        ? enrollmentError.response?.status
        : undefined;

      const shouldGraceRetry =
        cameFromEnroll ||
        (status === 404 && enrollGraceAttemptsRef.current < 2);

      // If enrollment is still not available (or transient 404), retry a few times.
      if (shouldGraceRetry && enrollGraceAttemptsRef.current < 3) {
        enrollGraceAttemptsRef.current += 1;
        const retryDelayMs = 350 * enrollGraceAttemptsRef.current;

        // Only retry if we don't already have an enrollment payload.
        if (!enrollment || status === 404) {
          const timer = setTimeout(() => {
            void refetchEnrollment();
          }, retryDelayMs);
          return () => clearTimeout(timer);
        }
      }

      // Prevent duplicate toasts/redirects in React StrictMode.
      if (accessRedirectedRef.current) {
        return;
      }
      accessRedirectedRef.current = true;

      // Only show the enroll-required toast when we are confident the user truly has no access.
      // - If we successfully fetched enrollment and hasAccess is false, user isn't allowed.
      // - If the enrollment endpoint returns 404 after grace retries, user isn't enrolled.
      const isConfirmedNotEnrolled = status === 404;
      const isConfirmedNoAccess = enrollmentStatus === 'success';

      if (isConfirmedNoAccess || isConfirmedNotEnrolled) {
        toast.error('Please enroll in this course to access lessons');
        void navigate(`/courses/${id}`, { replace: true });
      }
    }
  }, [
    isLoadingCourse,
    isFetchingEnrollment,
    course,
    isAuthenticated,
    id,
    navigate,
    location.state,
    enrollment,
    enrollmentError,
    enrollmentStatus,
    refetchEnrollment,
    currentLesson?.isFreePreview,
    isInstructor,
    isAdmin,
  ]);

  if (
    isAxiosError(courseError) &&
    (courseError.response?.status === 404 ||
      courseError.response?.status === 400)
  ) {
    return <NotFoundPage />;
  }

  if (isLoadingCourse || (isAuthenticated && isLoadingEnrollment) || !course) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPreviewLesson = currentLesson?.isFreePreview ?? false;
  const hasCourseAccess = enrollment?.hasAccess ?? false;
  const hasAccess = hasCourseAccess || isPreviewLesson;
  const shouldShowAuthModal = !hasAccess && !isAuthenticated;

  // Render
  return (
    <>
      <AuthRequiredModal
        isOpen={Boolean(shouldShowAuthModal) || showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          void navigate(`/courses/${id}`);
        }}
      />

      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Udemy-style header */}
        <header className="h-16 border-b border-border bg-zinc-900 flex items-center px-4 justify-between shrink-0 z-20">
          {/* Left: Logo */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="p-1.5 gradient-primary rounded-xl glow-primary transition-transform group-hover:scale-105">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white hidden sm:block">
                Learnix
              </span>
            </Link>
            <div className="h-6 w-px bg-zinc-700 hidden md:block" />
            {/* Course title - links to course page */}
            <Link
              to={`/courses/${id}`}
              className="font-medium text-zinc-300 hover:text-white transition-colors hidden md:flex items-center gap-2 text-sm max-w-md truncate"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="truncate">{course.title}</span>
            </Link>
          </div>

          {/* Right: Progress circle & sidebar toggle */}
          <div className="flex items-center gap-3">
            {/* Progress indicator - only show for enrolled users */}
            {isEnrolled && !isInstructor && !isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 hidden sm:block">
                  Your progress
                </span>
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-zinc-700"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${(completedIds.length / (course.sections?.reduce((acc, s) => acc + s.lessons.length, 0) ?? 1)) * 88} 88`}
                      strokeLinecap="round"
                      className="text-primary"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                    {Math.round(
                      (completedIds.length /
                        (course.sections?.reduce(
                          (acc, s) => acc + s.lessons.length,
                          0,
                        ) ?? 1)) *
                        100,
                    )}
                    %
                  </span>
                </div>
              </div>
            )}

            {/* Mobile back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate(`/courses/${id}`)}
              className="md:hidden text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Sidebar toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </header>

        {/* Main layout: Fixed sidebar on right, scrollable content on left - Udemy style */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content area - scrolls independently */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={cn(
              'flex-1 overflow-y-auto bg-background scroll-smooth',
              currentLesson?.ideConfig &&
                'grid lg:grid-cols-2 gap-0 overflow-hidden',
              // Adjust width when sidebar is open on desktop
              isSidebarOpen && 'lg:mr-0',
            )}
          >
            <div
              className={cn(
                'max-w-4xl mx-auto p-6 md:p-10 w-full transition-all duration-300',
                currentLesson?.ideConfig &&
                  'overflow-y-auto h-full max-w-none p-6',
                !isSidebarOpen && !currentLesson?.ideConfig && 'max-w-5xl', // Expand content width when sidebar is closed
              )}
            >
              {currentLesson ? (
                <>
                  <div className="mb-8 border-b border-border pb-6">
                    <h1 className="text-3xl font-bold tracking-tight mb-4">
                      {currentLesson.title}
                    </h1>
                    {isEnrolled && !isInstructor && !isAdmin && (
                      <div className="flex items-center gap-4">
                        {(() => {
                          if (currentLesson.type === 'quiz') {
                            if (isLessonCompleted) {
                              return (
                                <Button
                                  size="sm"
                                  disabled={false}
                                  variant="outline"
                                  className="text-green-700 border-green-400 bg-green-100/50 font-bold opacity-100"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2 stroke-3" />
                                  Completed
                                </Button>
                              );
                            }
                            return (
                              <Button
                                size="sm"
                                disabled
                                className="bg-orange-500 hover:bg-orange-600 text-white border-none font-bold opacity-100"
                              >
                                <Loader2 className="w-4 h-4 mr-2" />
                                Uncompleted
                              </Button>
                            );
                          }

                          // Standard/Code Lesson
                          if (isLessonCompleted) {
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-400 bg-green-100/50 font-bold opacity-100 cursor-default hover:bg-green-100/50"
                              >
                                <CheckCircle className="w-4 h-4 mr-2 stroke-3" />
                                Completed
                              </Button>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  <QuizSection
                    lessonId={currentLesson.id}
                    isEnrolled={isEnrolled || isInstructor || isAdmin}
                    onComplete={() => {
                      if (!completedIds.includes(currentLesson.id)) {
                        completeLesson({
                          lessonId: currentLesson.id,
                          suppressToast: true,
                        });
                      }
                    }}
                    onHasQuiz={setHasQuiz}
                  />

                  {currentLesson.type === 'quiz' &&
                  (currentLesson.content?.length ?? 0) === 0 ? null : (
                    <LessonContent
                      blocks={currentLesson.content}
                      onVideoComplete={handleVideoComplete}
                    />
                  )}

                  <LessonResources
                    courseId={id}
                    lessonId={currentLesson.id}
                    resources={currentLesson.resources ?? []}
                    isInstructor={false}
                  />

                  {/* Next Lesson Button */}
                  {isEnrolled && !isInstructor && !isAdmin && (
                    <div className="mt-6 mb-20 flex justify-end">
                      <Button
                        size="lg"
                        className="gap-2 font-semibold shadow-xl hover:shadow-2xl transition-all"
                        onClick={() => {
                          const handleNavigation = () => {
                            if (nextLesson) {
                              setSearchParams({ lesson: nextLesson.id });
                              // Scroll to top is handled by useEffect on activeLessonId change
                            } else {
                              toast.success('Course completed!');
                              void navigate(`/courses/${id}`);
                            }
                          };

                          // If already completed, just navigate
                          if (isLessonCompleted) {
                            handleNavigation();
                            return;
                          }

                          // If code exercise and not completed, check if it's React
                          if (currentLesson.ideConfig) {
                            const isReactExercise =
                              currentLesson.ideConfig.defaultLanguage ===
                                'react' ||
                              currentLesson.ideConfig.defaultLanguage ===
                                'javascript';
                            // React exercises can proceed (can't be auto-validated)
                            if (isReactExercise) {
                              // Mark as complete and navigate
                              completeLesson(
                                {
                                  lessonId: currentLesson.id,
                                  suppressToast: true,
                                },
                                { onSuccess: () => handleNavigation() },
                              );
                              return;
                            }
                            // Non-React code exercise must be completed to proceed
                            return;
                          }

                          // If quiz lesson, require quiz completion before navigating
                          if (currentLesson.type === 'quiz') {
                            // Quiz must be completed to proceed - button should be disabled
                            return;
                          }

                          // If standard lesson and not completed, complete then navigate
                          completeLesson(
                            { lessonId: currentLesson.id },
                            {
                              onSuccess: () => handleNavigation(),
                            },
                          );
                        }}
                        disabled={(() => {
                          if (isCompletingLesson) return true;
                          if (
                            currentLesson.type === 'quiz' &&
                            !isLessonCompleted
                          )
                            return true;
                          if (currentLesson.ideConfig) {
                            // React exercises can't be auto-validated, so always allow Next
                            const isReactExercise =
                              currentLesson.ideConfig.defaultLanguage ===
                                'react' ||
                              currentLesson.ideConfig.defaultLanguage ===
                                'javascript';
                            if (isReactExercise) return false;
                            // Non-React code exercises require completion
                            return !isLessonCompleted;
                          }
                          return false;
                        })()}
                      >
                        {isCompletingLesson && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {nextLesson ? (
                          <>
                            Next: {nextLesson.title}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Finish Course
                            <CheckCircle className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-muted-foreground">
                  Select a lesson to start learning
                </div>
              )}
            </div>

            {/* Footer - Scrollable with content, spans full width of content area */}
            {!currentLesson?.ideConfig && (
              <div className="mt-20 border-t border-border bg-card/50">
                <Footer />
              </div>
            )}

            {currentLesson?.ideConfig && (
              <div className="h-full border-l border-border bg-[#1e1e1e] overflow-hidden hidden lg:block">
                <IdePanel
                  allowedLanguages={currentLesson.ideConfig.allowedLanguages}
                  defaultLanguage={currentLesson.ideConfig.defaultLanguage}
                  lessonId={currentLesson.id}
                  onSuccess={() => {
                    if (!isLessonCompleted) {
                      completeLesson({
                        lessonId: currentLesson.id,
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Mobile backdrop overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar Navigation - Fixed position with internal scroll like Udemy */}
          <div
            className={cn(
              'w-80 bg-card border-l border-border flex flex-col shrink-0 transition-all duration-300',
              // Mobile: fixed overlay below header
              'fixed top-16 bottom-0 right-0 z-30',
              // Desktop: relative within flex container
              'lg:relative lg:top-auto lg:bottom-auto lg:z-10',
              // Animation
              isSidebarOpen
                ? 'translate-x-0'
                : 'translate-x-full lg:translate-x-0',
              // Desktop: hide completely when closed
              !isSidebarOpen && 'hidden lg:hidden',
            )}
          >
            {/* Sidebar content toggle for desktop (tabs) */}
            <div className="flex-1 flex flex-col overflow-hidden overscroll-contain">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-lg">Course Content</h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable lesson list */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {course.sections?.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="border-b border-border">
                    <div className="px-4 py-3 bg-muted/30 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
                      <p className="text-sm font-semibold text-muted-foreground">
                        Section {sectionIndex + 1}: {section.title}
                      </p>
                    </div>
                    <div className="py-1">
                      {section.lessons.map((lesson) => {
                        const isActive = lesson.id === activeLessonId;
                        const isCompleted = completedIds.includes(lesson.id);
                        const isLocked =
                          !isEnrolled &&
                          !lesson.isFreePreview &&
                          !isInstructor &&
                          !isAdmin;

                        let typeIcon = <FileText className="w-4 h-4" />;
                        let typeLabel = 'Lesson';

                        if (lesson.type === 'quiz') {
                          typeIcon = <CircleHelp className="w-4 h-4" />;
                          typeLabel = 'Quiz';
                        } else if (lesson.ideConfig) {
                          typeIcon = <CodeIcon className="w-4 h-4" />;
                          typeLabel = 'Code Exercise';
                        }

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => {
                              if (isLocked) {
                                if (!isAuthenticated) {
                                  setShowAuthModal(true);
                                } else {
                                  toast.error(
                                    'Please enroll in this course to unlock this lesson',
                                  );
                                }
                                return;
                              }
                              setSearchParams({ lesson: lesson.id });
                              if (window.innerWidth < 1024) {
                                setIsSidebarOpen(false);
                              }
                            }}
                            disabled={isLocked && isAuthenticated}
                            className={cn(
                              'w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all border-l-[3px]',
                              isActive
                                ? 'bg-primary/5 border-primary'
                                : 'border-transparent hover:bg-muted/50',
                              isLocked &&
                                'opacity-60 cursor-not-allowed bg-muted/10',
                            )}
                          >
                            <div className="shrink-0 mt-0.5">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-500 fill-green-500/20" />
                              ) : isLocked ? (
                                <Lock className="w-5 h-5 text-muted-foreground/50" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-muted" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  'text-sm font-medium leading-tight',
                                  isActive ? 'text-primary' : 'text-foreground',
                                )}
                              >
                                {lesson.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  {Math.floor(lesson.durationSeconds / 60)} min
                                </span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  {typeIcon}
                                  <span>{typeLabel}</span>
                                </span>
                                {lesson.isFreePreview && !isEnrolled && (
                                  <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded font-medium">
                                    Free
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LessonViewerPage;
