import { useState, useEffect } from 'react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Type,
  Video,
  Image as ImageIcon,
  Code,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UrlInput } from '@/components/ui/url-input';
import { VideoUpload } from '@/components/ui/video-upload';
import type {
  LessonBlock,
  BlockType,
} from '@/features/courses/api/courses-api';
import { cn, getYoutubeId, getVimeoId } from '@/lib/utils';

interface BlockEditorProps {
  blocks: LessonBlock[];
  onChange: (blocks: LessonBlock[]) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function BlockEditor({
  blocks,
  onChange,
  onValidationChange,
}: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [invalidBlockIds, setInvalidBlockIds] = useState<Set<string>>(
    new Set(),
  );

  const handleValidationChange = (id: string, isValid: boolean) => {
    setInvalidBlockIds((prev) => {
      const next = new Set(prev);
      if (isValid) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    onValidationChange?.(invalidBlockIds.size === 0);
  }, [invalidBlockIds, onValidationChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Avoid accidental drags when clicking inputs
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const addBlock = (type: BlockType) => {
    const newBlock: LessonBlock = {
      id: generateId(),
      type,
      content: '',
      orderIndex: blocks.length,
      metadata: type === 'code' ? { language: 'javascript' } : {},
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<LessonBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    setInvalidBlockIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onChange(blocks.filter((b) => b.id !== id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      const reordered = arrayMove(blocks, oldIndex, newIndex).map(
        (block, i) => ({
          ...block,
          orderIndex: i,
        }),
      );

      onChange(reordered);
    }

    setActiveId(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }

    const reordered = arrayMove(blocks, index, targetIndex).map((block, i) => ({
      ...block,
      orderIndex: i,
    }));

    onChange(reordered);
  };

  const activeBlock = blocks.find((b) => b.id === activeId);

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <SortableContext
            items={blocks}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, index) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                index={index}
                totalBlocks={blocks.length}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onRemove={() => removeBlock(block.id)}
                onValidationChange={(isValid) =>
                  handleValidationChange(block.id, isValid)
                }
                onMove={moveBlock}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.4',
                },
              },
            }),
          }}
        >
          {activeId && activeBlock ? (
            <div className="flex gap-4 p-4 border border-primary rounded-xl bg-card shadow-2xl scale-105 transition-transform z-50">
              <div className="flex flex-col gap-2 items-center justify-center pt-2">
                <div className="p-1 bg-muted rounded">
                  <GripVertical className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                  <span className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    {getBlockIcon(activeBlock.type)}
                    {activeBlock.type} Block
                  </span>
                </div>
                <div className="opacity-50 pointer-events-none">
                  {renderBlockInput(
                    activeBlock,
                    () => {
                      /* noop */
                    },
                    () => {
                      /* noop */
                    },
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {blocks.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            Start adding content blocks to build your lesson
          </p>
        </div>
      )}

      <div className="sticky bottom-4 z-10 p-2 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-lg flex gap-2 justify-center">
        <ToolboxButton
          icon={Type}
          label="Text"
          onClick={() => addBlock('text')}
        />
        <ToolboxButton
          icon={Video}
          label="Video"
          onClick={() => addBlock('video')}
        />
        <ToolboxButton
          icon={ImageIcon}
          label="Image"
          onClick={() => addBlock('image')}
        />
        <ToolboxButton
          icon={Code}
          label="Code"
          onClick={() => addBlock('code')}
        />
      </div>
    </div>
  );
}

function SortableBlockItem({
  block,
  index,
  totalBlocks,
  onUpdate,
  onRemove,
  onValidationChange,
  onMove,
}: {
  block: LessonBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (updates: Partial<LessonBlock>) => void;
  onRemove: () => void;
  onValidationChange: (isValid: boolean) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex gap-4 p-4 border border-border rounded-xl bg-card transition-colors',
        isDragging
          ? 'opacity-30 border-dashed border-primary ring-2 ring-primary/20 bg-muted/50'
          : 'hover:shadow-md hover:border-primary/30',
      )}
    >
      <div className="flex flex-col gap-2 items-center justify-center pt-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors group/grip"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground group-hover/grip:text-primary" />
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onMove(index, 'up')}
            disabled={index === 0}
            className="p-1 hover:bg-muted rounded disabled:opacity-30"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 'down')}
            disabled={index === totalBlocks - 1}
            className="p-1 hover:bg-muted rounded disabled:opacity-30"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
          <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
            {getBlockIcon(block.type)}
            {block.type} Block
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {renderBlockInput(block, onUpdate, onValidationChange)}
      </div>
    </div>
  );
}

function ToolboxButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 hover:border-primary hover:text-primary"
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  );
}

function getBlockIcon(type: BlockType) {
  switch (type) {
    case 'text':
      return <Type className="w-3 h-3" />;
    case 'video':
      return <Video className="w-3 h-3" />;
    case 'image':
      return <ImageIcon className="w-3 h-3" />;
    case 'code':
      return <Code className="w-3 h-3" />;
    default:
      return <Type className="w-3 h-3" />;
  }
}
function MediaPreview({ url }: { url: string }) {
  if (!url?.trim()) {
    return null;
  }

  const youtubeId = getYoutubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    return (
      <div className="mt-4 rounded-lg overflow-hidden border bg-black aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          className="w-full h-full"
          allowFullScreen
          title="YouTube Video Preview"
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="mt-4 rounded-lg overflow-hidden border bg-black aspect-video">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="w-full h-full"
          allowFullScreen
          title="Vimeo Video Preview"
        />
      </div>
    );
  }

  // Check for direct video extensions
  const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
  if (isVideo) {
    return (
      <div className="mt-4 rounded-lg overflow-hidden border bg-black aspect-video flex items-center justify-center">
        <video src={url} controls className="w-full h-full">
          <track kind="captions" />
        </video>
      </div>
    );
  }

  // Fallback to image
  return (
    <div className="mt-4 rounded-lg overflow-hidden border bg-muted flex items-center justify-center min-h-[200px] max-h-[400px]">
      <img
        src={url}
        alt="Preview"
        className="max-w-full max-h-[400px] object-contain"
        onError={(e) => {
          // If it really looks like a video URL but failed image load (e.g. YouTube watch page)
          // and we didn't catch it with the simple regex, show a better placeholder.
          (e.target as HTMLImageElement).src =
            'https://placehold.co/600x400?text=Invalid+Media+URL';
        }}
      />
    </div>
  );
}

