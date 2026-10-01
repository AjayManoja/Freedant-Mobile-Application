import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  RateLimit,
  ZodPipe,
} from '@feedants/server-kit';
import {
  type DraftUpdateInput,
  draftUpdateSchema,
  type HostedQuery,
  hostedQuerySchema,
  type ImageUploadRequest,
  imageUploadRequestSchema,
  type ListQuery,
  listQuerySchema,
  type MediaUploadRequest,
  mediaUploadRequestSchema,
  type MySubmissionsQuery,
  mySubmissionsQuerySchema,
  type ScoreInput,
  scoreSchema,
  type SearchQuery,
  searchQuerySchema,
  type SubmissionUpdateInput,
  submissionUpdateSchema,
} from '@feedants/shared';
import { DiscoveryService } from './discovery/discovery.service';
import { HostingService } from './hosting/hosting.service';
import { IdempotencyKey } from './idempotency';
import { JoinService } from './joining/join.service';
import { JudgingService } from './judging/judging.service';
import { SubmissionsService } from './submissions/submissions.service';

const uuid = new ParseUUIDPipe();

@Controller('v1')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.discovery.categories();
  }

  @OptionalAuth()
  @Get('home')
  home(@MaybeUser() user?: AuthUser) {
    return this.discovery.home(user?.id);
  }

  @Public()
  @Get('competitions')
  list(@Query(new ZodPipe(listQuerySchema)) q: ListQuery) {
    return this.discovery.list(q);
  }

  @Public()
  @Get('search')
  search(@Query(new ZodPipe(searchQuerySchema)) q: SearchQuery) {
    return this.discovery.search(q);
  }

  @OptionalAuth()
  @Get('competitions/:id')
  detail(@Param('id', uuid) id: string, @MaybeUser() user?: AuthUser) {
    return this.discovery.detail(id, user?.id);
  }

  @Public()
  @Get('hosts/top')
  topHosts() {
    return this.discovery.topHosts(20);
  }

  @Public()
  @Get('winners/:userId')
  winner(@Param('userId', uuid) userId: string) {
    return this.discovery.winnerProfile(userId);
  }

  @Public()
  @Get('users/:userId/stats')
  stats(@Param('userId', uuid) userId: string) {
    return this.discovery.userStats(userId);
  }

  @Put('competitions/:id/notify')
  notifyOn(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.discovery.setNotify(user.id, id, true);
  }

  @Delete('competitions/:id/notify')
  notifyOff(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.discovery.setNotify(user.id, id, false);
  }
}

@Controller('v1')
export class HostingController {
  constructor(private readonly hosting: HostingService) {}

  @Post('competitions')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(draftUpdateSchema)) body: DraftUpdateInput) {
    return this.hosting.createDraft(user.id, body);
  }

  @Patch('competitions/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(draftUpdateSchema)) body: DraftUpdateInput,
  ) {
    return this.hosting.update(user.id, id, body);
  }

  @RateLimit({ name: 'cover-upload', limit: 30, windowSeconds: 3600, by: 'user' })
  @Post('competitions/:id/cover-upload-url')
  @HttpCode(200)
  coverUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(imageUploadRequestSchema)) body: ImageUploadRequest,
  ) {
    return this.hosting.coverUploadUrl(user.id, id, body);
  }

  @Post('competitions/:id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @IdempotencyKey() key: string) {
    return this.hosting.publish(user.id, id, key);
  }

  @Delete('competitions/:id/funding')
  abandonFunding(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.hosting.abandonFunding(user.id, id);
  }

  @Post('competitions/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.hosting.cancel(user.id, id);
  }

  @Get('me/competitions')
  hosted(@CurrentUser() user: AuthUser, @Query(new ZodPipe(hostedQuerySchema)) q: HostedQuery) {
    return this.hosting.hosted(user.id, q);
  }

  @Get('me/competitions/summary')
  hostedSummary(@CurrentUser() user: AuthUser) {
    return this.hosting.hostedSummary(user.id);
  }
}

@Controller('v1')
export class ParticipationController {
  constructor(
    private readonly joins: JoinService,
    private readonly submissions: SubmissionsService,
  ) {}

  @RateLimit({ name: 'join', limit: 20, windowSeconds: 60, by: 'user' })
  @Post('competitions/:id/join')
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @IdempotencyKey() key: string) {
    return this.joins.join(user.id, id, key);
  }

  @Get('registrations/:id')
  registration(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.joins.get(user.id, id);
  }

  @Get('registrations/:id/submission')
  submission(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.submissions.getOrCreate(user.id, id);
  }

  @Patch('registrations/:id/submission')
  updateSubmission(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(submissionUpdateSchema)) body: SubmissionUpdateInput,
  ) {
    return this.submissions.update(user.id, id, body);
  }

  @RateLimit({ name: 'media-upload', limit: 30, windowSeconds: 3600, by: 'user' })
  @Post('registrations/:id/submission/media-upload-url')
  @HttpCode(200)
  mediaUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(mediaUploadRequestSchema)) body: MediaUploadRequest,
  ) {
    return this.submissions.uploadUrl(user.id, id, body);
  }

  @Post('registrations/:id/submission/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.submissions.submit(user.id, id);
  }

  @Get('me/submissions')
  mySubmissions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(mySubmissionsQuerySchema)) q: MySubmissionsQuery,
  ) {
    return this.submissions.mine(user.id, q);
  }

  @Get('me/submissions/summary')
  mySubmissionsSummary(@CurrentUser() user: AuthUser) {
    return this.submissions.summary(user.id);
  }
}

@Controller('v1')
export class JudgingController {
  constructor(private readonly judging: JudgingService) {}

  @Get('competitions/:id/entries')
  entries(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.judging.entries(user.id, id);
  }

  @Put('submissions/:id/score')
  score(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(scoreSchema)) body: ScoreInput,
  ) {
    return this.judging.score(user.id, id, body);
  }

  @Post('competitions/:id/results')
  @HttpCode(200)
  publishResults(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.judging.publishResults(user.id, id);
  }

  @Public()
  @Get('competitions/:id/leaderboard')
  leaderboard(@Param('id', uuid) id: string) {
    return this.judging.leaderboard(id);
  }
}
