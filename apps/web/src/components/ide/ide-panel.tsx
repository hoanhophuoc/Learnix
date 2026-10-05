import { useCallback, useEffect, useState, useRef } from 'react';
import React from 'react';

import { HelpCircle, Loader2, Play, RotateCcw, Eye, Code2 } from 'lucide-react';
import * as ReactDOM from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { executeClientSide } from './client-executor';
import { CodeEditor } from './code-editor';

import type { OnMount } from '@monaco-editor/react';

// Expose React for the client executor to use in 'require' shim
if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOM = ReactDOM;
}

const STORAGE_KEY_PREFIX = 'ide_progress_';

const STDIN_INSTRUCTIONS = new Map<string, string>([
  ['python', 'Tip: input() reads one line at a time.'],
  ['javascript', 'Tip: input() reads one line at a time.'],
  ['typescript', 'Tip: input() reads one line at a time.'],
  ['java', 'Tip: Use Scanner with System.in to read input.'],
  ['c++', 'Tip: Use cin >> or getline() to read input.'],
  ['cpp', 'Tip: Use cin >> or getline() to read input.'],
  ['c', 'Tip: Use scanf() or fgets() to read input.'],
  ['csharp', 'Tip: Use Console.ReadLine() to read input.'],
  ['go', 'Tip: Use bufio.Scanner to read input line-by-line.'],
  ['rust', 'Tip: Use std::io::stdin() to read input.'],
]);

interface IdePanelProps {
  allowedLanguages: {
    language: string;
    initialCode: string;
    expectedOutput?: string;
    unitTestCode?: string;
  }[];
  defaultLanguage: string;
  onSuccess?: () => void;
  lessonId: string;
}

