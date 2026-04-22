import { describe, it, expect, vi, beforeEach } from "vitest";
import { faker } from "@faker-js/faker";

const mockContainer = {
  inspect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  remove: vi.fn(),
  logs: vi.fn(),
  exec: vi.fn(),
};

const mockDocker = {
  listContainers: vi.fn(),
  getContainer: vi.fn(() => mockContainer),
  createContainer: vi.fn(),
};

vi.mock("./client", () => ({
  getDocker: () => mockDocker,
}));

let mockHostDataDir = "/docklet-data";

vi.mock("@/lib/db", () => ({
  getDataDir: () => "/docklet-data",
  getHostDataDir: () => mockHostDataDir,
}));

vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
}));

import {
  listContainers,
  inspectContainer,
  createContainer,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  buildCreateOptions,
  resolveVolumePath,
} from "./containers";

beforeEach(() => {
  vi.clearAllMocks();
  mockHostDataDir = "/docklet-data";
});

describe("listContainers", () => {
  it("maps dockerode output to ContainerSummary", async () => {
    mockDocker.listContainers.mockResolvedValue([
      {
        Id: "abc123",
        Names: ["/my-container"],
        Image: "nginx:latest",
        State: "running",
        Status: "Up 3 hours",
        Ports: [
          { PrivatePort: 80, PublicPort: 8080, Type: "tcp", IP: "0.0.0.0" },
        ],
        Created: 1700000000,
      },
    ]);

    const result = await listContainers();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "abc123",
      name: "my-container",
      image: "nginx:latest",
      state: "running",
      status: "Up 3 hours",
      ports: [
        { containerPort: 80, hostPort: 8080, protocol: "tcp", hostIp: "0.0.0.0" },
      ],
      created: 1700000000,
    });
  });

  it("when docker returns a container with leading slash in name — strips the slash", async () => {
    mockDocker.listContainers.mockResolvedValue([
      {
        Id: "def456",
        Names: ["/test"],
        Image: "alpine",
        State: "exited",
        Status: "Exited (0) 2 hours ago",
        Ports: [],
        Created: 1700000000,
      },
    ]);

    const result = await listContainers();
    expect(result[0].name).toBe("test");
  });

  it("when docker returns no containers — returns empty array", async () => {
    mockDocker.listContainers.mockResolvedValue([]);
    const result = await listContainers();
    expect(result).toEqual([]);
  });
});

describe("inspectContainer", () => {
  it("maps inspect output to ContainerDetail", async () => {
    mockContainer.inspect.mockResolvedValue({
      Id: "abc123",
      Name: "/my-container",
      Created: "2024-01-01T00:00:00Z",
      State: { Status: "running" },
      Config: {
        Image: "nginx:latest",
        Env: ["FOO=bar"],
        Hostname: "myhost",
        Cmd: ["nginx", "-g", "daemon off;"],
        Entrypoint: ["/docker-entrypoint.sh"],
        Labels: { app: "web" },
      },
      Mounts: [
        {
          Source: "/host/path",
          Destination: "/container/path",
          Mode: "rw",
          RW: true,
        },
      ],
      HostConfig: {
        PortBindings: {
          "80/tcp": [{ HostPort: "8080", HostIp: "0.0.0.0" }],
        },
        RestartPolicy: { Name: "always", MaximumRetryCount: 0 },
        NetworkMode: "bridge",
        NanoCpus: 1000000000,
        Memory: 536870912,
      },
    });

    const result = await inspectContainer("abc123");
    expect(result).toMatchObject({
      id: "abc123",
      name: "my-container",
      image: "nginx:latest",
      state: "running",
      env: ["FOO=bar"],
      hostname: "myhost",
      cmd: ["nginx", "-g", "daemon off;"],
      mounts: [{ source: "/host/path" }],
      ports: [{ containerPort: 80, hostPort: 8080, protocol: "tcp", hostIp: "0.0.0.0" }],
      restartPolicy: { name: "always", maximumRetryCount: 0 },
      resources: { cpuLimit: 1, memoryLimit: 536870912 },
      labels: { app: "web" },
    });
  });
});

