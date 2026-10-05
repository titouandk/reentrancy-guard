/**
 * @file A synchronous reentrancy guard to detect and prevent illegal recursive or re-entrant calls.
 */

/**
 * A synchronous reentrancy guard that maintains an `isLocked` flag while a callback is executing.
 */
export class ReentrancyGuard {
  #depth = 0;

  /**
   * Returns whether the guard is currently locked.
   */
  get isLocked(): boolean {
    return this.#depth > 0;
  }

  /**
   * Asserts that the guard is not currently locked.
   *
   * @param message Optional custom error message.
   * @throws {Error} if the guard is currently locked (`isLocked === true`).
   */
  assertNotLocked(
    message: string = "Illegal re-entrant call: guard is locked.",
  ): void {
    if (this.isLocked) {
      throw new Error(message);
    }
  }

  /**
   * Executes a synchronous callback while holding the lock to guard against re-entrant calls.
   *
   * Sets `isLocked` to true during execution and resets it in a `finally` block
   * so that errors thrown by `fn` are not intercepted and the guard state is always restored.
   *
   * @param fn The synchronous function to execute.
   * @param args Arguments to pass to `fn`.
   * @returns The result of calling `fn(...args)`.
   */
  runWithLock<TArgs extends unknown[], TResult>(
    fn: (
      this: void,
      ...args: TArgs
    ) => TResult extends Promise<unknown> ? never : TResult,
    ...args: TArgs
  ): TResult {
    this.#depth++;
    try {
      return fn.call(undefined, ...args);
    } finally {
      this.#depth--;
    }
  }

  /**
   * Wraps a synchronous callback in a function that will hold the lock for the duration of the callback execution.
   *
   * @param fn The synchronous function to wrap.
   * @returns A new function that forwards its arguments to `runWithLock`.
   */
  wrapWithLock<TArgs extends unknown[], TResult>(
    fn: (
      this: void,
      ...args: TArgs
    ) => TResult extends Promise<unknown> ? never : TResult,
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => this.runWithLock(fn, ...args);
  }
}
