import { describe, expectTypeOf, it } from "vitest";
import { ReentrancyGuard } from "./ReentrancyGuard.js";

describe("ReentrancyGuard static typing", () => {
  const guard = new ReentrancyGuard();

  it("allows synchronous functions returning primitive values", () => {
    const num = guard.run(() => 42);
    expectTypeOf(num).toEqualTypeOf<number>();

    const str = guard.run((a: string) => a.toUpperCase(), "hello");
    expectTypeOf(str).toEqualTypeOf<string>();

    const bool = guard.run(() => true);
    expectTypeOf(bool).toEqualTypeOf<boolean>();
  });

  it("allows synchronous functions returning void", () => {
    const res = guard.run(() => {});
    expectTypeOf(res).toEqualTypeOf<void>();
  });

  it("allows synchronous functions returning objects or arrays", () => {
    const obj = guard.run(() => ({ a: 1 }));
    expectTypeOf(obj).toEqualTypeOf<{ a: number }>();

    const arr = guard.run(() => [1, 2, 3]);
    expectTypeOf(arr).toEqualTypeOf<number[]>();

    const thenable = guard.run(() => ({ then: () => {} }));
    expectTypeOf(thenable).toEqualTypeOf<{ then: () => void }>();
  });

  it("infers return types correctly for nested guard.run invocations", () => {
    const res = guard.run(() => {
      const inner = guard.run(() => 42);
      return inner * 2;
    });
    expectTypeOf(res).toEqualTypeOf<number>();
  });

  it("disallows async functions and functions returning Promise", () => {
    // @ts-expect-error - Async functions return Promise and should not be allowed
    guard.run(async () => 42);

    // @ts-expect-error - Functions returning Promise should not be allowed
    guard.run(() => Promise.resolve("hello"));

    // @ts-expect-error - Union returning Promise should not be allowed
    guard.run(() => (Math.random() > 0.5 ? 42 : Promise.resolve(42)));
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
    guard.run(service.getValue);

    const bound = guard.run(service.getValue.bind(service));
    expectTypeOf(bound).toEqualTypeOf<number>();

    const arrow = guard.run(() => service.getValue());
    expectTypeOf(arrow).toEqualTypeOf<number>();
  });

  it("supports wrap variant with correct types and disallows Promise/unbound this", () => {
    const wrappedNum = guard.wrap((a: number, b: number) => a + b);
    expectTypeOf(wrappedNum).toEqualTypeOf<(a: number, b: number) => number>();
    expectTypeOf(wrappedNum(1, 2)).toEqualTypeOf<number>();

    const wrappedVoid = guard.wrap(() => {});
    expectTypeOf(wrappedVoid).toEqualTypeOf<() => void>();

    const wrappedObj = guard.wrap((id: string) => ({
      id,
      ok: true,
    }));
    expectTypeOf(wrappedObj).toEqualTypeOf<
      (id: string) => { id: string; ok: boolean }
    >();

    // @ts-expect-error - Async functions should not be allowed in wrap
    guard.wrap(async () => 42);

    // @ts-expect-error - Functions returning Promise should not be allowed in wrap
    guard.wrap(() => Promise.resolve("hello"));

    class Service {
      value = 42;
      getValue(this: Service): number {
        return this.value;
      }
    }
    const service = new Service();

    // @ts-expect-error - Unbound method should not be allowed in wrap
    guard.wrap(service.getValue);

    const bound = guard.wrap(service.getValue.bind(service));
    expectTypeOf(bound).toEqualTypeOf<() => number>();
  });
});
