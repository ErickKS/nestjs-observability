import { randomUUID } from 'node:crypto'

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

  static create({ name }: CreateUserProps): User {
    const id = randomUUID()
    return new User(id, name)
  }
}
