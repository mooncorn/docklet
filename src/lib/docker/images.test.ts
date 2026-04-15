import { describe, it, expect, vi, beforeEach } from "vitest";

const mockImage = {
  remove: vi.fn(),
};

const mockDocker = {
  listImages: vi.fn(),
  getImage: vi.fn(() => mockImage),
  pull: vi.fn(),
};

vi.mock("./client", () => ({
  getDocker: () => mockDocker,
}));

import { listImages, removeImage, parsePullProgress } from "./images";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listImages", () => {
  it("maps dockerode output to ImageSummary", async () => {
    mockDocker.listImages.mockResolvedValue([
      {
        Id: "sha256:abc123",
        RepoTags: ["nginx:latest"],
        Size: 142000000,
        Created: 1700000000,
      },
    ]);

    const result = await listImages();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "sha256:abc123",
      repoTags: ["nginx:latest"],
      size: 142000000,
      created: 1700000000,
    });
  });

  it("filters out <none>:<none> images", async () => {
    mockDocker.listImages.mockResolvedValue([
      {
        Id: "sha256:abc123",
        RepoTags: ["<none>:<none>"],
        Size: 100,
        Created: 1700000000,
      },
      {
        Id: "sha256:def456",
        RepoTags: ["alpine:latest"],
        Size: 7000000,
        Created: 1700000000,
      },
    ]);

    const result = await listImages();
    expect(result).toHaveLength(1);
    expect(result[0].repoTags).toEqual(["alpine:latest"]);
  });

  it("filters out images with no tags", async () => {
    mockDocker.listImages.mockResolvedValue([
      {
        Id: "sha256:abc123",
        RepoTags: undefined,
        Size: 100,
        Created: 1700000000,
      },
    ]);

    const result = await listImages();
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no images", async () => {
    mockDocker.listImages.mockResolvedValue([]);
    const result = await listImages();
    expect(result).toEqual([]);
  });
});

describe("removeImage", () => {
  it("removes an image", async () => {
    mockImage.remove.mockResolvedValue(undefined);
    await removeImage("sha256:abc123");
    expect(mockDocker.getImage).toHaveBeenCalledWith("sha256:abc123");
    expect(mockImage.remove).toHaveBeenCalledWith({ force: false });
  });

  it("force removes an image", async () => {
    mockImage.remove.mockResolvedValue(undefined);
    await removeImage("sha256:abc123", true);
    expect(mockImage.remove).toHaveBeenCalledWith({ force: true });
  });
});

describe("parsePullProgress", () => {
  it("parses valid JSON progress", () => {
    const result = parsePullProgress(
      '{"status":"Pulling fs layer","id":"abc123"}'
    );
    expect(result).toEqual({ status: "Pulling fs layer", id: "abc123" });
  });

  it("parses progress with detail", () => {
    const result = parsePullProgress(
      '{"status":"Downloading","id":"abc123","progressDetail":{"current":1024,"total":4096}}'
    );
    expect(result?.progressDetail).toEqual({ current: 1024, total: 4096 });
  });

  it("returns null for invalid JSON", () => {
    const result = parsePullProgress("not json");
    expect(result).toBeNull();
  });
});