describe("buildCreateOptions", () => {
  it("builds basic options", () => {
    const name = faker.word.noun();
    const image = `${faker.word.noun()}:latest`;
    const opts = buildCreateOptions({ name, image });
    expect(opts.name).toBe(name);
    expect(opts.Image).toBe(image);
  });

  it("builds port bindings", () => {
    const opts = buildCreateOptions({
      name: faker.word.noun(),
      image: "nginx",
      ports: [{ containerPort: 80, hostPort: 8080, protocol: "tcp" }],
    });
    expect(opts.ExposedPorts).toEqual({ "80/tcp": {} });
    expect(opts.HostConfig?.PortBindings).toEqual({
      "80/tcp": [{ HostPort: "8080" }],
    });
  });

  it("builds volume binds from pre-resolved volumes", () => {
    const opts = buildCreateOptions({
      name: faker.word.noun(),
      image: "nginx",
      volumes: [{ hostPath: "/docklet-data/volumes/test/app/data", containerPath: "/app/data", mode: "ro" }],
    });
    expect(opts.HostConfig?.Binds).toEqual([
      "/docklet-data/volumes/test/app/data:/app/data:ro",
    ]);
  });

  it("builds resource limits", () => {
    const opts = buildCreateOptions({
      name: faker.word.noun(),
      image: "nginx",
      resources: { cpuLimit: 2, memoryLimit: 1073741824 },
    });
    expect(opts.HostConfig?.NanoCpus).toBe(2e9);
    expect(opts.HostConfig?.Memory).toBe(1073741824);
  });

  it("builds restart policy", () => {
    const opts = buildCreateOptions({
      name: faker.word.noun(),
      image: "nginx",
      restartPolicy: { name: "on-failure", maximumRetryCount: 5 },
    });
    expect(opts.HostConfig?.RestartPolicy).toEqual({
      Name: "on-failure",
      MaximumRetryCount: 5,
    });
  });
});

describe("container actions", () => {
  it("starts a container", async () => {
    mockContainer.start.mockResolvedValue(undefined);
    await startContainer("abc123");
    expect(mockDocker.getContainer).toHaveBeenCalledWith("abc123");
    expect(mockContainer.start).toHaveBeenCalled();
  });

  it("stops a container", async () => {
    mockContainer.stop.mockResolvedValue(undefined);
    await stopContainer("abc123");
    expect(mockContainer.stop).toHaveBeenCalled();
  });

  it("restarts a container", async () => {
    mockContainer.restart.mockResolvedValue(undefined);
    await restartContainer("abc123");
    expect(mockContainer.restart).toHaveBeenCalled();
  });

  it("removes a container", async () => {
    mockContainer.remove.mockResolvedValue(undefined);
    await removeContainer("abc123");
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: false });
  });

  it("force removes a container", async () => {
    mockContainer.remove.mockResolvedValue(undefined);
    await removeContainer("abc123", true);
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });
});

describe("createContainer", () => {
  it("creates and returns container id", async () => {
    mockDocker.createContainer.mockResolvedValue({ id: "new123" });
    const result = await createContainer({
      name: "test",
      image: "nginx:latest",
    });
    expect(result.id).toBe("new123");
    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "test", Image: "nginx:latest" })
    );
  });

  it("resolves volume paths and creates directories", async () => {
    const { mkdirSync } = await import("fs");
    mockDocker.createContainer.mockResolvedValue({ id: "vol123" });
    await createContainer({
      name: "mc-server",
      image: "itzg/minecraft-server",
      volumes: [{ containerPath: "/data" }],
    });
    expect(mkdirSync).toHaveBeenCalledWith(
      "/docklet-data/volumes/mc-server/data",
      { recursive: true }
    );
    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        HostConfig: expect.objectContaining({
          Binds: ["/docklet-data/volumes/mc-server/data:/data:rw"],
        }),
      })
    );
  });

  it("when HOST_DATA_DIR differs from DOCKLET_DATA_DIR — bind mount uses host path", async () => {
    mockHostDataDir = "/Users/david/docklet-data";
    mockDocker.createContainer.mockResolvedValue({ id: "host123" });

    await createContainer({
      name: "myapp",
      image: "nginx",
      volumes: [{ containerPath: "/var/www" }],
    });

    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        HostConfig: expect.objectContaining({
          Binds: ["/Users/david/docklet-data/volumes/myapp/var/www:/var/www:rw"],
        }),
      })
    );
  });
});

describe("resolveVolumePath", () => {
  it("resolves a simple container path", () => {
    expect(resolveVolumePath("mc-server", "/data")).toBe(
      "/docklet-data/volumes/mc-server/data"
    );
  });

  it("resolves a nested container path", () => {
    expect(resolveVolumePath("my-app", "/config/nginx")).toBe(
      "/docklet-data/volumes/my-app/config/nginx"
    );
  });

  it("strips multiple leading slashes", () => {
    expect(resolveVolumePath("app", "//data")).toBe(
      "/docklet-data/volumes/app/data"
    );
  });

  it("when path traverses above root with leading segment — throws Invalid volume path", () => {
    expect(() => resolveVolumePath("app", "/../etc")).toThrow("Invalid volume path");
  });

  it("when path traverses above root mid-path — throws Invalid volume path", () => {
    expect(() => resolveVolumePath("app", "/data/../etc")).toThrow("Invalid volume path");
  });
});
