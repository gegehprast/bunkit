/**
 * Represents a successful result
 */
export class Ok<T> {
  public readonly ok = true as const
  public readonly value: T

  public constructor(value: T) {
    this.value = value
  }

  public isOk(): this is Ok<T> {
    return true
  }

  public isErr(): this is never {
    return false
  }

  public unwrap(): T {
    return this.value
  }

  public unwrapOr<U>(_defaultValue: U): T | U {
    return this.value
  }

  public map<U>(fn: (value: T) => U): Result<U, never> {
    return ok(fn(this.value))
  }

  public mapErr<F extends Error>(_fn: (error: never) => F): Result<T, F> {
    return ok(this.value)
  }

  public andThen<U, F extends Error>(
    fn: (value: T) => Result<U, F>,
  ): Result<U, F> {
    return fn(this.value)
  }
}

/**
 * Represents a failed result
 */
export class Err<E extends Error> {
  public readonly ok = false as const
  public readonly error: E

  public constructor(error: E) {
    this.error = error
  }

  public isOk(): this is never {
    return false
  }

  public isErr(): this is Err<E> {
    return true
  }

  public unwrap(): never {
    throw new Error(
      `Called unwrap on an Err value: ${JSON.stringify(this.error)}`,
    )
  }

  public unwrapOr<T>(defaultValue: T): T {
    return defaultValue
  }

  public map<U>(_fn: (value: never) => U): Result<U, E> {
    return err(this.error)
  }

  public mapErr<F extends Error>(fn: (error: E) => F): Result<never, F> {
    return err(fn(this.error))
  }

  public andThen<U, F extends Error>(
    _fn: (value: never) => Result<U, F>,
  ): Result<U, E | F> {
    return err(this.error)
  }
}

/**
 * Result type that can be either Ok or Err
 */
export type Result<T, E extends Error> = Ok<T> | Err<E>

/**
 * Create a successful result
 */
export function ok<T>(value: T): Ok<T> {
  return new Ok(value)
}

/**
 * Create a failed result
 */
export function err<E extends Error>(error: E): Err<E> {
  return new Err(error)
}

/**
 * Helper to wrap a function that might throw into a Result
 */
export function tryCatch<T, E extends Error = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E,
): Result<T, E> {
  try {
    return ok(fn())
  } catch (error) {
    if (errorHandler) {
      return err(errorHandler(error))
    }
    return err(error as E)
  }
}

/**
 * Helper to wrap an async function that might throw into a Result
 */
export async function tryCatchAsync<T, E extends Error = Error>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await fn())
  } catch (error) {
    if (errorHandler) {
      return err(errorHandler(error))
    }
    return err(error as E)
  }
}
