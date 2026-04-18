import { describe, it, expect } from "vitest";
import { faker } from "@faker-js/faker";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("produces a hash distinct from the plaintext input", async () => {
    const password = faker.internet.password({ length: 12 });
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
  });

  it("produces a different hash on each call for the same password", async () => {
    const password = faker.internet.password({ length: 12 });
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true when the correct password is provided", async () => {
    const password = faker.internet.password({ length: 12 });
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("returns false when a wrong password is provided", async () => {
    const password = faker.internet.password({ length: 12 });
    const hash = await hashPassword(password);
    const wrong = faker.internet.password({ length: 12 });
    expect(await verifyPassword(wrong, hash)).toBe(false);
  });
});
