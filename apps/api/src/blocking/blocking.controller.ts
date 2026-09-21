import { Controller, Get, Param } from '@nestjs/common';
import { PERMISSIONS } from '@cmp/auth';
import type { CurrentUser } from '@cmp/types';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { BlockingService } from './blocking.service';

@Controller('domains/:domainId/blocking')
export class BlockingController {
  constructor(private readonly blockingService: BlockingService) {}

  @Get('violations')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listViolations(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.blockingService.listViolations(user, domainId).then(ok);
  }

  @Get('rules')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listRules(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.blockingService.listRules(user, domainId).then(ok);
  }
}
