import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, ArrowRight, RefreshCcw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  quizzesApi,
  type Quiz,
  type QuizSubmission,
  type Question,
} from '../api/quizzes-api';

interface QuizPlayerProps {
  quiz: Quiz;
  onComplete?: () => void;
}

export function QuizPlayer({ quiz, onComplete }: QuizPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isRetaking, setIsRetaking] = useState(false);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const queryClient = useQueryClient();

  const questions = quiz.questions ?? [];
  const currentQuestion =
    currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
      ? questions.at(currentQuestionIndex)
      : undefined;

  const { data: submission, isLoading: isLoadingSubmission } = useQuery({
    queryKey: ['quiz-submission', quiz.id],
    queryFn: () => quizzesApi.getSubmission(quiz.id),
  });

  const saveProgressMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      quizzesApi.saveProgress(quiz.id, data),
  });

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      quizzesApi.submitQuiz(quiz.id, data),
    onSuccess: () => {
      toast.success('Quiz submitted successfully!');
      void queryClient.invalidateQueries({
        queryKey: ['quiz-submission', quiz.id],
      });
      // Force refresh notifications to show the new notification immediately
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsRetaking(false);
      if (onComplete) {
        onComplete();
      }
    },
    onError: () => {
      toast.error(
        'Unable to submit your quiz. Please check your connection and try again.',
      );
    },
  });

  // Resume quiz from saved responses if uncompleted
  if (
    submission &&
    !submission.completedAt &&
    !responsesLoaded &&
    !isLoadingSubmission &&
    !isRetaking
  ) {
    setAnswers(submission.responses || {});
    setResponsesLoaded(true);
  }

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion) {
      return;
    }
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: value,
    };
    setAnswers(newAnswers);

    // Auto-save progress
    saveProgressMutation.mutate({ [currentQuestion.id]: value });
  };

  const toggleMultiSelect = (letter: string) => {
    if (!currentQuestion) {
      return;
    }
    const current = (answers[currentQuestion.id] || '')
      .split(',')
      .filter(Boolean);
    const next = current.includes(letter)
      ? current.filter((l) => l !== letter).sort()
      : [...current, letter].sort();

    handleAnswerChange(next.join(','));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      submitMutation.mutate(answers);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setIsRetaking(true);
    setResponsesLoaded(false);
  };

  if (submission?.completedAt && !isRetaking && !isLoadingSubmission) {
    return (
      <QuizResultView
        quiz={quiz}
        submission={submission}
        onRetake={handleRetake}
      />
    );
  }

  if (questions.length === 0 || !currentQuestion) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          This quiz has no questions.
        </CardContent>
      </Card>
    );
  }

  const progress = (currentQuestionIndex / questions.length) * 100;
  const hasAnswered = Boolean(answers[currentQuestion.id]);

  return (
    <Card className="w-full max-w-3xl mx-auto premium-card bg-card/50 backdrop-blur-md overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1.5 gradient-primary" />

      <CardHeader className="space-y-4 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {quiz.title}
            </CardTitle>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {saveProgressMutation.isPending && (
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>
        <Progress
          value={progress}
          className="h-2 rounded-full overflow-hidden bg-muted/20"
        />
      </CardHeader>

      <CardContent className="space-y-8 min-h-[400px]">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {currentQuestion.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-border/60 bg-muted/20 shadow-inner group">
              <img
                src={currentQuestion.imageUrl}
                alt="Question"
                className="w-full max-h-[350px] object-contain transition-transform group-hover:scale-[1.01] duration-500"
              />
            </div>
          )}

          <div className="space-y-4">
            {currentQuestion.type === 'multi_select' && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">
                Multi-Select
              </Badge>
            )}
            <div className="text-2xl font-semibold leading-tight text-foreground/90 prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentQuestion.questionText}
              </ReactMarkdown>
            </div>
          </div>

          <div className="space-y-3">
            {(() => {
              const isShortAnswer =
                currentQuestion.type === 'short_answer' ||
                !currentQuestion.options ||
                currentQuestion.options.length === 0;

              if (isShortAnswer) {
                return (
                  <div className="space-y-4">
                    <Textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleAnswerChange(e.target.value)
                      }
                      placeholder="Type your answer here..."
                      className="min-h-[120px] text-lg font-medium bg-muted/20 border-border/60 focus:bg-background transition-all rounded-xl p-4 resize-none"
                      onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] text-muted-foreground italic">
                        Answers are case-insensitive.
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {(answers[currentQuestion.id] || '').length} characters
                      </p>
                    </div>
                  </div>
                );
              }

              if (currentQuestion.type === 'multi_select') {
                return (
                  <div className="grid gap-3">
                    {currentQuestion.options.map((option, index) => {
                      const letter = String.fromCharCode(65 + index);
                      const isChecked = (answers[currentQuestion.id] || '')
                        .split(',')
                        .includes(letter);
                      return (
                        <div
                          key={index}
                          onClick={() => toggleMultiSelect(letter)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleMultiSelect(letter);
                            }
                          }}
                          role="checkbox"
                          aria-checked={isChecked}
                          tabIndex={0}
                          className={cn(
                            'flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer group hover:scale-[1.01]',
                            isChecked
                              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                              : 'border-border/60 bg-card hover:border-primary/50 hover:bg-muted/50',
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleMultiSelect(letter)}
                            className="w-5 h-5"
                          />
                          <span className="flex-1 text-sm font-medium">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold mr-3 transition-colors border',
                                isChecked
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-secondary text-secondary-foreground border-border/50 group-hover:border-primary/50 group-hover:text-primary',
                              )}
                            >
                              {letter}
                            </span>
                            {option}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={handleAnswerChange}
                  className="grid gap-3"
                >
                  {currentQuestion.options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    const isChecked = answers[currentQuestion.id] === letter;
                    return (
                      <label
                        key={index}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer group hover:scale-[1.01]',
                          isChecked
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                            : 'border-border/60 bg-card hover:border-primary/50 hover:bg-muted/50',
                        )}
                      >
                        <RadioGroupItem
                          value={letter}
                          className="w-5 h-5 border-primary/50 text-primary"
                        />
                        <span className="flex-1 text-sm font-medium">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold mr-3 transition-colors border',
                              isChecked
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary text-secondary-foreground border-border/50 group-hover:border-primary/50 group-hover:text-primary',
                            )}
                          >
                            {letter}
                          </span>
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              );
            })()}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t border-border/40 p-8 bg-muted/10">
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
          }
          disabled={currentQuestionIndex === 0}
          className="rounded-xl px-8 h-12"
        >
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={!hasAnswered || submitMutation.isPending}
          size="lg"
          className={cn(
            'rounded-xl px-8 h-12 transition-all',
            currentQuestionIndex === questions.length - 1
              ? 'gradient-vivid text-white glow-vivid'
              : 'bg-primary',
          )}
        >
          {(() => {
            if (submitMutation.isPending) {
              return (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />{' '}
                  Submitting...
                </>
              );
            }
            if (currentQuestionIndex === questions.length - 1) {
              return 'Complete Quiz';
            }
            return (
              <>
                Next Question <ArrowRight className="ml-2 w-4 h-4" />
              </>
            );
          })()}
        </Button>
      </CardFooter>
    </Card>
  );
}

