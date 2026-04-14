import { rm, mkdir } from "fs/promises";

const TEST_DATA_DIR = "./tmp/docklet-e2e-data";

export default async function globalSetup() {
  await rm(TEST_DATA_DIR, { recursive: true, force: true });
  await mkdir(TEST_DATA_DIR, { recursive: true });
}
