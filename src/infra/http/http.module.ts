import { Module } from '@nestjs/common'
import { CreateUserUseCase } from '@/modules/user/aplication/use-cases/create-user'
import { HealthController } from './controllers/app/health.controller'
import { CreateUserController } from './controllers/user/create-user.controller'

@Module({
  imports: [],
  controllers: [HealthController, CreateUserController],
  providers: [CreateUserUseCase],
})
export class HttpModule {}
