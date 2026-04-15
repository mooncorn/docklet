import { getDocker } from "./client";
import type { ImageSummary, PullProgress } from "./types";

export async function listImages(): Promise<ImageSummary[]> {
  const docker = getDocker();
  const images = await docker.listImages();
  return images
    .filter((img) => {
      const tags = img.RepoTags ?? [];
      return tags.length > 0 && tags[0] !== "<none>:<none>";
    })
    .map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags ?? [],
      size: img.Size,
      created: img.Created,
    }));
}

export async function removeImage(
  id: string,
  force = false
): Promise<void> {
  const docker = getDocker();
  await docker.getImage(id).remove({ force });
}

export async function pullImage(
  repoTag: string
): Promise<NodeJS.ReadableStream> {
  const docker = getDocker();
  const stream = await docker.pull(repoTag);
  return stream;
}

export function parsePullProgress(line: string): PullProgress | null {
  try {
    return JSON.parse(line) as PullProgress;
  } catch {
    return null;
  }
}
