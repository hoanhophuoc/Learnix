import { useState, useCallback, useRef, useEffect } from 'react';

import { Upload, X, Loader2, ImageIcon, AlertCircle } from 'lucide-react';

import {
  uploadApi,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from '@/lib/upload-api';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  /** Current image URL (for displaying existing image) */
  value?: string;
  /** Called when image is uploaded successfully */
  onChange: (url: string | undefined) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show a circular preview (for avatars) */
  circular?: boolean;
  /** Upload type - avatar has smaller size limit */
  type?: 'avatar' | 'image';
  /** Max file size in bytes */
  maxSize?: number;
  /** Allowed MIME types */
  allowedTypes?: string[];
  /** Additional class names */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Preview size (width and height) */
  previewSize?: number;
  /** Fallback URL when value is empty (e.g., OAuth avatar) */
  fallbackUrl?: string;
}

export function ImageUpload({
  value,
  onChange,
  placeholder = 'Upload image',
  circular = false,
  type = 'image',
  maxSize,
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  className,
  disabled = false,
  previewSize = 120,
  fallbackUrl,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine max size based on type
  const effectiveMaxSize =
    maxSize ?? (type === 'avatar' ? 5 * 1024 * 1024 : 10 * 1024 * 1024);

  // Cleanup preview URL on unmount or when value changes
  useEffect(
    () => () => {
      if (previewUrl) {
        revokePreviewUrl(previewUrl);
      }
    },
    [previewUrl],
  );

  // Reset image error when display URL changes
  const displayUrl = previewUrl ?? value ?? fallbackUrl;
  const [prevDisplayUrl, setPrevDisplayUrl] = useState(displayUrl);
  if (displayUrl !== prevDisplayUrl) {
    setPrevDisplayUrl(displayUrl);
    setImageError(false);
  }

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file
      const validation = validateImageFile(file, {
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
        const result =
          type === 'avatar'
            ? await uploadApi.uploadAvatar(file)
            : await uploadApi.uploadImage(file);

        onChange(result.url);
        // Clear preview after successful upload (we now use the server URL)
        if (previewUrl) {
          revokePreviewUrl(previewUrl);
        }
        setPreviewUrl(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        // Revert preview on error
        if (preview) {
          revokePreviewUrl(preview);
        }
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    },
    [type, effectiveMaxSize, allowedTypes, onChange, previewUrl],
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
    if (file?.type.startsWith('image/')) {
      void handleFileSelect(file);
    } else {
      setError('Please drop an image file');
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

  // Whether the current display is the fallback (OAuth avatar)
  const isShowingFallback = !previewUrl && !value && Boolean(fallbackUrl);

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
          'relative flex items-center justify-center border-2 border-dashed transition-colors cursor-pointer', // Removed overflow-hidden
          circular ? 'rounded-full' : 'rounded-xl', // Removed overflow-hidden to allow button to overlap
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'cursor-wait',
        )}
        style={
          circular
            ? {
                width: previewSize,
                height: previewSize,
              }
            : {
                width: '100%',
                minHeight: '200px',
                // maxHeight removed to let content dictate height up to the image's max-height
              }
        }
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

        {/* Image preview */}
        {displayUrl && !imageError ? (
          <>
            <img
              src={displayUrl}
              alt="Preview"
              className={cn(
                circular
                  ? 'w-full h-full object-cover rounded-full'
                  : 'w-auto h-auto max-w-full max-h-[500px] rounded-md shadow-sm', // Use intrinsic size bounded by max constraints
                circular ? '' : '', // Rounded classes moved to conditional above or on img
                isShowingFallback && 'opacity-80', // Slightly dim fallback image
              )}
              onError={() => {
                setImageError(true);
              }}
            />
            {/* Remove button - only show if there's a custom value (not fallback) */}
            {!disabled && !isUploading && value && !isShowingFallback && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className={cn(
                  'absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:bg-destructive/90 transition-colors z-10',
                  'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
                )}
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          /* Placeholder */
          <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
            {isDragging ? (
              <Upload className="w-8 h-8 mb-2 text-primary" />
            ) : (
              <ImageIcon className="w-8 h-8 mb-2" />
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
