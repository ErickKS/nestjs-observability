import { Controller, Get, HttpCode } from '@nestjs/common'

@Controller('/health')
export class HealthController {
  @Get()
  @HttpCode(200)
  handle(): string {
    return 'OK'
  }
}
