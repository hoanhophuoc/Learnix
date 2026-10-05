import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  Trash2,
  BrainCircuit,
  Check,
  Pencil,
  LayoutList,
  CheckCircle2,
  TypeIcon,
  ListChecks,
  SquareCheck,
  ChevronLeft,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Define schemas
const configSchema = z.object({
  lessonIds: z.array(z.string()).min(1, 'Select at least one lesson'),
  count: z.number().min(1).max(20),
  topic: z.string().optional(),
  preferredTypes: z
    .array(z.string())
    .min(1, 'Select at least one question type'),
});

type ConfigFormValues = z.infer<typeof configSchema>;

interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  type: 'multiple_choice' | 'multi_select' | 'true_false' | 'short_answer';
}

interface QuizGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  sectionId: string;
  lessons: { id: string; title: string }[];
  onSave: (data: { questions: GeneratedQuestion[]; title: string }) => void;
}

export function QuizGenerationModal({
  isOpen,
  onClose,
  courseId,
  sectionId,
  lessons,
  onSave,
}: QuizGenerationModalProps) {
  const [step, setStep] = useState<'config' | 'preview'>('config');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [title, setTitle] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      lessonIds: [],
      count: 5,
      preferredTypes: ['multiple_choice'],
    },
  });

  const selectedLessonIds = useWatch({ control, name: 'lessonIds' });
  const preferredTypes = useWatch({ control, name: 'preferredTypes' });

  const generateMutation = useMutation({
    mutationFn: async (data: ConfigFormValues) => {
      const response = await api.post(
        `/courses/${courseId}/sections/${sectionId}/generate-quiz-preview`,
        data,
      );
      return response.data as
        { title: string; questions: GeneratedQuestion[] } | GeneratedQuestion[];
    },
    onSuccess: (data) => {
      // Handle new response format { title, questions }
      if ('questions' in data && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        setTitle(data.title || '');
      } else if (Array.isArray(data)) {
        // Fallback for old API behavior
        setQuestions(data);
        setTitle('');
      }
      setStep('preview');
    },
    onError: () => {
      toast.error('Failed to generate quiz. Please try again.');
    },
  });

  const handleConfigSubmit = (data: ConfigFormValues) => {
    generateMutation.mutate(data);
  };

  const handleLessonToggle = (lessonId: string) => {
    const current = selectedLessonIds;
    const next = current.includes(lessonId)
      ? current.filter((id) => id !== lessonId)
      : [...current, lessonId];
    setValue('lessonIds', next, { shouldValidate: true });
  };

  const handleQuestionChange = <K extends keyof GeneratedQuestion>(
    index: number,
    field: K,
    value: GeneratedQuestion[K],
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const handleOptionChange = (
    qIndex: number,
    oIndex: number,
    value: string,
  ) => {
    setQuestions((prev) =>
      prev.map((q, qi) =>
        qi === qIndex
          ? {
              ...q,
              options: q.options.map((opt, oi) =>
                oi === oIndex ? value : opt,
              ),
            }
          : q,
      ),
    );
  };

  const toggleMultiSelectCorrect = (qIndex: number, letter: string) => {
    const q = questions.find((_, i) => i === qIndex);
    if (q?.type !== 'multi_select') {
      return;
    }

    const correct = q.correctAnswer.split(',').filter(Boolean);
    const next = correct.includes(letter)
      ? correct.filter((l) => l !== letter).sort()
      : [...correct, letter].sort();

    handleQuestionChange(qIndex, 'correctAnswer', next.join(','));
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const finalQuestions = questions.map((q) => ({
      questionText: q.questionText,
      options:
        q.type === 'short_answer'
          ? []
          : q.options.map((o) => o.replace(/^[A-D]:\s*/, '')),
      correctAnswer: q.correctAnswer, // Already stored as letters (A, B, or A,C) in local state
      explanation: q.explanation,
      type: q.type,
      position: 0,
    }));

    onSave({ questions: finalQuestions, title });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={step !== 'preview'}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          'flex flex-col gap-0 p-0 overflow-hidden bg-background transition-colors duration-300',
          step === 'preview'
            ? 'fixed inset-0 w-screen h-screen !max-w-none !max-h-none !rounded-none !border-none !shadow-none top-0 left-0 translate-x-0 translate-y-0 z-[100] m-0'
            : 'max-w-7xl max-h-[95vh] h-[95vh] rounded-3xl shadow-2xl',
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 -z-10 pointer-events-none" />

        {step === 'config' && (
          <DialogHeader className="p-8 pb-6 border-b border-border/40 bg-card/40 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 glow-vivid animate-float shrink-0">
                <BrainCircuit className="w-9 h-9" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
                  AI Quiz Engineer
                </DialogTitle>
                <DialogDescription className="text-base font-medium text-muted-foreground mt-1">
                  Configure the parameters for your intelligent assessment.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        )}

        <div className="flex-1 overflow-hidden flex flex-col bg-background/50">
          {step === 'config' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <form
                id="config-form"
                onSubmit={(e) => void handleSubmit(handleConfigSubmit)(e)}
                className="max-w-4xl mx-auto space-y-10"
              >
                {/* Question Types */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold">
                      1. Question Formats
                    </Label>
                    <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest bg-muted/50 px-3 py-1 rounded-full">
                      Select types
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      {
                        id: 'multiple_choice',
                        label: 'Single Choice',
                        icon: LayoutList,
                      },
                      {
                        id: 'multi_select',
                        label: 'Multi-Select',
                        icon: SquareCheck,
                      },
                      {
                        id: 'true_false',
                        label: 'True / False',
                        icon: CheckCircle2,
                      },
                      {
                        id: 'short_answer',
                        label: 'Short Answer',
                        icon: TypeIcon,
                      },
                    ].map((type) => {
                      const isSelected = preferredTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            const next = isSelected
                              ? preferredTypes.filter((t) => t !== type.id)
                              : [...preferredTypes, type.id];
                            setValue('preferredTypes', next, {
                              shouldValidate: true,
                            });
                          }}
                          className={cn(
                            'flex flex-col items-center justify-center gap-3 p-6 h-auto min-h-[120px] rounded-3xl border-2 transition-colors duration-300 group relative overflow-hidden',
                            isSelected
                              ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-lg shadow-violet-500/10'
                              : 'border-border bg-card hover:border-violet-500/30 hover:bg-muted/50',
                          )}
                        >
                          <div
                            className={cn(
                              'p-3 rounded-2xl transition-colors',
                              isSelected
                                ? 'bg-violet-500 text-white'
                                : 'bg-muted text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-500',
                            )}
                          >
                            <type.icon className="w-6 h-6 shrink-0" />
                          </div>
                          <span
                            className={cn(
                              'text-sm font-bold text-center leading-tight',
                              isSelected
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          >
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.preferredTypes && (
                    <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {errors.preferredTypes.message}
                    </p>
                  )}
                </div>

                {/* Source Selection */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold">
                      2. Source Material
                    </Label>
                    <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest bg-muted/50 px-3 py-1 rounded-full">
                      Select lessons
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                    {lessons.length === 0 && (
                      <div className="col-span-2 py-12 text-center border-2 border-dashed border-muted rounded-3xl bg-muted/5">
                        <p className="text-muted-foreground">
                          No lessons available in this section.
                        </p>
                      </div>
                    )}
                    {lessons.map((lesson) => {
                      const isSelected = selectedLessonIds.includes(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => handleLessonToggle(lesson.id)}
                          className={cn(
                            'flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left group hover:scale-[1.01] active:scale-[0.99]',
                            isSelected
                              ? 'border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5'
                              : 'border-border bg-card hover:border-violet-500/30 hover:bg-muted/50',
                          )}
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0',
                              isSelected
                                ? 'bg-violet-500 border-violet-500 text-white'
                                : 'border-muted-foreground/30 group-hover:border-violet-500/50',
                            )}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-sm font-semibold transition-colors line-clamp-2',
                              isSelected
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          >
                            {lesson.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.lessonIds && (
                    <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {errors.lessonIds.message}
                    </p>
                  )}
                </div>

                {/* Bottom Config */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-8 border-t border-border">
                  <div className="space-y-3 md:col-span-1">
                    <Label className="text-lg font-bold text-center block">
                      Count
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...register('count', { valueAsNumber: true })}
                        className="w-full h-14 font-bold text-2xl text-center rounded-2xl border-2 bg-background focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-colors font-mono"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium text-center">
                      5-10 recommended
                    </p>
                    {errors.count && (
                      <p className="text-xs text-red-400 text-center font-bold">
                        {errors.count.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3 md:col-span-3">
                    <Label className="text-lg font-bold">Concept Focus</Label>
                    <Input
                      placeholder="e.g. React Hooks, useEffect..."
                      {...register('topic')}
                      className="h-14 rounded-2xl border-2 px-5 text-lg bg-background focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <BrainCircuit className="w-3 h-3" />
                      Optional: Guide the AI to prioritize specific topics.
                    </p>
                  </div>
                </div>
              </form>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 overflow-y-auto pr-2 bg-muted/5 custom-scrollbar">
              <div className="max-w-6xl w-full mx-auto py-10 px-6 space-y-10">
                {/* Header Section */}
                <div className="space-y-4 text-center">
                  <Badge
                    variant="secondary"
                    className="py-1 px-4 rounded-full border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md"
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    Review Generated Content
                  </Badge>
                  <div className="relative flex justify-center w-full">
                    <textarea
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter quiz title"
                      rows={1}
                      className="w-full text-4xl md:text-5xl font-black text-center bg-transparent border-none focus:outline-none focus:ring-0 resize-none overflow-hidden placeholder:text-muted-foreground/20 leading-tight py-2"
                      style={{ height: 'auto' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={() => {
                        setTitle((prev) => prev.trim());
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                    />
                    <Pencil className="w-6 h-6 text-muted-foreground/20 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none hidden md:block" />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center justify-between pb-4 border-b border-border/40">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <ListChecks className="w-6 h-6 text-violet-500" />
                      Generated Questions
                    </h3>
                    <Badge className="rounded-full bg-violet-500/10 text-violet-400 border-violet-500/20 px-3">
                      {questions.length} Total
                    </Badge>
                  </div>

                  {questions.map((q, qIndex) => (
                    <Card
                      key={qIndex}
                      className="group border-0 bg-card/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-colors duration-300 ring-1 ring-white/5 overflow-visible"
                    >
                      <div className="absolute -left-1 top-4 bottom-4 w-1 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-l-full opacity-60 group-hover:opacity-100 transition-opacity" />

                      <CardContent className="p-8 space-y-8">
                        {/* Question Text */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-violet-500/10 text-violet-400 text-xs font-bold uppercase tracking-wider">
                              Question {qIndex + 1}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                {q.type.replace('_', ' ')}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive rounded-full p-0 transition-colors"
                                onClick={() => removeQuestion(qIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            value={q.questionText}
                            onChange={(e) =>
                              handleQuestionChange(
                                qIndex,
                                'questionText',
                                e.target.value,
                              )
                            }
                            className="text-xl md:text-2xl font-semibold bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[60px] leading-relaxed select-text placeholder:text-muted-foreground/20 overflow-hidden"
                            placeholder="Type your question here..."
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                          />
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 gap-4">
                          {q.type !== 'short_answer' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                              {q.options.map((opt, oIndex) => {
                                const letter =
                                  (['A', 'B', 'C', 'D'] as const).find(
                                    (_, i) => i === oIndex,
                                  ) ?? 'A';
                                const correctLetters =
                                  q.correctAnswer.split(',');
                                const isCorrect = correctLetters.includes(
                                  letter ?? '',
                                );
                                return (
                                  <div
                                    key={oIndex}
                                    className={cn(
                                      'group/option relative flex items-start gap-4 p-4 rounded-2xl border transition-colors duration-200',
                                      isCorrect
                                        ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/15'
                                        : 'bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border/50',
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (q.type === 'multi_select') {
                                          toggleMultiSelectCorrect(
                                            qIndex,
                                            letter,
                                          );
                                        } else {
                                          handleQuestionChange(
                                            qIndex,
                                            'correctAnswer',
                                            letter ?? 'A',
                                          );
                                        }
                                      }}
                                      className={cn(
                                        'w-8 h-8 flex shrink-0 items-center justify-center rounded-xl border-2 transition-colors shadow-sm mt-0.5',
                                        isCorrect
                                          ? 'bg-green-500 border-green-500 text-white shadow-green-500/20'
                                          : 'bg-background border-border text-muted-foreground/40 group-hover/option:border-violet-400/50 group-hover/option:text-violet-400',
                                      )}
                                    >
                                      {isCorrect ? (
                                        <Check className="w-5 h-5 stroke-[3]" />
                                      ) : (
                                        <span className="text-xs font-bold">
                                          {letter}
                                        </span>
                                      )}
                                    </button>

                                    <div
                                      className={cn(
                                        'flex-1 space-y-1 min-w-0',
                                        isCorrect && 'pr-16', // Add padding to prevent text overlap with 'Correct' badge
                                      )}
                                    >
                                      <Textarea
                                        value={opt}
                                        onChange={(e) =>
                                          handleOptionChange(
                                            qIndex,
                                            oIndex,
                                            e.target.value,
                                          )
                                        }
                                        className={cn(
                                          'min-h-[2.5rem] h-auto bg-transparent border-none p-0 focus-visible:ring-0 resize-none text-base leading-relaxed overflow-hidden',
                                          isCorrect
                                            ? 'text-green-700 dark:text-green-300 font-medium'
                                            : 'text-foreground/90',
                                        )}
                                        rows={1}
                                        style={{ height: 'auto' }}
                                        ref={(el) => {
                                          if (el) {
                                            el.style.height = 'auto';
                                            el.style.height = `${el.scrollHeight}px`;
                                          }
                                        }}
                                        onInput={(e) => {
                                          const target =
                                            e.target as HTMLTextAreaElement;
                                          target.style.height = 'auto';
                                          target.style.height = `${target.scrollHeight}px`;
                                        }}
                                      />
                                    </div>

                                    {isCorrect && (
                                      <div className="absolute top-0 right-0 p-3 pointer-events-none">
                                        <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 border-none text-[10px] uppercase font-bold px-2 h-5">
                                          Correct
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-6 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
                              <Label className="text-xs uppercase font-bold text-muted-foreground/50 tracking-widest">
                                Correct Answer (Exact Match)
                              </Label>
                              <Input
                                value={q.correctAnswer}
                                onChange={(e) =>
                                  handleQuestionChange(
                                    qIndex,
                                    'correctAnswer',
                                    e.target.value,
                                  )
                                }
                                placeholder="Type the expected answer..."
                                className="bg-background/50 border-border/50 text-lg font-bold h-12"
                              />
                            </div>
                          )}
                        </div>

                        {/* Reasoning */}
                        <div className="bg-violet-500/5 rounded-2xl p-5 border border-violet-500/10">
                          <Label className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-300 mb-3 flex items-center gap-2">
                            <BrainCircuit className="w-3 h-3" />
                            AI Explanation
                          </Label>
                          <Textarea
                            value={q.explanation}
                            onChange={(e) =>
                              handleQuestionChange(
                                qIndex,
                                'explanation',
                                e.target.value,
                              )
                            }
                            className="text-sm text-foreground/80 min-h-[60px] bg-transparent border-none p-0 focus-visible:ring-0 resize-none leading-relaxed italic overflow-hidden"
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 shrink-0 border-t border-border bg-card/80 backdrop-blur-xl">
          {step === 'config' ? (
            <div className="w-full flex justify-between items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="hover:bg-destructive/10 hover:text-destructive h-12 px-6 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="config-form"
                disabled={generateMutation.isPending}
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-colors font-bold text-base"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Intelligence...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-5 h-5 mr-2" />
                    Generate Quiz Preview
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="w-full flex justify-between items-center max-w-6xl mx-auto">
              <Button
                variant="ghost"
                onClick={() => setStep('config')}
                className="h-12 px-6 rounded-xl hover:bg-muted font-medium"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Config
              </Button>
              <Button
                onClick={handleSave}
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-colors font-bold text-base"
              >
                Looks Good, Create Quiz
                <Check className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