function VideoBlockInput({
  block,
  onChange,
  onValidationChange,
}: {
  block: LessonBlock;
  onChange: (updates: Partial<LessonBlock>) => void;
  onValidationChange: (isValid: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(() => {
    if (block.metadata?.videoSource) {
      return block.metadata.videoSource;
    }
    if (block.content) {
      return block.content.includes('cloudinary') ? 'upload' : 'url';
    }
    return 'upload';
  });

  const isUploaded =
    Boolean(block.content) &&
    (block.metadata?.videoSource === 'upload' ||
      block.content.includes('cloudinary'));
  const isExternalProvider =
    Boolean(block.content) &&
    (block.metadata?.videoSource === 'url' ||
      (!block.content.includes('cloudinary') && Boolean(block.content.trim())));

  const getTabValue = (): 'upload' | 'url' => {
    if (isUploaded) {
      return 'upload';
    }
    if (isExternalProvider) {
      return 'url';
    }
    return activeTab;
  };

  return (
    <Tabs
      value={getTabValue()}
      onValueChange={(val) => setActiveTab(val as 'upload' | 'url')}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="upload" disabled={isExternalProvider}>
          Upload Video
        </TabsTrigger>
        <TabsTrigger value="url" disabled={isUploaded}>
          External URL
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="space-y-2 mt-0">
        <VideoUpload
          value={block.content}
          onChange={(url) =>
            onChange({
              content: url ?? '',
              metadata: {
                ...block.metadata,
                videoSource: url ? 'upload' : undefined,
              },
            })
          }
          className="w-full"
        />
      </TabsContent>
      <TabsContent value="url" className="space-y-2 mt-0">
        <UrlInput
          value={block.content}
          onUrlChange={(val) => {
            onChange({
              content: val,
              metadata: {
                ...block.metadata,
                videoSource: val.trim() ? 'url' : undefined,
              },
            });
          }}
          onValidationChange={onValidationChange}
          placeholder="Paste video URL (YouTube, Vimeo, or MP4)"
          supportedText="Supported: YouTube, Vimeo, or direct MP4/WebM links."
        />

        {isExternalProvider && block.content?.trim() && (
          <MediaPreview url={block.content} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function ImageBlockInput({
  block,
  onChange,
  onValidationChange,
}: {
  block: LessonBlock;
  onChange: (updates: Partial<LessonBlock>) => void;
  onValidationChange: (isValid: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(() => {
    if (block.content && !block.content.includes('cloudinary')) {
      return 'url';
    }
    return 'upload';
  });

  const isUploaded =
    Boolean(block.content) && block.content.includes('cloudinary');
  const isExternalUrl =
    Boolean(block.content) &&
    !block.content.includes('cloudinary') &&
    Boolean(block.content.trim());

  const getTabValue = (): 'upload' | 'url' => {
    if (isUploaded) {
      return 'upload';
    }
    if (isExternalUrl) {
      return 'url';
    }
    return activeTab;
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={getTabValue()}
        onValueChange={(val) => setActiveTab(val as 'upload' | 'url')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="upload" disabled={isExternalUrl}>
            Upload Image
          </TabsTrigger>
          <TabsTrigger value="url" disabled={isUploaded}>
            External URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-0">
          <ImageUpload
            value={block.content}
            onChange={(url) => onChange({ content: url ?? '' })}
            className="w-full"
          />
        </TabsContent>
        <TabsContent value="url" className="mt-0 space-y-4">
          <UrlInput
            value={block.content}
            onUrlChange={(url) => onChange({ content: url })}
            onValidationChange={onValidationChange}
            placeholder="Paste image or video URL"
            supportedText="Note: YouTube and Vimeo links will preview as videos."
          />
          {isExternalUrl && block.content && (
            <MediaPreview url={block.content} />
          )}
        </TabsContent>
      </Tabs>
      <Input
        value={block.metadata?.caption ?? ''}
        onChange={(e) => {
          onChange({
            metadata: { ...block.metadata, caption: e.target.value },
          });
        }}
        placeholder="Add a caption (optional)"
        className="text-sm"
      />
    </div>
  );
}

function renderBlockInput(
  block: LessonBlock,
  onChange: (updates: Partial<LessonBlock>) => void,
  onValidationChange: (isValid: boolean) => void,
) {
  switch (block.type) {
    case 'text':
      return (
        <MarkdownEditor
          value={block.content}
          onChange={(val) => {
            onChange({ content: val });
          }}
          placeholder="Write your lesson content here..."
        />
      );
    case 'video':
      return (
        <VideoBlockInput
          block={block}
          onChange={onChange}
          onValidationChange={onValidationChange}
        />
      );
    case 'image':
      return (
        <ImageBlockInput
          block={block}
          onChange={onChange}
          onValidationChange={onValidationChange}
        />
      );
    case 'code':
      return (
        <div className="space-y-2 border border-input rounded-lg overflow-hidden">
          <div className="bg-muted px-3 py-1 border-b border-input flex gap-2">
            <Select
              value={block.metadata?.language ?? 'javascript'}
              onValueChange={(val) => {
                onChange({
                  metadata: { ...block.metadata, language: val },
                });
              }}
            >
              <SelectTrigger className="h-6 w-[120px] bg-transparent border-none focus:ring-0 text-xs text-muted-foreground hover:text-foreground p-0 gap-1 justify-start">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <textarea
            value={block.content}
            onChange={(e) => {
              onChange({ content: e.target.value });
            }}
            className="w-full min-h-[150px] p-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm focus:outline-none"
            placeholder="// Write code here"
            spellCheck={false}
          />
        </div>
      );
    default:
      return null;
  }
}
