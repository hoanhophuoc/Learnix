import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  type: 'multiple_choice' | 'multi_select' | 'true_false' | 'short_answer';
}

@Injectable()
export class AiQuizGeneratorService {
  private readonly logger = new Logger(AiQuizGeneratorService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  async generateQuizFromText(
    lessonText: string,
    numberOfQuestions = 5,
    preferredTypes: string[] = ['multiple_choice'],
  ): Promise<{ title: string; questions: GeneratedQuestion[] }> {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    // Truncate text if it's too long (approx. 20k chars) to prevent timeouts/context limits
    const MAX_CHARS = 20000;
    let processedText = lessonText;
    if (lessonText.length > MAX_CHARS) {
      this.logger.warn(
        `Lesson text too long (${lessonText.length} chars). Truncating to ${MAX_CHARS} chars.`,
      );
      processedText = lessonText.substring(0, MAX_CHARS) + '... (truncated)';
    }

    const typesSentence =
      preferredTypes.length > 0
        ? `Use these question types: ${preferredTypes.join(', ')}.`
        : 'Use multiple-choice questions.';

    const prompt = `You are an expert educator. Based on the following lesson content, generate a suitable quiz title and exactly ${numberOfQuestions} questions to test student understanding.
    
${typesSentence}

Lesson Content:
${processedText}

Requirements:
1. Generate exactly ${numberOfQuestions} questions.
2. Supported Types:
   - multiple_choice: 4 options (A: ..., B: ...), exactly ONE correct answer (e.g., "A").
   - multi_select: 4 options (A: ..., B: ...), ONE OR MORE correct answers (comma-separated, e.g., "A,C").
   - true_false: 2 options (A: True, B: False), exactly ONE correct answer (e.g., "A").
   - short_answer: No options, correctAnswer is a short text string.
3. Include an explanation for every correct answer.
4. Return ONLY a valid JSON object with this exact structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "questionText": "...",
      "type": "multiple_choice" | "multi_select" | "true_false" | "short_answer",
      "options": ["A: ...", "B: ..."], // Empty array for short_answer
      "correctAnswer": "A" | "Short answer text",
      "explanation": "..."
    }
  ]
}`;

    // Retry with exponential backoff
    const maxRetries = 3;
    let attempt = 0;

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (attempt < maxRetries) {
      try {
        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let content = response.text;

        if (!content) {
          this.logger.error('Gemini returned empty response');
          throw new Error('No response from Gemini');
        }

        this.logger.debug(`Raw Gemini response length: ${content.length}`);

        // Remove markdown code blocks if present (handle various formats)
        content = content
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();

        // Try to extract JSON object/array from the response
        // Sometimes Gemini adds extra text before or after JSON
        const jsonMatch = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(content);
        if (jsonMatch) {
          content = jsonMatch[1];
        }

        // Parse the JSON response
        let result: unknown;
        try {
          result = JSON.parse(content);
        } catch (_parseError) {
          this.logger.error(
            `JSON parse failed. Content: ${content.substring(0, 500)}...`,
          );
          throw new Error(
            'Failed to parse AI response. The response was not valid JSON.',
          );
        }

        // Validate the response structure
        let title = 'AI Generated Quiz';
        let questions: GeneratedQuestion[] = [];

        interface QuizResponse {
          title?: string;
          questions?: GeneratedQuestion[];
        }

        if (Array.isArray(result)) {
          // Fallback if AI ignores new structure
          questions = result as GeneratedQuestion[];
        } else if (
          typeof result === 'object' &&
          result !== null &&
          !Array.isArray(result)
        ) {
          const { title: resTitle, questions: resQuestions } =
            result as QuizResponse;
          if (resTitle) {
            title = resTitle;
          }
          if (Array.isArray(resQuestions)) {
            questions = resQuestions;
          }
        }

        if (questions.length === 0) {
          this.logger.error('No questions found in parsed response');
          throw new Error('Invalid response format: No questions found');
        }

        // Validate and filter questions to ensure they have required fields
        const validQuestions = questions.filter((q) => {
          const isValid =
            typeof q.questionText === 'string' &&
            q.questionText.trim().length > 0 &&
            typeof q.correctAnswer === 'string' &&
            q.correctAnswer.trim().length > 0 &&
            [
              'multiple_choice',
              'multi_select',
              'true_false',
              'short_answer',
            ].includes(q.type);

          if (!isValid) {
            this.logger.warn(
              `Filtering out invalid question: ${JSON.stringify(q).substring(0, 200)}`,
            );
          }
          return isValid;
        });

        // Ensure options is always an array
        validQuestions.forEach((q) => {
          if (!Array.isArray(q.options)) {
            q.options = [];
          }
        });

        if (validQuestions.length === 0) {
          this.logger.error('All generated questions were invalid');
          throw new Error('AI generated invalid questions. Please try again.');
        }

        this.logger.log(
          `Successfully generated ${validQuestions.length} valid questions`,
        );

        // Enforce count limit strictly in case AI hallucinated more
        if (validQuestions.length > numberOfQuestions) {
          return {
            title,
            questions: validQuestions.slice(0, numberOfQuestions),
          };
        }

        return { title, questions: validQuestions };
      } catch (error: unknown) {
        attempt++;

        this.logger.error(`Attempt ${attempt} failed:`, error);

        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? error.status
            : undefined;

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Determine if this error is retryable
        const isRetryableError =
          status === 503 ||
          status === 429 ||
          errorMessage.includes('parse') ||
          errorMessage.includes('No response') ||
          errorMessage.includes('invalid questions') ||
          errorMessage.includes('No questions found');

        if (isRetryableError && attempt < maxRetries) {
          // Wait 2000 * 2^(attempt-1) ... e.g. 2000, 4000, 8000
          const delay = 2000 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Retryable error detected. Waiting ${delay}ms before retry...`,
          );
          await wait(delay);
          continue;
        }

        // For quota errors, provide a specific message
        if (status === 429) {
          throw new Error('AI service quota exceeded. Please try again later.');
        }

        // For overload errors, provide a specific message
        if (status === 503) {
          throw new Error(
            'AI service is currently overloaded. Please try again later.',
          );
        }

        // For other errors, throw with the message
        throw new Error(`Failed to generate quiz: ${errorMessage}`);
      }
    }

    throw new Error('Failed to generate quiz after multiple attempts.');
  }
}
