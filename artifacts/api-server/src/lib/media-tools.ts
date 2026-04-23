import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let toolCheckPromise: Promise<void> | null = null;

async function assertToolAvailable(toolName: "ffmpeg" | "ffprobe"): Promise<void> {
  try {
    await execAsync(`command -v ${toolName}`);
  } catch {
    throw new Error(
      `[MISSING_MEDIA_TOOL] Required binary "${toolName}" was not found in PATH. ` +
        `Install FFmpeg (which includes ffprobe) and restart the API server.`,
    );
  }
}

export async function ensureMediaToolsAvailable(): Promise<void> {
  if (!toolCheckPromise) {
    toolCheckPromise = (async () => {
      await assertToolAvailable("ffmpeg");
      await assertToolAvailable("ffprobe");
    })();
  }

  return toolCheckPromise;
}
