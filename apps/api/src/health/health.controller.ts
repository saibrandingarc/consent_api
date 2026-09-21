import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ok } from '../common/utils/response';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return ok({ status: 'ok', timestamp: new Date().toISOString() });
  }
}
