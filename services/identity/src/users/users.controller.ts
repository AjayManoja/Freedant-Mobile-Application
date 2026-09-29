import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { type AuthUser, CurrentUser, Public, RateLimit, ZodPipe } from '@feedants/server-kit';
import {
  type ImageUploadRequest,
  imageUploadRequestSchema,
  type MeResponse,
  type PublicUser,
  type UpdateProfileInput,
  updateProfileSchema,
  type UploadUrlResponse,
} from '@feedants/shared';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('v1/me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.users.me(user.id);
  }

  @Patch('v1/me')
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<MeResponse> {
    return this.users.update(user.id, body);
  }

  @RateLimit({ name: 'avatar-upload', limit: 20, windowSeconds: 3600, by: 'user' })
  @Post('v1/me/avatar-upload-url')
  @HttpCode(200)
  avatarUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(imageUploadRequestSchema)) body: ImageUploadRequest,
  ): Promise<UploadUrlResponse> {
    return this.users.avatarUploadUrl(user.id, body);
  }

  @Delete('v1/me')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser): Promise<void> {
    await this.users.delete(user.id);
  }

  @Public()
  @Get('v1/users/:id')
  publicProfile(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicUser> {
    return this.users.publicProfile(id);
  }
}
