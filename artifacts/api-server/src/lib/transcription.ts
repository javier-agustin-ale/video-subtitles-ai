import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

type TranscriptionOutput = { text?: string };

const execFileAsync = promisify(execFile);

function getTranscriptionScriptPath(): string {
  // Resolve relative to this module file so it works both from src/* and dist/* builds.
  return fileURLToPath(new URL("../../scripts/transcribe_faster_whisper.py", import.meta.url));
}

export async function transcribeWithFasterWhisper(audioPath: string): Promise<string> {
  const python = process.env.PYTHON_BIN ?? "python3";
  const scriptPath = getTranscriptionScriptPath();

  const model = process.env.FASTER_WHISPER_MODEL ?? "base";
  const device = process.env.FASTER_WHISPER_DEVICE ?? "auto";
  const computeType = process.env.FASTER_WHISPER_COMPUTE_TYPE ?? "int8";
  const beamSize = process.env.FASTER_WHISPER_BEAM_SIZE ?? "5";

  try {
    const { stdout } = await execFileAsync(
      python,
      [
        scriptPath,
        audioPath,
        "--model",
        model,
        "--device",
        device,
        "--compute_type",
        computeType,
        "--beam_size",
        beamSize,
      ],
      { maxBuffer: 1024 * 1024 * 20 },
    );

    const parsed = JSON.parse(stdout) as TranscriptionOutput;
    return parsed.text?.trim() ?? "";
  } catch (err) {
    throw new Error(
      `Local transcription failed. Ensure faster-whisper is installed (pip install faster-whisper) and PYTHON_BIN is correct. ${(err as Error).message}`,
    );
  }
}
