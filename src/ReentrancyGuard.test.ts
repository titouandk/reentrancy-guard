import { describe, expect, it, vi } from "vitest";
import { ReentrancyGuard } from "./ReentrancyGuard.js";

describe("ReentrancyGuard", () => {
  it("initializes with isRunning set to false", () => {
    const guard = new ReentrancyGuard();
    expect(guard.isRunning).toBe(false);
  });

  describe("assertNotRunning", () => {
    it("does not throw when no guarded function is running", () => {
      const guard = new ReentrancyGuard();
      expect(() => guard.assertNotRunning()).not.toThrow();
    });

    it("throws an error when a guarded function is running", () => {
      const guard = new ReentrancyGuard();

      guard.run(() => {
        expect(() => guard.assertNotRunning()).toThrow(
          "Illegal re-entrant call: a guarded function is currently running.",
        );
      });
    });

    it("throws a custom error message when provided", () => {
      const guard = new ReentrancyGuard();

      guard.run(() => {
        expect(() => guard.assertNotRunning("Custom reentrancy error")).toThrow(
          "Custom reentrancy error",
        );
      });
    });
  });

  describe("run", () => {
    it("sets isRunning to true during execution and returns the result", () => {
      const guard = new ReentrancyGuard();
      let runningDuringExecution: boolean | undefined;

      const fn = vi.fn((a: number, b: number) => {
        runningDuringExecution = guard.isRunning;
        return a + b;
      });

      const result = guard.run(fn, 10, 20);

      expect(result).toBe(30);
      expect(fn).toHaveBeenCalledWith(10, 20);
      expect(runningDuringExecution).toBe(true);
      expect(guard.isRunning).toBe(false);
    });

    it("supports calling zero-argument functions without args", () => {
      const guard = new ReentrancyGuard();
      const fn = vi.fn(() => 42);

      const result = guard.run(fn);

      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledWith();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invokes the callback with an undefined context", () => {
      const guard = new ReentrancyGuard();
      let wasCalled = false;

      guard.run(function (this: unknown) {
        wasCalled = true;
        expect(this).toBeUndefined();
      });

      expect(wasCalled).toBe(true);
    });

    it("resets state and propagates errors when fn throws", () => {
      const guard = new ReentrancyGuard();
      const customError = new Error("Something went wrong");

      expect(() =>
        guard.run(() => {
          expect(guard.isRunning).toBe(true);
          throw customError;
        }),
      ).toThrow(customError);

      expect(guard.isRunning).toBe(false);
    });

    it("supports nested guard.run calls and keeps isRunning true until outermost call returns", () => {
      const guard = new ReentrancyGuard();
      const executionOrder: string[] = [];

      guard.run(() => {
        executionOrder.push("outer:start");
        expect(guard.isRunning).toBe(true);

        guard.run(() => {
          executionOrder.push("inner:exec");
          expect(guard.isRunning).toBe(true);
        });

        executionOrder.push("outer:afterInner");
        expect(guard.isRunning).toBe(true);
      });

      expect(executionOrder).toEqual([
        "outer:start",
        "inner:exec",
        "outer:afterInner",
      ]);
      expect(guard.isRunning).toBe(false);
    });

    it("restores outer running status if an inner nested call throws", () => {
      const guard = new ReentrancyGuard();
      const error = new Error("Inner error");

      guard.run(() => {
        expect(guard.isRunning).toBe(true);

        expect(() =>
          guard.run(() => {
            throw error;
          }),
        ).toThrow(error);

        expect(guard.isRunning).toBe(true);
      });

      expect(guard.isRunning).toBe(false);
    });

    it("returns values correctly across nested calls", () => {
      const guard = new ReentrancyGuard();

      const result = guard.run(() => {
        const inner1 = guard.run(() => "hello");
        const inner2 = guard.run((suffix: string) => `world ${suffix}`, "!");
        return `${inner1} ${inner2}`;
      });

      expect(result).toBe("hello world !");
      expect(guard.isRunning).toBe(false);
    });

    it("handles deeply nested calls (3+ levels) and resets state on completion", () => {
      const guard = new ReentrancyGuard();
      const depthLog: boolean[] = [];

      const result = guard.run(() => {
        depthLog.push(guard.isRunning);
        return guard.run(() => {
          depthLog.push(guard.isRunning);
          return guard.run(() => {
            depthLog.push(guard.isRunning);
            return 999;
          });
        });
      });

      expect(result).toBe(999);
      expect(depthLog).toEqual([true, true, true]);
      expect(guard.isRunning).toBe(false);
    });

    it("asserts running state within any level of nested calls", () => {
      const guard = new ReentrancyGuard();

      guard.run(() => {
        expect(() => guard.assertNotRunning()).toThrow();

        guard.run(() => {
          expect(() => guard.assertNotRunning()).toThrow();
        });

        expect(() => guard.assertNotRunning()).toThrow();
      });

      expect(() => guard.assertNotRunning()).not.toThrow();
    });

    it("propagates unhandled errors from inner calls and completely resets isRunning to false", () => {
      const guard = new ReentrancyGuard();
      const error = new Error("Deep error");

      expect(() =>
        guard.run(() => {
          guard.run(() => {
            throw error;
          });
        }),
      ).toThrow(error);

      expect(guard.isRunning).toBe(false);
    });
  });

  describe("wrap", () => {
    it("returns a callable function that sets isRunning to true during execution and returns the result", () => {
      const guard = new ReentrancyGuard();
      let runningDuringExecution: boolean | undefined;

      const fn = vi.fn((a: number, b: number) => {
        runningDuringExecution = guard.isRunning;
        return a + b;
      });

      const wrapped = guard.wrap(fn);
      expect(guard.isRunning).toBe(false);

      const result = wrapped(10, 20);

      expect(result).toBe(30);
      expect(fn).toHaveBeenCalledWith(10, 20);
      expect(runningDuringExecution).toBe(true);
      expect(guard.isRunning).toBe(false);
    });

    it("can be called multiple times, properly guarding execution each time", () => {
      const guard = new ReentrancyGuard();
      const wrapped = guard.wrap((x: number) => {
        expect(guard.isRunning).toBe(true);
        return x * 2;
      });

      expect(guard.isRunning).toBe(false);
      expect(wrapped(2)).toBe(4);
      expect(guard.isRunning).toBe(false);
      expect(wrapped(3)).toBe(6);
      expect(guard.isRunning).toBe(false);
    });

    it("supports zero-argument functions", () => {
      const guard = new ReentrancyGuard();
      const fn = vi.fn(() => 42);
      const wrapped = guard.wrap(fn);

      expect(wrapped()).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invokes the callback with an undefined context", () => {
      const guard = new ReentrancyGuard();
      let wasCalled = false;

      const wrapped = guard.wrap(function (this: unknown) {
        wasCalled = true;
        expect(this).toBeUndefined();
      });

      wrapped();
      expect(wasCalled).toBe(true);
    });

    it("resets state and propagates errors when wrapped function throws", () => {
      const guard = new ReentrancyGuard();
      const customError = new Error("Something went wrong");

      const wrapped = guard.wrap(() => {
        expect(guard.isRunning).toBe(true);
        throw customError;
      });

      expect(() => wrapped()).toThrow(customError);
      expect(guard.isRunning).toBe(false);
    });

    it("supports nested calls between wrapped functions and run", () => {
      const guard = new ReentrancyGuard();

      const inner = guard.wrap((msg: string) => {
        expect(guard.isRunning).toBe(true);
        return `inner: ${msg}`;
      });

      const outer = guard.wrap((msg: string) => {
        expect(guard.isRunning).toBe(true);
        return `outer: ${inner(msg)}`;
      });

      expect(outer("hello")).toBe("outer: inner: hello");
      expect(guard.isRunning).toBe(false);
    });

    it("throws on assertNotRunning within wrapped function execution", () => {
      const guard = new ReentrancyGuard();

      const wrapped = guard.wrap(() => {
        expect(() => guard.assertNotRunning()).toThrow();
      });

      wrapped();
      expect(() => guard.assertNotRunning()).not.toThrow();
    });
  });
});
