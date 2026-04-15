import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("systeminformation", () => ({
  default: {
    currentLoad: vi.fn(),
    mem: vi.fn(),
    fsSize: vi.fn(),
    osInfo: vi.fn(),
    cpu: vi.fn(),
  },
}));

const mockDocker = {
  listContainers: vi.fn(),
  listImages: vi.fn(),
};

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => mockDocker,
}));

import si from "systeminformation";
import { getSystemStats } from "./stats";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(si.currentLoad).mockResolvedValue({ currentLoad: 42.55 } as never);
  vi.mocked(si.mem).mockResolvedValue({
    active: 4_000_000_000,
    available: 4_000_000_000,
    total: 8_000_000_000,
    free: 500_000_000,
  } as never);
  vi.mocked(si.fsSize).mockResolvedValue([
    { mount: "/boot", size: 100, used: 50, fs: "", type: "", available: 50, use: 50 },
    { mount: "/", size: 1000, used: 500, fs: "", type: "", available: 500, use: 50 },
  ] as never);
  vi.mocked(si.osInfo).mockResolvedValue({
    platform: "linux",
    distro: "Ubuntu",
    release: "22.04",
  } as never);
  vi.mocked(si.cpu).mockResolvedValue({
    cores: 8,
    manufacturer: "Intel",
    brand: "i7",
  } as never);
});

describe("getSystemStats", () => {
  it("assembles a snapshot from systeminformation and docker", async () => {
    mockDocker.listContainers.mockResolvedValue([
      { State: "running" },
      { State: "running" },
      { State: "exited" },
    ]);
    mockDocker.listImages.mockResolvedValue([{ Id: "a" }, { Id: "b" }]);

    const stats = await getSystemStats();
    expect(stats.cpu.load).toBe(42.6);
    expect(stats.cpu.cores).toBe(8);
    expect(stats.mem.used).toBe(4_000_000_000);
    expect(stats.disk.used).toBe(500);
    expect(stats.disk.total).toBe(1000);
    expect(stats.disk.mountpoint).toBe("/");
    expect(stats.os.distro).toBe("Ubuntu");
    expect(stats.docker).toEqual({
      running: 2,
      stopped: 1,
      total: 3,
      images: 2,
    });
  });

  it("handles docker failures gracefully", async () => {
    mockDocker.listContainers.mockRejectedValue(new Error("docker down"));
    mockDocker.listImages.mockRejectedValue(new Error("docker down"));
    const stats = await getSystemStats();
    expect(stats.docker).toEqual({ running: 0, stopped: 0, total: 0, images: 0 });
  });

  it("picks the largest mount when multiple are reported", async () => {
    vi.mocked(si.fsSize).mockResolvedValue([
      { mount: "/a", size: 10, used: 5, fs: "", type: "", available: 5, use: 50 },
      { mount: "/b", size: 9999, used: 100, fs: "", type: "", available: 9899, use: 1 },
    ] as never);
    mockDocker.listContainers.mockResolvedValue([]);
    mockDocker.listImages.mockResolvedValue([]);
    const stats = await getSystemStats();
    expect(stats.disk.mountpoint).toBe("/b");
    expect(stats.disk.total).toBe(9999);
  });
});
