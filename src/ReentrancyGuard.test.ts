import { describe, expect, it, vi } from "vitest";
import { ReentrancyGuard } from "./ReentrancyGuard.js";

describe("ReentrancyGuard", () => {
  it("initializes with isLocked set to false", () => {
    const guard = new ReentrancyGuard();
    expect(guard.isLocked).toBe(false);
  });

  describe("assertNotLocked", () => {
    it("does not throw when the guard is not locked", () => {
      const guard = new ReentrancyGuard();
      expect(() => guard.assertNotLocked()).not.toThrow();
    });

    it("throws an error when the guard is locked", () => {
      const guard = new ReentrancyGuard();

      guard.runWithLock(() => {
        expect(() => guard.assertNotLocked()).toThrow(
          "Illegal re-entrant call: guard is locked.",
        );
      });
    });

    it("throws a custom error message when provided", () => {
      const guard = new ReentrancyGuard();

      guard.runWithLock(() => {
        expect(() => guard.assertNotLocked("Custom reentrancy error")).toThrow(
          "Custom reentrancy error",
        );
      });
    });
  });

  describe("runWithLock", () => {
    it("sets isLocked to true during execution and returns the result", () => {
      const guard = new ReentrancyGuard();
      let lockedDuringExecution: boolean | undefined;

      const fn = vi.fn((a: number, b: number) => {
        lockedDuringExecution = guard.isLocked;
        return a + b;
      });

      const result = guard.runWithLock(fn, 10, 20);

      expect(result).toBe(30);
      expect(fn).toHaveBeenCalledWith(10, 20);
      expect(lockedDuringExecution).toBe(true);
      expect(guard.isLocked).toBe(false);
    });

    it("supports calling zero-argument functions without args", () => {
      const guard = new ReentrancyGuard();
      const fn = vi.fn(() => 42);

      const result = guard.runWithLock(fn);

      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledWith();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invokes the callback with an undefined context", () => {
      const guard = new ReentrancyGuard();
      let wasCalled = false;

      guard.runWithLock(function (this: unknown) {
        wasCalled = true;
        expect(this).toBeUndefined();
      });

      expect(wasCalled).toBe(true);
    });

    it("resets state and propagates errors when fn throws", () => {
      const guard = new ReentrancyGuard();
      const customError = new Error("Something went wrong");

      expect(() =>
        guard.runWithLock(() => {
          expect(guard.isLocked).toBe(true);
          throw customError;
        }),
      ).toThrow(customError);

      expect(guard.isLocked).toBe(false);
    });

    it("supports nested guard.runWithLock calls and keeps isLocked true until outermost call returns", () => {
      const guard = new ReentrancyGuard();
      const executionOrder: string[] = [];

      guard.runWithLock(() => {
        executionOrder.push("outer:start");
        expect(guard.isLocked).toBe(true);

        guard.runWithLock(() => {
          executionOrder.push("inner:exec");
          expect(guard.isLocked).toBe(true);
        });

        executionOrder.push("outer:afterInner");
        expect(guard.isLocked).toBe(true);
      });

      expect(executionOrder).toEqual([
        "outer:start",
        "inner:exec",
        "outer:afterInner",
      ]);
      expect(guard.isLocked).toBe(false);
    });

    it("restores outer locked status if an inner nested call throws", () => {
      const guard = new ReentrancyGuard();
      const error = new Error("Inner error");

      guard.runWithLock(() => {
        expect(guard.isLocked).toBe(true);

        expect(() =>
          guard.runWithLock(() => {
            throw error;
          }),
        ).toThrow(error);

        expect(guard.isLocked).toBe(true);
      });

      expect(guard.isLocked).toBe(false);
    });

    it("returns values correctly across nested calls", () => {
      const guard = new ReentrancyGuard();

      const result = guard.runWithLock(() => {
        const inner1 = guard.runWithLock(() => "hello");
        const inner2 = guard.runWithLock(
          (suffix: string) => `world ${suffix}`,
          "!",
        );
        return `${inner1} ${inner2}`;
      });

      expect(result).toBe("hello world !");
      expect(guard.isLocked).toBe(false);
    });

    it("handles deeply nested calls (3+ levels) and resets state on completion", () => {
      const guard = new ReentrancyGuard();
      const depthLog: boolean[] = [];

      const result = guard.runWithLock(() => {
        depthLog.push(guard.isLocked);
        return guard.runWithLock(() => {
          depthLog.push(guard.isLocked);
          return guard.runWithLock(() => {
            depthLog.push(guard.isLocked);
            return 999;
          });
        });
      });

      expect(result).toBe(999);
      expect(depthLog).toEqual([true, true, true]);
      expect(guard.isLocked).toBe(false);
    });

    it("asserts locked state within any level of nested calls", () => {
      const guard = new ReentrancyGuard();

      guard.runWithLock(() => {
        expect(() => guard.assertNotLocked()).toThrow();

        guard.runWithLock(() => {
          expect(() => guard.assertNotLocked()).toThrow();
        });

        expect(() => guard.assertNotLocked()).toThrow();
      });

      expect(() => guard.assertNotLocked()).not.toThrow();
    });

    it("propagates unhandled errors from inner calls and completely resets isLocked to false", () => {
      const guard = new ReentrancyGuard();
      const error = new Error("Deep error");

      expect(() =>
        guard.runWithLock(() => {
          guard.runWithLock(() => {
            throw error;
          });
        }),
      ).toThrow(error);

      expect(guard.isLocked).toBe(false);
    });
  });

  describe("wrapWithLock", () => {
    it("returns a callable function that sets isLocked to true during execution and returns the result", () => {
      const guard = new ReentrancyGuard();
      let lockedDuringExecution: boolean | undefined;

      const fn = vi.fn((a: number, b: number) => {
        lockedDuringExecution = guard.isLocked;
        return a + b;
      });

      const wrapped = guard.wrapWithLock(fn);
      expect(guard.isLocked).toBe(false);

      const result = wrapped(10, 20);

      expect(result).toBe(30);
      expect(fn).toHaveBeenCalledWith(10, 20);
      expect(lockedDuringExecution).toBe(true);
      expect(guard.isLocked).toBe(false);
    });

    it("can be called multiple times, holding the lock during execution each time", () => {
      const guard = new ReentrancyGuard();
      const wrapped = guard.wrapWithLock((x: number) => {
        expect(guard.isLocked).toBe(true);
        return x * 2;
      });

      expect(guard.isLocked).toBe(false);
      expect(wrapped(2)).toBe(4);
      expect(guard.isLocked).toBe(false);
      expect(wrapped(3)).toBe(6);
      expect(guard.isLocked).toBe(false);
    });

    it("supports zero-argument functions", () => {
      const guard = new ReentrancyGuard();
      const fn = vi.fn(() => 42);
      const wrapped = guard.wrapWithLock(fn);

      expect(wrapped()).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invokes the callback with an undefined context", () => {
      const guard = new ReentrancyGuard();
      let wasCalled = false;

      const wrapped = guard.wrapWithLock(function (this: unknown) {
        wasCalled = true;
        expect(this).toBeUndefined();
      });

      wrapped();
      expect(wasCalled).toBe(true);
    });

    it("resets state and propagates errors when wrapped function throws", () => {
      const guard = new ReentrancyGuard();
      const customError = new Error("Something went wrong");

      const wrapped = guard.wrapWithLock(() => {
        expect(guard.isLocked).toBe(true);
        throw customError;
      });

      expect(() => wrapped()).toThrow(customError);
      expect(guard.isLocked).toBe(false);
    });

    it("supports nested calls between wrapped functions and runWithLock", () => {
      const guard = new ReentrancyGuard();

      const inner = guard.wrapWithLock((msg: string) => {
        expect(guard.isLocked).toBe(true);
        return `inner: ${msg}`;
      });

      const outer = guard.wrapWithLock((msg: string) => {
        expect(guard.isLocked).toBe(true);
        return `outer: ${inner(msg)}`;
      });

      expect(outer("hello")).toBe("outer: inner: hello");
      expect(guard.isLocked).toBe(false);
    });

    it("throws on assertNotLocked within wrapped function execution", () => {
      const guard = new ReentrancyGuard();

      const wrapped = guard.wrapWithLock(() => {
        expect(() => guard.assertNotLocked()).toThrow();
      });

      wrapped();
      expect(() => guard.assertNotLocked()).not.toThrow();
    });
  });
});
