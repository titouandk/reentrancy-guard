import { describe, expectTypeOf, it } from "vitest";
import { ReentrancyGuard } from "./ReentrancyGuard.js";

describe("ReentrancyGuard static typing", () => {
  const guard = new ReentrancyGuard();

  it("allows synchronous functions returning primitive values", () => {
    const num = guard.runWithLock(() => 42);
    expectTypeOf(num).toEqualTypeOf<number>();

    const str = guard.runWithLock((a: string) => a.toUpperCase(), "hello");
    expectTypeOf(str).toEqualTypeOf<string>();

    const bool = guard.runWithLock(() => true);
    expectTypeOf(bool).toEqualTypeOf<boolean>();
  });

  it("allows synchronous functions returning void", () => {
    const res = guard.runWithLock(() => {});
    expectTypeOf(res).toEqualTypeOf<void>();
  });

  it("allows synchronous functions returning objects or arrays", () => {
    const obj = guard.runWithLock(() => ({ a: 1 }));
    expectTypeOf(obj).toEqualTypeOf<{ a: number }>();

    const arr = guard.runWithLock(() => [1, 2, 3]);
    expectTypeOf(arr).toEqualTypeOf<number[]>();

    const thenable = guard.runWithLock(() => ({ then: () => {} }));
    expectTypeOf(thenable).toEqualTypeOf<{ then: () => void }>();
  });

  it("infers return types correctly for nested guard.runWithLock invocations", () => {
    const res = guard.runWithLock(() => {
      const inner = guard.runWithLock(() => 42);
      return inner * 2;
    });
    expectTypeOf(res).toEqualTypeOf<number>();
  });

  it("disallows async functions and functions returning Promise", () => {
    // @ts-expect-error - Async functions return Promise and should not be allowed
    guard.runWithLock(async () => 42);

    // @ts-expect-error - Functions returning Promise should not be allowed
    guard.runWithLock(() => Promise.resolve("hello"));

    // @ts-expect-error - Union returning Promise should not be allowed
    guard.runWithLock(() => (Math.random() > 0.5 ? 42 : Promise.resolve(42)));
  });

  it("disallows functions requiring a specific this context unless bound", () => {
    class Service {
      value = 42;
      getValue(this: Service): number {
        return this.value;
      }
    }
    const service = new Service();

    // @ts-expect-error - Unbound method requiring `Service` context should not be allowed
    guard.runWithLock(service.getValue);

    const bound = guard.runWithLock(service.getValue.bind(service));
    expectTypeOf(bound).toEqualTypeOf<number>();

    const arrow = guard.runWithLock(() => service.getValue());
    expectTypeOf(arrow).toEqualTypeOf<number>();
  });

  it("supports wrapWithLock variant with correct types and disallows Promise/unbound this", () => {
    const wrappedNum = guard.wrapWithLock((a: number, b: number) => a + b);
    expectTypeOf(wrappedNum).toEqualTypeOf<(a: number, b: number) => number>();
    expectTypeOf(wrappedNum(1, 2)).toEqualTypeOf<number>();

    const wrappedVoid = guard.wrapWithLock(() => {});
    expectTypeOf(wrappedVoid).toEqualTypeOf<() => void>();

    const wrappedObj = guard.wrapWithLock((id: string) => ({
      id,
      ok: true,
    }));
    expectTypeOf(wrappedObj).toEqualTypeOf<
      (id: string) => { id: string; ok: boolean }
    >();

    // @ts-expect-error - Async functions should not be allowed in wrapWithLock
    guard.wrapWithLock(async () => 42);

    // @ts-expect-error - Functions returning Promise should not be allowed in wrapWithLock
    guard.wrapWithLock(() => Promise.resolve("hello"));

    class Service {
      value = 42;
      getValue(this: Service): number {
        return this.value;
      }
    }
    const service = new Service();

    // @ts-expect-error - Unbound method should not be allowed in wrapWithLock
    guard.wrapWithLock(service.getValue);

    const bound = guard.wrapWithLock(service.getValue.bind(service));
    expectTypeOf(bound).toEqualTypeOf<() => number>();
  });
});
