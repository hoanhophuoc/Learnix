import { useState, useCallback, useRef, useEffect } from 'react';

import { Upload, X, Loader2, Video, AlertCircle } from 'lucide-react';

import {
  uploadApi,
  validateVideoFile,
  createPreviewUrl,
  revokePreviewUrl,
} from '@/lib/upload-api';
import { cn } from '@/lib/utils';

interface VideoUploadProps {
  /** Current video URL (for displaying existing video) */
  value?: string;
  /** Called when video is uploaded successfully */
  onChange: (url: string | undefined) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Max file size in bytes */
  maxSize?: number;
  /** Allowed MIME types */
  allowedTypes?: string[];
  /** Additional class names */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function VideoUpload({
  value,
  onChange,
  placeholder = 'Upload video',
  maxSize,
  allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  className,
  disabled = false,
}: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine max size (default 100MB)
  const effectiveMaxSize = maxSize ?? 100 * 1024 * 1024;

  // Cleanup preview URL on unmount or when value changes
  useEffect(
    () => () => {
      if (previewUrl) {
        revokePreviewUrl(previewUrl);
      }
    },
    [previewUrl],
  );

  const displayUrl = previewUrl ?? value;

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file
      const validation = validateVideoFile(file, {
        maxSize: effectiveMaxSize,
        allowedTypes,
      });

      if (!validation.valid) {
        setError(validation.error ?? 'Invalid file');
        return;
      }

      // Create preview
      const preview = createPreviewUrl(file);
      setPreviewUrl(preview);

      // Upload file
      setIsUploading(true);
      try {
        const result = await uploadApi.uploadVideo(file);

        onChange(result.url);
        // Clear preview after successful upload (we now use the server URL)
        if (previewUrl) {
          revokePreviewUrl(previewUrl);
        }
        setPreviewUrl(null);
        setIsUploading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        // Revert preview on error
        if (preview) {
          revokePreviewUrl(preview);
        }
        setPreviewUrl(null);
        setIsUploading(false);
      }
    },
    [effectiveMaxSize, allowedTypes, onChange, previewUrl],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('video/')) {
      void handleFileSelect(file);
    } else {
      setError('Please drop a video file');
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setPreviewUrl(null);
    setError(null);
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex items-center justify-center border-2 border-dashed transition-all cursor-pointer rounded-xl min-h-[200px]',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'cursor-wait',
        )}
        aria-label={placeholder}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes.join(',')}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="hidden"
          aria-hidden="true"
        />

        {/* Loading state */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-inherit z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Video preview */}
        {displayUrl ? (
          <div className="relative w-full h-full min-h-[200px] bg-black rounded-xl overflow-hidden">
            <video
              src={displayUrl}
              controls
              muted
              className="w-full h-full object-contain"
            />
            {/* Remove button */}
            {!disabled && !isUploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className={cn(
                  'absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:bg-destructive/90 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
                  'z-20', // Ensure it's above video controls
                )}
                aria-label="Remove video"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          /* Placeholder */
          <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
            {isDragging ? (
              <Upload className="w-8 h-8 mb-2 text-primary" />
            ) : (
              <Video className="w-8 h-8 mb-2" />
            )}
            <span className="text-xs text-center">
              {isDragging ? 'Drop here' : placeholder}
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* File size hint */}
      {!error && !displayUrl && (
        <p className="text-xs text-muted-foreground text-center">
          Max {Math.round(effectiveMaxSize / (1024 * 1024))}MB •{' '}
          {allowedTypes.map((t) => t.split('/')[1].toUpperCase()).join(', ')}
        </p>
      )}
    </div>
  );
}
