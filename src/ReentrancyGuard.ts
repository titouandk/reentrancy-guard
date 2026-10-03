/**
 * @file A synchronous reentrancy guard to detect and prevent illegal recursive or re-entrant calls.
 */

/**
 * A synchronous reentrancy guard that maintains an `isRunning` flag while a callback is executing.
 */
export class ReentrancyGuard {
  #depth = 0;

  /**
   * Returns whether a guarded function is currently running.
   */
  get isRunning(): boolean {
    return this.#depth > 0;
  }

  /**
   * Asserts that no guarded function is currently running.
   *
   * @param message Optional custom error message.
   * @throws {Error} if a guarded function is currently running (`isRunning === true`).
   */
  assertNotRunning(
    message: string = "Illegal re-entrant call: a guarded function is currently running.",
  ): void {
    if (this.isRunning) {
      throw new Error(message);
    }
  }

  /**
   * Executes a synchronous callback while guarding against re-entrant calls.
   *
   * Sets `isRunning` to true during execution and resets it in a `finally` block
   * so that errors thrown by `fn` are not intercepted and the guard state is always restored.
   *
   * @param fn The synchronous function to execute.
   * @param args Arguments to pass to `fn`.
   * @returns The result of calling `fn(...args)`.
   */
  run<TArgs extends unknown[], TResult>(
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
   * Wraps a synchronous callback in a function that guards its execution.
   *
   * @param fn The synchronous function to wrap.
   * @returns A new function that forwards its arguments to `run`.
   */
  wrap<TArgs extends unknown[], TResult>(
    fn: (
      this: void,
      ...args: TArgs
    ) => TResult extends Promise<unknown> ? never : TResult,
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => this.run(fn, ...args);
  }
}
