import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";
import path from "path";

type TranscriptionOutput = { text?: string };

const execFileAsync = promisify(execFile);

function getTranscriptionScriptPath(): string {
  const scriptName = "transcribe_faster_whisper.py";

  const candidates = [
    // Typical when running `npm run ... --workspace=@workspace/api-server`
    path.resolve(process.cwd(), "scripts", scriptName),
    // Fallback when running from monorepo root
    path.resolve(process.cwd(), "artifacts", "api-server", "scripts", scriptName),
    // Fallback for source-mode execution
    path.resolve(import.meta.dirname, "..", "..", "scripts", scriptName),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));

  if (!match) {
    throw new Error(
      `Could not locate ${scriptName}. Checked:\n${candidates.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  return match;
}

function isMissingFasterWhisperError(message: string): boolean {
  return message.includes("No module named 'faster_whisper'");
}

async function runTranscriptionCommand(
  python: string,
  scriptPath: string,
  audioPath: string,
  model: string,
  device: string,
  computeType: string,
  beamSize: string,
): Promise<string> {
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
}

async function attemptAutoInstall(python: string): Promise<void> {
  await execFileAsync(
    python,
    ["-m", "pip", "install", "faster-whisper"],
    { maxBuffer: 1024 * 1024 * 20 },
  );
}

export async function transcribeWithFasterWhisper(audioPath: string): Promise<string> {
  const python = process.env.PYTHON_BIN ?? "python3";
  const scriptPath = getTranscriptionScriptPath();

  const model = process.env.FASTER_WHISPER_MODEL ?? "base";
  const device = process.env.FASTER_WHISPER_DEVICE ?? "auto";
  const computeType = process.env.FASTER_WHISPER_COMPUTE_TYPE ?? "int8";
  const beamSize = process.env.FASTER_WHISPER_BEAM_SIZE ?? "5";
  const autoInstall = process.env.FASTER_WHISPER_AUTO_INSTALL !== "false";

  try {
    return await runTranscriptionCommand(python, scriptPath, audioPath, model, device, computeType, beamSize);
  } catch (err) {
    const message = (err as Error).message;

    if (!isMissingFasterWhisperError(message)) {
      throw new Error(
        `Local transcription failed. Ensure faster-whisper is installed (${python} -m pip install faster-whisper) and PYTHON_BIN is correct. ${message}`,
      );
    }

    if (!autoInstall) {
      throw new Error(
        `[MISSING_FASTER_WHISPER] Local transcription failed because the Python module "faster_whisper" is not installed for ${python}. Install it with: ${python} -m pip install faster-whisper`,
      );
    }

    try {
      await attemptAutoInstall(python);
      return await runTranscriptionCommand(python, scriptPath, audioPath, model, device, computeType, beamSize);
    } catch (installErr) {
      throw new Error(
        `[MISSING_FASTER_WHISPER] Local transcription failed because "faster_whisper" is unavailable for ${python}. Tried auto-install (${python} -m pip install faster-whisper) but it failed. ${(installErr as Error).message}`,
      );
    }
  }
}
