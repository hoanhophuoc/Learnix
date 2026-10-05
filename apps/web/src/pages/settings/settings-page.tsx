import { useState, useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  User,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/contexts/use-auth';
import {
  authApi,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type UpdateProfileData,
  type ChangePasswordData,
  type DeleteAccountData,
} from '@/features/auth/api/auth-api';
import { cn } from '@/lib/utils';

type SettingsTab = 'profile' | 'security' | 'danger';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => {
    const checkHasPassword = async (): Promise<void> => {
      try {
        const result = await authApi.hasPassword();
        setHasPassword(result.hasPassword);
      } catch {
        // Assume has password if check fails
        setHasPassword(true);
      }
    };
    void checkHasPassword();
  }, []);

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'danger' as const, label: 'Danger Zone', icon: Trash2 },
  ];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 p-1 bg-muted/50 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                tab.id === 'danger' &&
                  'text-destructive hover:text-destructive',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="glass rounded-2xl p-6 md:p-8">
        {activeTab === 'profile' && (
          <ProfileSection user={user} onUpdate={refreshUser} />
        )}
        {activeTab === 'security' && (
          <SecuritySection hasPassword={hasPassword} />
        )}
        {activeTab === 'danger' && (
          <DangerZoneSection
            hasPassword={hasPassword}
            onDelete={async () => {
              await logout();
              void navigate('/');
            }}
          />
        )}
      </div>
    </div>
  );
}

interface ProfileSectionProps {
  user: {
    email: string;
    fullName?: string;
    avatarUrl?: string;
    oauthAvatarUrl?: string;
  } | null;
  onUpdate: () => Promise<unknown>;
}

function ProfileSection({ user, onUpdate }: ProfileSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // avatarUrl is the user-uploaded avatar; we only show custom avatar in the editor
  // oauthAvatarUrl is the OAuth provider avatar (Google/GitHub) for fallback display
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  const [prevUserAvatar, setPrevUserAvatar] = useState(user?.avatarUrl);
  if (user?.avatarUrl !== prevUserAvatar) {
    setPrevUserAvatar(user?.avatarUrl);
    setAvatarUrl(user?.avatarUrl ?? '');
  }

  // Handle avatar upload
  const handleAvatarChange = (url: string | undefined) => {
    const newUrl = url ?? '';
    setAvatarUrl(newUrl);
    setValue('avatarUrl', newUrl, { shouldDirty: true });
  };

  const onSubmit = async (data: UpdateProfileData): Promise<void> => {
    try {
      setIsSubmitting(true);
      await authApi.updateProfile(data);
      await onUpdate();
      toast.success('Profile updated successfully');
      reset(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(
        errorMessage ??
          'Unable to update your profile. Please check your information and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">
          Profile Information
        </h2>
        <p className="text-sm text-muted-foreground">
          Update your personal information
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-6"
      >
        {/* Avatar Upload */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground block">
            Profile Photo
          </span>
          <div className="flex items-start gap-6">
            <ImageUpload
              value={avatarUrl}
              onChange={handleAvatarChange}
              placeholder="Upload avatar"
              circular
              type="avatar"
              previewSize={100}
              fallbackUrl={user?.oauthAvatarUrl}
            />
            <div className="flex-1 pt-2">
              <p className="text-sm text-muted-foreground mb-2">
                Upload a profile picture. Recommended: square image, at least
                200x200 pixels.
              </p>
              <p className="text-xs text-muted-foreground">
                Accepted formats: JPEG, PNG, GIF, WebP. Max size: 5MB
              </p>
              {!avatarUrl && user?.oauthAvatarUrl && (
                <p className="text-xs text-primary mt-2">
                  Showing your Google/GitHub avatar. Upload a custom photo to
                  replace it.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Email (Read-only) */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="email"
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <label
            htmlFor="fullName"
            className="text-sm font-medium text-foreground"
          >
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="fullName"
              {...register('fullName')}
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              placeholder="Your full name"
            />
          </div>
          {errors.fullName && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Hidden field for avatarUrl - managed by ImageUpload */}
        <input type="hidden" {...register('avatarUrl')} />

        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="gradient-primary text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

interface SecuritySectionProps {
  hasPassword: boolean;
}

function SecuritySection({ hasPassword }: SecuritySectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordData) => {
    try {
      setIsSubmitting(true);
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully');
      reset();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(
        errorMessage ??
          'Unable to change your password. Please verify your current password and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasPassword) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your account security
          </p>
        </div>

        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">OAuth Account</p>
              <p className="text-sm text-muted-foreground mt-1">
                You signed up using a social login provider (Google or GitHub).
                Password management is not available for OAuth accounts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">
          Change Password
        </h2>
        <p className="text-sm text-muted-foreground">
          Update your password to keep your account secure
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-5"
      >
        {/* Current Password */}
        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="text-sm font-medium text-foreground"
          >
            Current Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="currentPassword"
              {...register('currentPassword')}
              type={showCurrentPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrentPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.currentPassword.message}
            </p>
          )}
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="text-sm font-medium text-foreground"
          >
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="newPassword"
              {...register('newPassword')}
              type={showNewPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Confirm New Password */}
        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-foreground"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="confirmPassword"
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="gradient-primary text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Update Password
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

interface DangerZoneSectionProps {
  hasPassword: boolean;
  onDelete: () => Promise<void>;
}

function DangerZoneSection({ hasPassword, onDelete }: DangerZoneSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<DeleteAccountData>({
    resolver: zodResolver(deleteAccountSchema),
  });

  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  // eslint-disable-next-line react-hooks/incompatible-library
  const confirmation = watch('confirmation');

  const onSubmit = async (data: DeleteAccountData) => {
    try {
      setIsSubmitting(true);
      await authApi.deleteAccount({
        password: data.password,
        confirmation: data.confirmation,
      });
      toast.success('Account deleted successfully');
      await onDelete();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(
        errorMessage ??
          'Unable to delete your account. Please try again or contact support if the problem persists.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-destructive mb-1">
          Danger Zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Irreversible and destructive actions
        </p>
      </div>

      <div className="p-6 border-2 border-destructive/30 rounded-xl bg-destructive/5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-destructive/10 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-2">
              Delete Account
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. All your
              data, including enrolled courses and progress, will be permanently
              deleted.
            </p>

            <form
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              className="space-y-4"
            >
              {hasPassword && (
                <div className="space-y-2">
                  <label
                    htmlFor="deletePassword"
                    className="text-sm font-medium text-foreground"
                  >
                    Confirm Your Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="deletePassword"
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="deleteConfirmation"
                  className="text-sm font-medium text-foreground"
                >
                  Type{' '}
                  <span className="font-mono text-destructive">DELETE</span> to
                  confirm
                </label>
                <input
                  id="deleteConfirmation"
                  {...register('confirmation')}
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-colors font-mono"
                  placeholder="DELETE"
                />
                {errors.confirmation && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmation.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || confirmation !== 'DELETE'}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete My Account
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
