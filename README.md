# reentrancy-guard

A synchronous guard against illegal re-entrant calls.

## Installation

```bash
npm install reentrancy-guard
```

## Quick Start

### Your library code

```typescript
import { ReentrancyGuard } from "reentrancy-guard";

const guard = new ReentrancyGuard();

function updateState(userProvidedHook) {
  guard.assertNotRunning();

  // ...
  guard.run(userProvidedHook, "data");
  // ...
}
```

### Library user's code

```typescript
function problematicHook(data: string) {
  updateState(() => {
    // This will throw: Illegal re-entrant call: a guarded function is currently running.
    // A hook cannot call updateState() again.
  });
}

updateState(problematicHook);
```

## API Overview

```typescript
guard.isRunning;
guard.assertNotRunning();
result = guard.run(fn, ...args);
wrappedFn = guard.wrap(fn);
```

## API Reference

### Class: `ReentrancyGuard`

#### `new ReentrancyGuard()`

Creates a new reentrancy guard instance with `isRunning` initialized to `false`.

#### `guard.isRunning: boolean`

Returns whether a guarded function is currently running (`true` while a guarded callback is executing, `false` otherwise).

#### `guard.assertNotRunning(message?: string): void`

Asserts that no guarded function is currently running.

- Throws an `Error` if `isRunning === true`.
- `message`: Optional custom error message. Defaults to `"Illegal re-entrant call: a guarded function is currently running."`.

#### `guard.run(fn, ...args): TResult`

Executes a synchronous callback while guarding against re-entrant calls.

- Sets `isRunning` to `true` during execution and resets it in a `finally` block so that errors thrown by `fn` are not swallowed and the guard state is always restored.
- `fn`: The synchronous function to execute. Enforces `this: void` and disallows `Promise` returns at compile time.
- `...args`: Arguments to pass to `fn`.
- Returns the return value of `fn(...args)`.
- Supports nested calls: internal depth is tracked so `isRunning` remains `true` until the outermost call returns.

#### `guard.wrap(fn): (...args) => TResult`

Wraps a synchronous callback in a function that guards its execution.

- `fn`: The synchronous function to wrap.
- Returns a new function forwarding its arguments to `guard.run`.
