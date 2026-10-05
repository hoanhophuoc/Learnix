import { useState, useEffect, useCallback } from 'react';

import { Link } from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKitExtension from '@tiptap/starter-kit';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react';
import { Markdown } from 'tiptap-markdown';

import { cn } from '@/lib/utils';

import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Input } from './input';
import { Label } from './label';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
  initialUrl: string;
}

function LinkDialog({
  isOpen,
  onClose,
  onConfirm,
  initialUrl,
}: LinkDialogProps) {
  // Use a key pattern - when initialUrl changes while dialog is open, we want to reset
  // Initialize with initialUrl directly
  const [url, setUrl] = useState('');

  // Reset URL when dialog opens (using a controlled pattern)
  const dialogKey = isOpen ? `open-${initialUrl}` : 'closed';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(url);
    onClose();
  };

  // Handle dialog open state change
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setUrl(initialUrl);
    }
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} key={dialogKey}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
          <DialogDescription>
            Enter the URL for the link. Leave empty to remove the link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                // Auto-fill when dialog opens
                defaultValue={initialUrl}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{url ? 'Add Link' : 'Remove Link'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MenuBarProps {
  editor: Editor | null;
  onLinkClick: () => void;
}

const MenuBar = ({ editor, onLinkClick }: MenuBarProps) => {
  if (!editor) {
    return null;
  }

  // Helper to generate consistent button props
  const getButtonProps = (isActive: boolean) => ({
    type: 'button' as const,
    variant: 'ghost' as const,
    size: 'sm' as const,
    className: cn(
      'h-8 w-8 p-0 cursor-pointer',
      isActive
        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ring-1 ring-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    ),
  });

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/30 p-2">
      <Button
        {...getButtonProps(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-5 w-5" />
      </Button>
      <Button
        {...getButtonProps(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-5 w-5" />
      </Button>
      <Button
        {...getButtonProps(editor.isActive('strike'))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough (Ctrl+Shift+X)"
      >
        <Strikethrough className="h-5 w-5" />
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        {...getButtonProps(editor.isActive('heading', { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="h-5 w-5" />
      </Button>
      <Button
        {...getButtonProps(editor.isActive('heading', { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-5 w-5" />
      </Button>
      <Button
        {...getButtonProps(editor.isActive('heading', { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="h-5 w-5" />
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        {...getButtonProps(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-5 w-5" />
      </Button>
      <Button
        {...getButtonProps(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        <ListOrdered className="h-5 w-5" />
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        {...getButtonProps(editor.isActive('link'))}
        onClick={onLinkClick}
        title="Add Link"
      >
        <LinkIcon className="h-5 w-5" />
      </Button>
    </div>
  );
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
}: MarkdownEditorProps) {
  // Use state to force re-render on transaction
  const [, setTick] = useState(0);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKitExtension.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Explicitly force list styling
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc list-outside ml-4',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal list-outside ml-4',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'pl-1',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4',
        },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value, // Initial content
    editorProps: {
      attributes: {
        // Manually enforce header styles to override Tailwind resets
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none min-h-[150px] p-4 focus:outline-none',
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4',
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3',
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2',
          '[&_ul]:mb-3 [&_ol]:mb-3',
          '[&_s]:line-through [&_del]:line-through',
          '[&_strong]:font-bold [&_strong]:text-foreground',
          '[&_em]:italic',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // Access markdown storage in a type-safe way
      const storage = editor.storage as unknown as {
        markdown?: { getMarkdown?: () => string };
      };
      const markdownOutput = storage.markdown?.getMarkdown?.() ?? '';
      onChange(markdownOutput);
    },
    // Important: Re-render component on every transaction (selection change, cursor move)
    onTransaction: () => {
      setTick((prev) => prev + 1);
    },
  });

  const handleLinkClick = useCallback(() => {
    if (!editor) {
      return;
    }
    const previousUrl = String(editor.getAttributes('link').href ?? '');
    setCurrentLinkUrl(previousUrl);
    setIsLinkDialogOpen(true);
  }, [editor]);

  const handleLinkConfirm = useCallback(
    (url: string) => {
      if (!editor) {
        return;
      }

      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }

      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    },
    [editor],
  );

  // Sync content if external value changes (e.g. data loaded from API)
  useEffect(() => {
    if (!editor) {
      return;
    }

    const storage = editor.storage as unknown as {
      markdown?: { getMarkdown?: () => string };
    };
    const currentMarkdown = storage.markdown?.getMarkdown?.() ?? '';
    // Check if content actually changed to avoid loop
    if (value !== currentMarkdown) {
      // Force set content - Tiptap Markdown extension handles parsing string -> nodes
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[200px] border rounded-xl bg-muted/10 animate-pulse" />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring transition-colors shadow-sm">
        <MenuBar editor={editor} onLinkClick={handleLinkClick} />
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
      <LinkDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onConfirm={handleLinkConfirm}
        initialUrl={currentLinkUrl}
      />
    </>
  );
}
