export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };
export type ErrorResult<E> = Result<undefined, E>;

export function success<T, E>(value: T): Result<T, E>;
export function success<E>(value?: never): ErrorResult<E>;
export function success<T, E>(value: T): Result<T, E> {
  return { success: true, value };
}

export function failure<T, E>(error: E): Result<T, E> {
  return { success: false, error };
}
