import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  coursesApi,
  type LessonResource,
} from '@/features/courses/api/courses-api';
import { cn } from '@/lib/utils';

interface LessonResourcesProps {
  courseId: string;
  lessonId: string;
  resources: LessonResource[];
  isInstructor: boolean;
  onAddResource?: (resource: Omit<LessonResource, 'id' | 'lessonId'>) => void;
  onRemoveResource?: (resourceId: string) => void;
}

export function LessonResources({
  lessonId,
  resources,
  isInstructor,
  onAddResource,
  onRemoveResource,
}: LessonResourcesProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (resourceId: string) => coursesApi.removeResource(resourceId),
    onSuccess: () => {
      toast.success('Resource removed');
      void queryClient.invalidateQueries({ queryKey: ['course'] });
    },
    onError: () => {
      toast.error('Failed to remove resource');
    },
  });

  const handleDelete = (resourceId: string) => {
    deleteMutation.mutate(resourceId);
  };

  // If there are no resources and the user is NOT an instructor, hide the section entirely
  // NOTE: This early return must come AFTER all hooks to comply with Rules of Hooks
  if (resources.length === 0 && !isInstructor) {
    return null;
  }

  // Extract file extension from URL or title
  const getFileExtension = (resource: LessonResource): string => {
    // Try to get extension from URL first
    const urlMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(resource.url);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }
    // Fallback to title
    const titleMatch = /\.([a-zA-Z0-9]+)$/.exec(resource.title);
    if (titleMatch) {
      return titleMatch[1].toUpperCase();
    }
    return 'FILE';
  };

  const getDownloadUrl = (resource: LessonResource) => {
    if (
      resource.type === 'file' &&
      resource.url.includes('cloudinary') &&
      resource.url.includes('/upload/')
    ) {
      // Check the resource type from the URL path
      const isImageUpload = resource.url.includes('/image/upload/');
      const isVideoUpload = resource.url.includes('/video/upload/');

      // 'fl_attachment' transformation works on images/videos (and PDFs uploaded as images).
      // It forces the browser to download the file instead of displaying it inline.
      if (isImageUpload || isVideoUpload) {
        // Apply fl_attachment without custom name to avoid Unicode issues
        return resource.url.replace('/upload/', '/upload/fl_attachment/');
      }

      // For 'raw' files, return URL as-is (download will be handled programmatically)
      return resource.url;
    }
    return resource.url;
  };

  // Check if a resource is a Cloudinary file (any type)
  const isCloudinaryFile = (resource: LessonResource): boolean =>
    resource.type === 'file' &&
    resource.url.includes('cloudinary') &&
    resource.url.includes('/upload/');

  // Build the download filename from resource title and URL extension
  const getDownloadFilename = (resource: LessonResource): string => {
    // Get extension from URL
    const urlMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(resource.url);
    const urlExtension = urlMatch ? `.${urlMatch[1].toLowerCase()}` : '';

    // Check if title already has the extension
    const titleLower = resource.title.toLowerCase();
    if (urlExtension && titleLower.endsWith(urlExtension)) {
      return resource.title; // Title already has extension
    }

    // Append extension to title
    return `${resource.title}${urlExtension}`;
  };

  // Programmatic download for Cloudinary files (fetch + blob approach)
  // This preserves the original filename from the resource title
  const handleDownloadFile = async (resource: LessonResource) => {
    try {
      const response = await fetch(resource.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use the original title with proper extension as filename
      a.download = getDownloadFilename(resource);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (_error) {
      // Fallback: open in new tab if download fails
      window.open(resource.url, '_blank');
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Lesson Resources
        </h3>
        {isInstructor && (
          <AddResourceDialog
            lessonId={lessonId}
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onAdd={onAddResource}
            currentTotalSize={resources.reduce(
              (acc, r) => acc + (r.fileSize ?? 0),
              0,
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="group relative flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm hover:bg-muted/30 transition-all duration-300"
          >
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 min-w-0 flex-1"
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  resource.type === 'link'
                    ? 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/15'
                    : 'bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/15',
                )}
              >
                {resource.type === 'link' ? (
                  <LinkIcon className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                  {resource.title}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                  {resource.type === 'link'
                    ? 'Link'
                    : getFileExtension(resource)}
                  {resource.fileSize && (
                    <>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      {Math.round(resource.fileSize / 1024)} KB
                    </>
                  )}
                </span>
              </div>
            </a>

            <div className="flex items-center pl-3">
              {resource.type === 'file' && isCloudinaryFile(resource) ? (
                <button
                  onClick={() => void handleDownloadFile(resource)}
                  className="p-2 text-muted-foreground/50 hover:text-primary transition-colors"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </button>
              ) : (
                <a
                  href={
                    resource.type === 'file'
                      ? getDownloadUrl(resource)
                      : resource.url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground/50 hover:text-primary transition-colors"
                  title={
                    resource.type === 'link' ? 'Open Link' : 'Download File'
                  }
                >
                  {resource.type === 'link' ? (
                    <ExternalLink className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </a>
              )}
              {isInstructor && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setResourceToDelete(resource.id);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {resources.length === 0 && isInstructor && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileText className="w-8 h-8 opacity-50" />
              <p className="text-sm font-medium">No resources added yet</p>
              <p className="text-xs">
                Upload files or add links to help your students.
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(resourceToDelete)}
        onOpenChange={(open) => !open && setResourceToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this resource? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (resourceToDelete) {
                  if (onRemoveResource) {
                    onRemoveResource(resourceToDelete);
                  } else {
                    handleDelete(resourceToDelete);
                  }
                  setResourceToDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddResourceDialog({
  lessonId,
  open,
  onOpenChange,
  onAdd,
  currentTotalSize,
}: {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (resource: Omit<LessonResource, 'id' | 'lessonId'>) => void;
  currentTotalSize: number;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'link' | 'file'>('link');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: URL required for link, File required for file type
    if (type === 'link' && (!url || !title)) {
      return;
    }
    if (type === 'file' && selectedFiles.length === 0) {
      return;
    }
    // For single file, title is required
    if (type === 'file' && selectedFiles.length === 1 && !title) {
      return;
    }

    // Check 25MB limit
    if (type === 'file') {
      const newFilesSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
      if (currentTotalSize + newFilesSize > 25 * 1024 * 1024) {
        toast.error(
          `Total lesson resources size cannot exceed 25MB. You have ${Math.round((25 * 1024 * 1024 - currentTotalSize) / 1024 / 1024)}MB remaining.`,
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (type === 'file') {
        // Handle file uploads (single or multiple)
        const uploadPromises = selectedFiles.map(async (file) => {
          const uploadResult = await coursesApi.uploadFile(file);

          // Use user-provided title for single file, or filename for multiple
          const resourceTitle = selectedFiles.length === 1 ? title : file.name;

          const resourceData = {
            title: resourceTitle,
            type: 'file' as const,
            url: uploadResult.url,
            fileSize: uploadResult.size,
          };

          if (onAdd) {
            onAdd(resourceData);
            return;
          }

          return coursesApi.addResource(lessonId, resourceData);
        });

        await Promise.all(uploadPromises);
      } else {
        // Handle Link
        const resourceData = {
          title,
          type,
          url,
        };

        if (onAdd) {
          onAdd(resourceData);
        } else {
          await coursesApi.addResource(lessonId, resourceData);
        }
      }

      if (!onAdd) {
        void queryClient.invalidateQueries({ queryKey: ['course'] });
      }

      toast.success(
        `Successfully added ${type === 'file' ? selectedFiles.length : 1} resource(s)`,
      );
      onOpenChange(false);
      setTitle('');
      setUrl('');
      setSelectedFiles([]);
      setType('link');
      setIsSubmitting(false);
    } catch (_error) {
      toast.error('Failed to add resource');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add Lesson Resource</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={
                selectedFiles.length > 1
                  ? 'titles will be filenames'
                  : 'e.g. Slide Deck'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required={type === 'link' || selectedFiles.length <= 1}
              disabled={selectedFiles.length > 1}
              className={selectedFiles.length > 1 ? 'opacity-50' : ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(val: 'link' | 'file') => setType(val)}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">External Link</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {type === 'link' ? (
              <>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/resource"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <Label htmlFor="file">File(s)</Label>
                <Input
                  id="file"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const { files } = e.target;
                    if (files) {
                      setSelectedFiles(Array.from(files));
                    }
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Supporting documents (PDF, DOC), images, or other assets (max
                  25MB)
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add Resource
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
