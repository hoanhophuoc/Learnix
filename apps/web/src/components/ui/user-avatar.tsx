import * as React from 'react';

import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** User's avatar URL (custom uploaded) */
  avatarUrl?: string | null;
  /** OAuth provider avatar URL (Google/GitHub) */
  oauthAvatarUrl?: string | null;
  /** User's full name for generating initials */
  fullName?: string | null;
  /** User's email (fallback if no name) */
  email?: string;
  /** Alt text for the image */
  alt?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size classes for the avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
} as const;

/**
 * UserAvatar Component
 *
 * Displays user avatar with automatic fallback to initials when image fails to load.
 * Priority: avatarUrl > oauthAvatarUrl > initials fallback
 *
 * Handles broken OAuth provider avatars (e.g., Google's default letter-based avatars
 * that may fail due to CORS or other issues).
 */
export function UserAvatar({
  avatarUrl,
  oauthAvatarUrl,
  fullName,
  email,
  alt,
  className,
  size = 'md',
}: UserAvatarProps) {
  // Determine which image source to use
  const imageSrc = avatarUrl ?? oauthAvatarUrl;
  const [imageError, setImageError] = React.useState(false);
  const [prevImageSrc, setPrevImageSrc] = React.useState(imageSrc);

  if (imageSrc !== prevImageSrc) {
    setPrevImageSrc(imageSrc);
    setImageError(false);
  }

  // Generate initials from name or email
  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
      }
      return fullName.charAt(0).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials();
  const getSizeClass = (s: typeof size): string => {
    switch (s) {
      case 'sm':
        return sizeClasses.sm;
      case 'md':
        return sizeClasses.md;
      case 'lg':
        return sizeClasses.lg;
      case 'xl':
        return sizeClasses.xl;
    }
  };
  const sizeClass = getSizeClass(size);

  // Show fallback if no image or image failed to load
  if (!imageSrc || imageError) {
    return (
      <div
        className={cn(
          'rounded-xl flex items-center justify-center text-white font-semibold gradient-primary shrink-0',
          sizeClass,
          className,
        )}
        aria-label={alt ?? `${fullName ?? email ?? 'User'}'s avatar`}
      >
        {initials}
      </div>
    );
  }

  // Show image with error handling
  return (
    <img
      src={imageSrc}
      alt={alt ?? `${fullName ?? email ?? 'User'} avatar`}
      className={cn('rounded-xl object-cover shrink-0', sizeClass, className)}
      onError={() => {
        setImageError(true);
      }}
    />
  );
}
