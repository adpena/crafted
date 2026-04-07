import { describe, it, expect, vi } from "vitest";
import { createRegistry } from "../src/lib/registry.js";

describe("createRegistry", () => {
  it("registers and retrieves a value", () => {
    const reg = createRegistry<string>("test");
    reg.register("foo", "bar");
    expect(reg.get("foo")).toBe("bar");
  });

  it("has returns true for registered keys", () => {
    const reg = createRegistry<number>("test");
    reg.register("count", 42);
    expect(reg.has("count")).toBe(true);
  });

  it("has returns false for unknown keys", () => {
    const reg = createRegistry<number>("test");
    expect(reg.has("missing")).toBe(false);
  });

  it("keys returns all registered keys", () => {
    const reg = createRegistry<string>("test");
    reg.register("a", "1");
    reg.register("b", "2");
    reg.register("c", "3");
    expect(reg.keys()).toEqual(["a", "b", "c"]);
  });

  it("get returns undefined for unknown key", () => {
    const reg = createRegistry<string>("test");
    expect(reg.get("nope")).toBeUndefined();
  });

  it("overwrite warns but succeeds", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reg = createRegistry<string>("myReg");

    reg.register("key", "original");
    reg.register("key", "replacement");

    expect(reg.get("key")).toBe("replacement");
    expect(warnSpy).toHaveBeenCalledWith("[myReg] overwriting existing key: key");

    warnSpy.mockRestore();
  });
});
