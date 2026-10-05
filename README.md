# reentrancy-guard

A guard against illegal synchronous re-entrant calls.

ReentrancyGuard is useful to prevent a set of functions from being called while another function is executing.

## Installation

```bash
npm install reentrancy-guard
```

## Quick Start

### Your library code

```typescript
import { ReentrancyGuard } from "reentrancy-guard";

const guard = new ReentrancyGuard();

function resetState() {
  guard.assertNotLocked();
}

function updateState(userProvidedHook) {
  guard.assertNotLocked();

  // Activate the guard for the duration of the user provided hook.
  guard.runWithLock(userProvidedHook, "data");

  // Alternatively, create a wrapper of the hook that
  // will automatically lock the guard during its execution.
  // const lockedHook = guard.wrapWithLock(userProvidedHook);
  // lockedHook("data");
}
```

### Library user's code

```typescript
function problematicHook(data: string) {
  // Calling resetState() from inside the hook will throw.
  resetState();

  // Calling updateState() from inside the hook will throw.
  updateState(() => {});
}

// Calling updateState() from outside the hook is allowed.
updateState(problematicHook);

// Calling resetState() from outside the hook is allowed.
resetState();
```

## API Overview

```typescript
guard.isLocked;
guard.assertNotLocked();
result = guard.runWithLock(fn, ...args);
wrappedFn = guard.wrapWithLock(fn);
```

## API Reference

### Class: `ReentrancyGuard`

#### `new ReentrancyGuard()`

Creates a new reentrancy guard instance with `isLocked` initialized to `false`.

#### `guard.isLocked: boolean`

Returns whether the guard is currently locked (`true` while a callback passed to `runWithLock` is executing, `false` otherwise).

#### `guard.assertNotLocked(message?: string): void`

Asserts that the guard is not currently locked.

- Throws an `Error` if `isLocked === true`.
- `message`: Optional custom error message. Defaults to `"Illegal re-entrant call: guard is locked."`.

#### `guard.runWithLock(fn, ...args): TResult`

Executes a synchronous callback while holding the lock to guard against re-entrant calls.

- Sets `isLocked` to `true` during execution and resets it in a `finally` block so that errors thrown by `fn` are not swallowed and the guard state is always restored.
- `fn`: The synchronous function to execute. Enforces `this: void` and disallows `Promise` returns at compile time.
- `...args`: Arguments to pass to `fn`.
- Returns the return value of `fn(...args)`.
- Supports nested calls: internal depth is tracked so `isLocked` remains `true` until the outermost call returns.

#### `guard.wrapWithLock(fn): (...args) => TResult`

Wraps a synchronous callback in a function that will hold the lock for the duration of the callback execution.

- `fn`: The synchronous function to wrap.
- Returns a new function forwarding its arguments to `guard.runWithLock`.
