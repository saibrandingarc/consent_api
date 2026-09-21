import { Module } from '@nestjs/common';
import { GeoRegulationService } from './geo-regulation.service';

@Module({
  providers: [GeoRegulationService],
  exports: [GeoRegulationService],
})
export class GeoModule {}
