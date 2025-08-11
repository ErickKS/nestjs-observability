import { Module } from '@nestjs/common'
import { HttpModule } from './http/http.module'
import { ObservabilityModule } from './observability/observability.module'

@Module({
  imports: [HttpModule, ObservabilityModule],
})
export class AppModule {}
