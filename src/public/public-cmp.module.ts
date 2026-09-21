import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { BlockingModule } from '../blocking/blocking.module';
import { GeoModule } from '../geo/geo.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { PublicCmpController } from './public-cmp.controller';

@Module({
  imports: [ConsentModule, BlockingModule, GeoModule, WebhooksModule, EnterpriseModule],
  controllers: [PublicCmpController],
})
export class PublicCmpModule {}