function QuizResultView({
  quiz,
  submission,
  onRetake,
}: {
  quiz: Quiz;
  submission: QuizSubmission;
  onRetake: () => void;
}) {
  const isPass = submission.percentage >= 70;

  const compareAnswers = (q: Question, studentAnswer: string) => {
    if (!studentAnswer) {
      return false;
    }

    if (q.type === 'multi_select') {
      const s = studentAnswer
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort();
      const c = q.correctAnswer
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort();
      return s.length === c.length && s.join(',') === c.join(',');
    }

    if (q.type === 'short_answer') {
      return (
        studentAnswer.trim().toLowerCase() ===
        q.correctAnswer.trim().toLowerCase()
      );
    }

    return studentAnswer.trim() === q.correctAnswer.trim();
  };

  return (
    <div className="space-y-10 w-full max-w-4xl mx-auto py-4">
      <Card
        className={cn(
          'overflow-hidden border-none shadow-2xl rounded-3xl',
          isPass
            ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5'
            : 'bg-gradient-to-br from-red-500/10 to-orange-500/5',
        )}
      >
        <CardContent className="pt-12 pb-10 text-center space-y-6">
          <div className="relative inline-flex items-center justify-center">
            <div
              className={cn(
                'absolute inset-0 blur-3xl opacity-30 h-32 w-32 mx-auto',
                isPass ? 'bg-green-500' : 'bg-red-500',
              )}
            />
            <div
              className={cn(
                'text-7xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b',
                isPass
                  ? 'from-green-600 to-emerald-900'
                  : 'from-red-600 to-orange-900',
              )}
            >
              {Math.round(submission.percentage)}%
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold">
              {isPass ? 'Excellent Work!' : 'Keep Practicing!'}
            </h3>
            <p className="text-muted-foreground font-medium">
              Score: {submission.score} / {submission.totalPoints}
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={onRetake}
              variant="outline"
              className="rounded-2xl h-12 px-8 border-2 hover:bg-background shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCcw className="mr-2 w-4 h-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-bold tracking-tight">
            Answer Breakdown
          </h3>
        </div>

        <div className="grid gap-6">
          {quiz.questions.map((question, index) => {
            const userAnswer = submission.responses[question.id] as
              string | undefined;
            const isCorrect = compareAnswers(question, userAnswer ?? '');

            return (
              <Card
                key={question.id}
                className={cn(
                  'group relative overflow-hidden transition-all duration-300 border shadow-md',
                  isCorrect
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-red-500/30 bg-red-500/5',
                )}
              >
                <CardHeader className="p-6">
                  <div className="flex justify-between items-start gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm shadow-lg shrink-0',
                            isCorrect
                              ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/40'
                              : 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/40',
                          )}
                        >
                          {index + 1}
                        </span>
                        <Badge
                          variant="secondary"
                          className="uppercase text-[9px] font-black tracking-widest py-0.5"
                        >
                          {question.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      {question.imageUrl && (
                        <div className="rounded-2xl overflow-hidden border border-border/40 bg-muted/10 max-w-lg">
                          <img
                            src={question.imageUrl}
                            alt="Question"
                            className="w-full max-h-[250px] object-contain"
                          />
                        </div>
                      )}
                      <div className="text-xl font-bold text-foreground/90 leading-snug prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {question.questionText}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {question.type === 'short_answer' ? (
                    <div className="grid gap-4">
                      <div
                        className={cn(
                          'p-4 rounded-2xl border-2 flex flex-col gap-1.5',
                          isCorrect
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-red-500/30 bg-red-500/5 text-red-900',
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                          Your Answer
                        </span>
                        <span className="font-bold">
                          {userAnswer ?? (
                            <span className="italic opacity-50">
                              No answer given
                            </span>
                          )}
                        </span>
                      </div>
                      {!isCorrect && (
                        <div className="p-4 rounded-2xl border-2 border-green-500/30 bg-green-500/5 flex flex-col gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-green-600">
                            Expected Answer
                          </span>
                          <span className="font-bold text-green-900">
                            {question.correctAnswer}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {question.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isSelected = (userAnswer ?? '')
                          .split(',')
                          .includes(letter);
                        const isTheCorrectAnswer = question.correctAnswer
                          .split(',')
                          .includes(letter);

                        let state: 'correct' | 'incorrect' | 'missed' | 'none' =
                          'none';
                        if (isTheCorrectAnswer) {
                          state = 'correct';
                        }
                        if (isSelected && !isTheCorrectAnswer) {
                          state = 'incorrect';
                        }
                        if (!isSelected && isTheCorrectAnswer) {
                          state = 'missed';
                        }

                        return (
                          <div
                            key={i}
                            className={cn(
                              'p-4 rounded-2xl border-2 transition-all flex items-center justify-between',
                              state === 'correct' &&
                                'border-green-500/50 bg-green-500/10 text-green-900',
                              state === 'incorrect' &&
                                'border-red-500/50 bg-red-500/10 text-red-900 border-dashed',
                              state === 'missed' &&
                                'border-amber-500/50 bg-amber-500/10 text-amber-900 border-dashed',
                              state === 'none' &&
                                'border-transparent bg-muted/40 opacity-70',
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className={cn(
                                  'w-7 h-7 flex items-center justify-center font-bold text-xs rounded-full shrink-0 border',
                                  state === 'correct' &&
                                    'bg-green-500 text-white border-green-600',
                                  state === 'incorrect' &&
                                    'bg-red-500 text-white border-red-600',
                                  state === 'missed' &&
                                    'bg-amber-500 text-white border-amber-600',
                                  state === 'none' &&
                                    'bg-secondary text-secondary-foreground border-border/50',
                                )}
                              >
                                {letter}
                              </span>
                              <span className="text-sm font-bold">{opt}</span>
                            </span>
                            {state === 'correct' && (
                              <Check className="w-4 h-4 stroke-[3]" />
                            )}
                            {state === 'incorrect' && (
                              <X className="w-4 h-4 stroke-[3]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.explanation && (
                    <div className="mt-6 p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                        Explanation
                      </div>
                      <div className="text-sm text-foreground/80 leading-relaxed italic prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {question.explanation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
