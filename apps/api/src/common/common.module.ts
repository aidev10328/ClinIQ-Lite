import { Global, Module } from '@nestjs/common';
import { TimezoneService } from './timezone.service';

@Global()
@Module({
  providers: [TimezoneService],
  exports: [TimezoneService],
})
export class CommonModule {}
