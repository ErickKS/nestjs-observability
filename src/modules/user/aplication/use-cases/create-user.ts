import { Span } from '@/infra/observability/decorators/span.decorator'
import { User } from '../../domain/user'

interface Input {
  name: string
}

interface Output {
  user: User
}

export class CreateUserUseCase {
  @Span({
    captureArgs: true,
    captureResult: true,
  })
  async execute(input: Input): Promise<Output> {
    const user = User.create(input)
    return { user }
  }
}
