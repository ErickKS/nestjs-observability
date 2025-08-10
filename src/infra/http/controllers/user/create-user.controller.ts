import { Body, Controller, HttpCode, Post, UnprocessableEntityException } from '@nestjs/common'
import z from 'zod'
import { CreateUserUseCase } from '@/modules/user/aplication/use-cases/create-user'

const createUserBodySchema = z.object({
  name: z.string().min(1),
})
type CreateUserBodySchema = z.infer<typeof createUserBodySchema>

@Controller('/users')
export class CreateUserController {
  constructor(private readonly createUser: CreateUserUseCase) {}

  @Post()
  @HttpCode(201)
  async handle(@Body() body: CreateUserBodySchema) {
    try {
      const result = await this.createUser.execute(body)
      return { user: result.user }
    } catch (error) {
      throw new UnprocessableEntityException(error.message)
    }
  }
}