export function IdePanel({
  allowedLanguages,
  defaultLanguage,
  onSuccess,
  lessonId,
}: IdePanelProps) {
  const [currentLanguage, setCurrentLanguage] = useState(defaultLanguage);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const clearMarkers = useCallback(() => {
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'piston', []);
      }
    }
  }, []);

  const setMarkers = useCallback(
    (stderr: string) => {
      if (!monacoRef.current || !editorRef.current) {
        return;
      }
      const model = editorRef.current.getModel();
      if (!model) {
        return;
      }

      const markers: any[] = [];
      const lines = stderr.split('\n');

      lines.forEach((line) => {
        let match;
        if (currentLanguage === 'python') {
          match = /line (\d+)/.exec(line);
        } else {
          match = /:(\d+):(\d+):/.exec(line) ?? /:(\d+):/.exec(line);
        }

        if (match) {
          const lineNum = parseInt(match[1]);
          const colNum = match[2] ? parseInt(match[2]) : 1;
          const lineCount = model.getLineCount();

          // Validate line number is within valid range
          if (lineNum < 1 || lineNum > lineCount) {
            return; // Skip invalid line numbers
          }

          markers.push({
            startLineNumber: lineNum,
            startColumn: colNum,
            endLineNumber: lineNum,
            endColumn: model.getLineMaxColumn(lineNum),
            message: line.trim(),
            severity: 8, // MarkerSeverity.Error
          });
        }
      });

      if (markers.length > 0) {
        monacoRef.current.editor.setModelMarkers(model, 'piston', markers);
      }
    },
    [currentLanguage],
  );

  const currentConfig =
    allowedLanguages.find((l) => l.language === currentLanguage) ??
    allowedLanguages[0];

  const getSavedCode = useCallback(
    (lang: string) => {
      try {
        const saved = localStorage.getItem(
          `${STORAGE_KEY_PREFIX}${lessonId}_${lang}`,
        );
        return saved ?? null;
      } catch {
        return null;
      }
    },
    [lessonId],
  );

  const [code, setCode] = useState(
    () => getSavedCode(currentLanguage) ?? currentConfig?.initialCode ?? '',
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${lessonId}_${currentLanguage}`,
        code,
      );
    }, 1000);
    return () => clearTimeout(handler);
  }, [code, currentLanguage, lessonId]);

  const currentLangKey = `${lessonId}_${currentLanguage}`;
  const [prevLangKey, setPrevLangKey] = useState(currentLangKey);
  if (currentLangKey !== prevLangKey) {
    setPrevLangKey(currentLangKey);
    const saved = getSavedCode(currentLanguage);
    if (saved !== null) {
      setCode(saved);
    } else {
      const config = allowedLanguages.find(
        (l) => l.language === currentLanguage,
      );
      if (config) {
        setCode(config.initialCode);
      }
    }
  }

  useEffect(() => {
    clearMarkers();
  }, [currentLanguage, lessonId, clearMarkers]);

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<
    'success' | 'error' | null
  >(null);
  const [stdin, setStdin] = useState('');
  const [previewIframeSrc, setPreviewIframeSrc] = useState<string | null>(null);
  // Default to Preview if it's React/JS code (implied by having exports/components), otherwise Output
  const [activeTab, setActiveTab] = useState<'console' | 'preview' | 'input'>(
    'console',
  );

  const handleRun = async () => {
    setIsRunning(true);
    setExecutionResult(null);
    setOutput('');
    // Revoke previous blob URL if exists
    if (previewIframeSrc) {
      URL.revokeObjectURL(previewIframeSrc);
    }
    setPreviewIframeSrc(null);

    // For Python, JS, TS (Node), we want console. For React, we prefer Preview.
    // Note: JS/TS are now backend-executed by default, so they should use console.
    if (currentLanguage === 'react') {
      setActiveTab('preview');
    } else {
      setActiveTab('console');
    }

    try {
      // Append unit test code if available
      let codeToExecute = code;
      if (currentConfig?.unitTestCode) {
        // Add some separation
        codeToExecute = `${code}\n\n${currentConfig.unitTestCode}`;
      }

      const result = await executeClientSide(
        currentLanguage,
        codeToExecute,
        stdin,
      );
      const combinedOutput =
        result.stdout + (result.stderr ? `\n\n${result.stderr}` : '');
      setOutput(combinedOutput);

      if (result.iframeSrc) {
        setPreviewIframeSrc(result.iframeSrc);
        setActiveTab('preview'); // Auto-switch to preview if we got iframe
      }

      // Check success conditions
      if (result.iframeSrc) {
        // React preview - if there's expectedOutput, we can't auto-verify, so leave neutral
        // If no expectedOutput, treat as success (preview rendered)
        if (currentConfig?.expectedOutput) {
          // Leave executionResult as null (neutral) - cannot auto-verify React output
          setExecutionResult(null);
        } else {
          setExecutionResult('success');
        }
        clearMarkers();
      } else if (result.stderr) {
        // Runtime error or Test Failure
        setExecutionResult('error');
        setMarkers(result.stderr);
        // Ensure the error tab is visible if it matters, but console is already default
      } else if (currentConfig?.expectedOutput && !currentConfig.unitTestCode) {
        // Legacy String Matching (only if no unitTestCode)
        if (combinedOutput.trim() === currentConfig.expectedOutput.trim()) {
          setExecutionResult('success');
          clearMarkers();
          toast.success('Correct output!');
          onSuccess?.();
        } else {
          setExecutionResult('error');
          toast.warning('Output does not match expected result.');
        }
      } else {
        // Success (No stderr, and either matched or unitTestCode passed validation implicitly by not erroring)
        // If unitTestCode is present and did not throw, then it is a success.
        setExecutionResult('success');
        clearMarkers();
        if (currentConfig?.unitTestCode) {
          toast.success('Tests passed!');
          onSuccess?.();
        }
      }
      setIsRunning(false);
    } catch (error: any) {
      setOutput(String(error.message ?? error));
      setExecutionResult('error');
      toast.error('Failed to run code.');
      setActiveTab('console'); // Force console on crash
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    clearMarkers();
    const resetCode = currentConfig?.initialCode ?? '';
    setCode(resetCode);
    localStorage.removeItem(
      `${STORAGE_KEY_PREFIX}${lessonId}_${currentLanguage}`,
    );
    setOutput('');
    setExecutionResult(null);
    setStdin('');
    setPreviewIframeSrc(null);
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {allowedLanguages.length > 1 ? (
            <Select
              value={currentLanguage}
              onValueChange={(val) => {
                setCurrentLanguage(val);
                setOutput('');
                setExecutionResult(null);
                setPreviewIframeSrc(null);
              }}
            >
              <SelectTrigger className="w-[140px] h-8 bg-transparent border-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 text-sm font-semibold capitalize">
                <SelectValue placeholder="Select Language" />
              </SelectTrigger>
              <SelectContent>
                {allowedLanguages.map((l) => (
                  <SelectItem
                    key={l.language}
                    value={l.language}
                    className="capitalize"
                  >
                    {l.language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-semibold capitalize">
              {currentLanguage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isRunning}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => void handleRun()}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            )}
            Run
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto]">
        <div className="min-h-0 relative">
          <CodeEditor
            id={`student-${lessonId}`}
            initialValue={code}
            language={currentLanguage}
            onChange={(val) => setCode(val ?? '')}
            onMount={handleEditorMount}
          />
        </div>

        {/* Output Panel with Tabs */}
        <div className="h-64 border-t border-border flex flex-col bg-[#0d1117] font-mono text-sm relative">
          <Tabs
            value={activeTab}
            onValueChange={(v: any) => setActiveTab(v)}
            className="flex flex-col h-full"
          >
            <div className="flex items-center px-4 bg-[#161b22] border-b border-[#30363d] justify-between">
              <TabsList className="h-9 bg-transparent p-0 gap-1">
                <TabsTrigger
                  value="console"
                  className="data-[state=active]:bg-[#0d1117] data-[state=active]:text-white data-[state=active]:shadow-none text-gray-400 h-full rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary transition-none"
                >
                  <Code2 className="w-3.5 h-3.5 mr-1.5" /> Console
                </TabsTrigger>
                {(currentLanguage === 'javascript' ||
                  currentLanguage === 'typescript') && (
                  <TabsTrigger
                    value="preview"
                    className="data-[state=active]:bg-[#0d1117] data-[state=active]:text-white data-[state=active]:shadow-none text-gray-400 h-full rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary transition-none"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="input"
                  className="data-[state=active]:bg-[#0d1117] data-[state=active]:text-white data-[state=active]:shadow-none text-gray-400 h-full rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary transition-none"
                >
                  Input
                </TabsTrigger>
              </TabsList>

              {executionResult && (
                <div
                  className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border ${
                    executionResult === 'success'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-red-400 bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${executionResult === 'success' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
                  />
                  {executionResult === 'success' ? 'SUCCESS' : 'ERROR'}
                </div>
              )}
            </div>

            <TabsContent
              value="console"
              className="flex-1 min-h-0 mt-0 p-0 relative"
            >
              {isRunning && (
                <div className="absolute inset-0 bg-[#0d1117]/80 flex flex-col gap-2 items-center justify-center z-10 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-muted-foreground text-xs">
                    Initializing environment...
                  </p>
                </div>
              )}

              <div className="h-full w-full overflow-y-auto custom-scrollbar p-4 text-gray-300 whitespace-pre-wrap break-words leading-relaxed selection:bg-primary/30">
                {output ||
                  (!isRunning && (
                    <span className="text-gray-600 italic">
                      No output to display
                    </span>
                  ))}
              </div>
            </TabsContent>

            <TabsContent
              value="preview"
              className="flex-1 min-h-0 mt-0 p-0 relative bg-white"
            >
              <div className="h-full w-full overflow-hidden">
                {previewIframeSrc ? (
                  <iframe
                    src={previewIframeSrc}
                    className="w-full h-full border-0"
                    title="React Preview"
                    sandbox="allow-scripts"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Eye className="w-8 h-8 mb-2 opacity-50" />
                    <p>Run code to see preview</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="input"
              className="flex-1 min-h-0 mt-0 p-0 bg-[#0d1117]"
            >
              <div className="flex flex-col h-full">
                <div
                  className={cn(
                    'flex items-start gap-3 p-3 border-b border-gray-800 bg-gray-900/50',
                  )}
                >
                  <HelpCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                  <p className="text-xs text-gray-400">
                    {STDIN_INSTRUCTIONS.get(currentLanguage) ??
                      'Provide standard input (stdin) for your program here.'}
                  </p>
                </div>
                <textarea
                  className="flex-1 w-full bg-transparent text-gray-200 p-4 outline-none resize-none placeholder:text-gray-600 font-mono text-sm leading-relaxed"
                  placeholder="Paste your input data here..."
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
