import Dockerode from "dockerode";
import { getDockerSocket } from "@/lib/config";

let docker: Dockerode | null = null;

export function getDocker(): Dockerode {
  if (!docker) {
    docker = new Dockerode({ socketPath: getDockerSocket() });
  }
  return docker;
}
