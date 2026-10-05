import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
  Query,
  Patch,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { AuthProvider } from './entities/external-auth.entity';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { encryptTokenForCookie } from './utils/token-encryption';

import type {
  OAuthProfile,
  ActivationResult,
  MessageResult,
  SafeUser,
} from './auth.service';
import type { RequestWithUser } from '../types/request.interface';
import type { CookieOptions, Response as ExpressResponse } from 'express';

// so we can use 'lax' for better security
const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    // 'lax' is secure and works for same-domain requests (monorepo setup)
    // It also allows cookies on OAuth redirects (top-level navigations)
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  };
};

const COOKIE_OPTIONS = getCookieOptions();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ user: SafeUser; message: string }> {
    const result = await this.authService.login(loginDto);

    // Encrypt JWT token before storing in HTTP-only cookie
    const tokenEncryptionSecret =
      this.configService.get<string>('OAUTH_TOKEN_COOKIE_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'dev-secret-key';

    const encryptedAccessToken = encryptTokenForCookie(
      result.access_token,
      tokenEncryptionSecret,
    );
    res.cookie('access_token', encryptedAccessToken, COOKIE_OPTIONS);

    // Return user data without token (token is in cookie)
    return { user: result.user, message: 'Login successful' };
  }

  @Post('register')
  signUp(
    @Body() createUserDto: CreateUserDto,
  ): Promise<SafeUser & { message: string }> {
    return this.authService.register(createUserDto);
  }

  @Get('activate')
  @HttpCode(HttpStatus.OK)
  async activateAccount(
    @Query('token') token: string,
  ): Promise<ActivationResult> {
    return await this.authService.activateAccount(token);
  }

  @Post('resend-activation')
  @HttpCode(HttpStatus.OK)
  async resendActivationEmail(
    @Body('email') email: string,
  ): Promise<MessageResult> {
    return await this.authService.resendActivationEmail(email);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: ExpressResponse): MessageResult {
    // Clear the cookie
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Logout successful' };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Force account selection by passing prompt parameter
    // This prevents Google from using cached sessions
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @Req() req: RequestWithUser,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const profile = req.user as unknown as OAuthProfile;
      const result = await this.authService.validateOAuthLogin(
        AuthProvider.GOOGLE,
        profile,
      );

      // Encrypt JWT token before storing in HTTP-only cookie
      const tokenEncryptionSecret =
        this.configService.get<string>('OAUTH_TOKEN_COOKIE_SECRET') ??
        this.configService.get<string>('JWT_SECRET') ??
        'dev-secret-key';

      const encryptedAccessToken = encryptTokenForCookie(
        result.access_token,
        tokenEncryptionSecret,
      );
      res.cookie('access_token', encryptedAccessToken, COOKIE_OPTIONS);

      // Redirect to frontend callback page (token is in encrypted cookie, not in URL)
      res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message.includes('blocked')
      ) {
        res.redirect(`${frontendUrl}/blocked`);
      } else {
        // Redirect to login with generic error for other issues
        res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
    }
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubAuth(): void {
    // Initiates the GitHub OAuth flow
  }

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  async githubAuthRedirect(
    @Req() req: RequestWithUser,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const result = await this.authService.validateOAuthLogin(
        AuthProvider.GITHUB,
        req.user as unknown as OAuthProfile,
      );

      // Set HTTP-only cookie - in monorepo deployment, this cookie works directly
      const tokenEncryptionSecret =
        this.configService.get<string>('OAUTH_TOKEN_COOKIE_SECRET') ??
        this.configService.get<string>('JWT_SECRET') ??
        'dev-secret-key';

      const encryptedAccessToken = encryptTokenForCookie(
        result.access_token,
        tokenEncryptionSecret,
      );
      res.cookie('access_token', encryptedAccessToken, COOKIE_OPTIONS);

      // Redirect to frontend callback page (token is in encrypted cookie, not in URL)
      res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message.includes('blocked')
      ) {
        res.redirect(`${frontendUrl}/blocked`);
      } else {
        // Redirect to login with generic error for other issues
        res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User): Promise<User> {
    // Fetch fresh user data from database to get updated role
    const freshUser = await this.authService.getUserById(user.id);

    if (!freshUser.isActive) {
      throw new UnauthorizedException('Your account has been blocked.');
    }

    return freshUser;
  }

  @Post('select-role')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async selectRole(
    @Res({ passthrough: true }) res: ExpressResponse,
    @CurrentUser() user: User,
    @Body() selectRoleDto: SelectRoleDto,
  ): Promise<{ user: SafeUser; accessToken: string; message: string }> {
    const updatedUser = await this.authService.updateUserRole(
      user.id,
      selectRoleDto.role,
    );

    // Generate new JWT token with updated role
    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role ?? 'guest',
    };
    const accessToken = this.authService.signToken(payload);

    // Encrypt new token before storing in HTTP-only cookie
    const tokenEncryptionSecret =
      this.configService.get<string>('OAUTH_TOKEN_COOKIE_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'dev-secret-key';

    const encryptedAccessToken = encryptTokenForCookie(
      accessToken,
      tokenEncryptionSecret,
    );

    // Set new token in HTTP-only cookie
    res.cookie('access_token', encryptedAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    const {
      password: _p,
      activationToken: _at,
      passwordResetToken: _prt,
      ...userWithoutSensitiveData
    } = updatedUser as User & {
      password?: string | null;
      activationToken?: string | null;
      passwordResetToken?: string | null;
    };

    return {
      user: userWithoutSensitiveData,
      accessToken,
      message:
        'Role selected successfully. You can now access instructor features.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<MessageResult> {
    return await this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<MessageResult> {
    return await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResult> {
    return await this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<{ user: User; message: string }> {
    const updatedUser = await this.authService.updateProfile(
      user.id,
      updateProfileDto,
    );
    return {
      user: updatedUser,
      message: 'Profile updated successfully',
    };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() deleteAccountDto: DeleteAccountDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<MessageResult> {
    const result = await this.authService.deleteAccount(
      user.id,
      deleteAccountDto.password,
      deleteAccountDto.confirmation,
    );

    // Clear the auth cookie
    res.clearCookie('access_token', { path: '/' });

    return result;
  }

  @Get('has-password')
  @UseGuards(JwtAuthGuard)
  async hasPassword(
    @CurrentUser() user: User,
  ): Promise<{ hasPassword: boolean }> {
    const hasPassword = await this.authService.hasPassword(user.id);
    return { hasPassword };
  }

  // Dev endpoint - only accessible in non-production environments
  @Get('dev/promote')
  @UseGuards(JwtAuthGuard)
  async promoteToInstructor(
    @CurrentUser() user: User,
  ): Promise<{ message: string; user: SafeUser }> {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'Dev tools are not available in production',
      );
    }
    const updatedUser = await this.authService.updateUserRole(
      user.id,
      UserRole.INSTRUCTOR,
    );
    const {
      password: _p,
      activationToken: _at,
      passwordResetToken: _prt,
      ...safeUser
    } = updatedUser;
    return {
      message: 'Successfully promoted to Instructor. Please return to the app.',
      user: safeUser,
    };
  }
}
