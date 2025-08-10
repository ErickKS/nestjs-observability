import { User } from '../../domain/user'

interface Input {
  name: string
}

interface Output {
  user: User
}

export class CreateUserUseCase {
  async execute(input: Input): Promise<Output> {
    const user = User.create(input)
    return { user }
  }
}
