import { Readable } from "stream";

interface FakeContainer {
  id: string;
  name: string;
  image: string;
  state: "created" | "running" | "exited" | "restarting";
  created: number;
  opts: {
    Image?: string;
    Env?: string[];
    Hostname?: string;
    Cmd?: string[];
    Entrypoint?: string[];
    Labels?: Record<string, string>;
    HostConfig?: {
      PortBindings?: Record<string, Array<{ HostPort: string; HostIp?: string }>>;
      Binds?: string[];
      RestartPolicy?: { Name: string; MaximumRetryCount: number };
      NetworkMode?: string;
      NanoCpus?: number;
      Memory?: number;
    };
  };
}

interface FakeImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

export class FakeDocker {
  private containers = new Map<string, FakeContainer>();
  private images = new Map<string, FakeImage>();
  private nextContainerId = 1;

  addImage(repoTag: string): void {
    const id = `sha256:${repoTag.replace(/[^a-zA-Z0-9]/g, "")}`;
    this.images.set(id, {
      Id: id,
      RepoTags: [repoTag],
      Size: 1000,
      Created: Math.floor(Date.now() / 1000),
    });
  }

  getContainers(): FakeContainer[] {
    return Array.from(this.containers.values());
  }

  async listContainers(opts: { all?: boolean } = {}) {
    return this.getContainers()
      .filter((c) => opts.all || c.state === "running")
      .map((c) => ({
        Id: c.id,
        Names: [`/${c.name}`],
        Image: c.image,
        State: c.state,
        Status: c.state,
        Ports: [],
        Created: c.created,
      }));
  }

  async createContainer(opts: FakeContainer["opts"] & { name: string }) {
    const id = `fake${this.nextContainerId++}`;
    const container: FakeContainer = {
      id,
      name: opts.name,
      image: opts.Image ?? "",
      state: "created",
      created: Math.floor(Date.now() / 1000),
      opts,
    };
    this.containers.set(id, container);
    return this.getContainer(id);
  }

  getContainer(id: string) {
    const store = this.containers;
    const find = () => store.get(id);
    return {
      id,
      start: async () => {
        const c = find();
        if (!c) throw new Error(`No such container: ${id}`);
        c.state = "running";
      },
      stop: async () => {
        const c = find();
        if (!c) throw new Error(`No such container: ${id}`);
        c.state = "exited";
      },
      restart: async () => {
        const c = find();
        if (!c) throw new Error(`No such container: ${id}`);
        c.state = "running";
      },
      remove: async () => {
        if (!store.delete(id)) {
          throw new Error(`No such container: ${id}`);
        }
      },
      inspect: async () => {
        const c = find();
        if (!c) throw new Error(`No such container: ${id}`);
        const hostConfig = c.opts.HostConfig ?? {};
        return {
          Id: c.id,
          Name: `/${c.name}`,
          Config: {
            Image: c.image,
            Env: c.opts.Env ?? [],
            Hostname: c.opts.Hostname ?? "",
            Cmd: c.opts.Cmd ?? [],
            Entrypoint: c.opts.Entrypoint ?? [],
            Labels: c.opts.Labels ?? {},
          },
          State: { Status: c.state },
          Created: new Date(c.created * 1000).toISOString(),
          HostConfig: {
            PortBindings: hostConfig.PortBindings ?? {},
            Binds: hostConfig.Binds ?? [],
            RestartPolicy:
              hostConfig.RestartPolicy ?? { Name: "", MaximumRetryCount: 0 },
            NetworkMode: hostConfig.NetworkMode ?? "default",
            NanoCpus: hostConfig.NanoCpus ?? 0,
            Memory: hostConfig.Memory ?? 0,
          },
          Mounts: [],
        };
      },
      logs: async () => Readable.from([]),
      exec: async () => ({
        start: async () => Readable.from([]),
        inspect: async () => ({ ExitCode: 0 }),
      }),
    };
  }

  async listImages() {
    return Array.from(this.images.values());
  }

  getImage(idOrTag: string) {
    const store = this.images;
    const resolve = () => {
      if (store.has(idOrTag)) return idOrTag;
      for (const [id, img] of store) {
        if (img.RepoTags.includes(idOrTag)) return id;
      }
      return null;
    };
    return {
      remove: async () => {
        const id = resolve();
        if (!id) throw new Error(`No such image: ${idOrTag}`);
        store.delete(id);
      },
    };
  }

  async pull(repoTag: string): Promise<Readable> {
    this.addImage(repoTag);
    return Readable.from([
      JSON.stringify({ status: "Pulling from " + repoTag }) + "\n",
      JSON.stringify({ status: "Complete" }) + "\n",
    ]);
  }

  reset(): void {
    this.containers.clear();
    this.images.clear();
    this.nextContainerId = 1;
  }
}

declare global {
  var __testDocker: FakeDocker | undefined;
}

export function installFakeDocker(): FakeDocker {
  const fake = new FakeDocker();
  globalThis.__testDocker = fake;
  return fake;
}

export function getFakeDocker(): FakeDocker {
  if (!globalThis.__testDocker) {
    throw new Error(
      "Fake Docker not installed. Call installFakeDocker() in beforeEach."
    );
  }
  return globalThis.__testDocker;
}
