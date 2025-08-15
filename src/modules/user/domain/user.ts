import { randomUUID } from 'node:crypto'
import { Span } from '@/infra/observability/decorators/span.decorator'

interface CreateUserProps {
  name: string
}

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _name: string
  ) {}

  get id(): string {
    return this._id
  }

  get name(): string {
    return this._name
  }

  // Use @Span only on methods with relevant business rules, not on simple operations like this one (demonstration purposes only)
  @Span({
    name: 'User.create',
    captureArgs: true,
    captureResult: true,
  })
  static create({ name }: CreateUserProps): User {
    const id = randomUUID()
    return new User(id, name)
  }
}
