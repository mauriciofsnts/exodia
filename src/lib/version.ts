import { execSync } from "node:child_process";

// In the Docker image GIT_COMMIT is baked in at build time (no git binary/.git in the
// container). Locally it falls back to running git directly.
export function getCommitHash(): string {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 7);

  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}
