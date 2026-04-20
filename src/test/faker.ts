import { faker } from "@faker-js/faker";

export function username(): string {
  return faker.internet
    .username()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 20);
}

export function password(length = 12): string {
  return faker.internet.password({ length });
}
