import { Router, type IRouter } from "express";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { logger } from "../../lib/logger";
import { ensureMediaToolsAvailable } from "../../lib/media-tools";
import { transcribeWithFasterWhisper } from "../../lib/transcription";

const execFileAsync = promisify(execFile);
let subtitlesFilterAvailableCache: boolean | null = null;

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

router.get("/subtitles/status", (_req, res): void => {
  res.json({ ready: true, message: "Subtitle service ready" });
});

router.post(
  "/subtitles/process",
  upload.single("video"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }

    const color = typeof req.body.color === "string" ? req.body.color : "white";
    const background = typeof req.body.background === "string" ? req.body.background : "yes";
    const size = typeof req.body.size === "string" ? req.body.size : "normal";
    const translate = typeof req.body.translate === "string" ? req.body.translate : "original";

    if (translate === "english") {
      res.status(422).json({ error: "Translate to English is a premium feature and will be available soon." });
      return;
    }

    if (color !== "white" && color !== "yellow") {
      res.status(400).json({ error: "Color must be 'white' or 'yellow'" });
      return;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "subtitles-"));
    const inputPath = path.join(tmpDir, "input.mp4");
    const audioPath = path.join(tmpDir, "audio.wav");
    const srtPath = path.join(tmpDir, "subtitles.srt");
    const outputPath = path.join(tmpDir, "output.mp4");

    try {
      await ensureMediaToolsAvailable();

      await fs.writeFile(inputPath, req.file.buffer);

      // Get video duration via ffprobe
      const { stdout: probeOutput } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ]);
      const videoDuration = parseFloat(probeOutput.trim());
      req.log.info({ videoDuration }, "Video duration obtained");

      // Extract audio
      req.log.info({ color, background, size, translate }, "Extracting audio from video");
      await execFileAsync("ffmpeg", [
        "-i",
        inputPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        audioPath,
        "-y",
      ]);

      const audioBuffer = await fs.readFile(audioPath);
      req.log.info({ size: audioBuffer.length }, "Transcribing audio");

      let fullText = await transcribeWithFasterWhisper(audioPath);
      req.log.info({ chars: fullText.length }, "Transcription complete");

      if (!fullText) {
        req.log.warn("No speech detected — returning original video");
        const originalBuffer = await fs.readFile(inputPath);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="subtitled-video.mp4"`);
        res.send(originalBuffer);
        return;
      }

      // Split into subtitle lines and estimate timing
      const lines = splitIntoSubtitleLines(fullText, 7);
      const totalWords = fullText.split(/\s+/).length;
      const speechDuration = videoDuration * 0.85;
      const wordsPerSecond = totalWords / speechDuration;
      const speechStart = Math.min(videoDuration * 0.05, 2);

      let wordOffset = 0;
      const segments = lines.map((line, idx) => {
        const wordCount = line.split(/\s+/).length;
        const startTime = speechStart + wordOffset / wordsPerSecond;
        const duration = Math.max(1.5, wordCount / wordsPerSecond);
        const endTime = Math.min(startTime + duration, videoDuration - 0.1);
        wordOffset += wordCount;
        return { idx: idx + 1, start: startTime, end: endTime, text: line };
      });

      const srtContent = segments
        .map((seg) => `${seg.idx}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}\n`)
        .join("\n");

      await fs.writeFile(srtPath, srtContent, "utf-8");
      req.log.info({ lineCount: segments.length }, "SRT file written");

      // Build ASS force_style from user options
      // ASS color format: ABGR — yellow = &H0000FFFF&, white = &H00FFFFFF&
      const primaryColour = color === "yellow" ? "&H0000FFFF&" : "&H00FFFFFF&";
      const fontSize = size === "large" ? 30 : 22;

      // BorderStyle 3 = opaque box (background), 1 = outline only (no background)
      // When using background box, set BackColour to semi-transparent black
      const borderStyle = background === "yes" ? 3 : 1;
      const backColour = "&H80000000&";  // semi-transparent black
      const outline = background === "yes" ? 0 : 2;

      const forceStyle = [
        `Fontsize=${fontSize}`,
        `Bold=1`,
        `PrimaryColour=${primaryColour}`,
        `BackColour=${backColour}`,
        `BorderStyle=${borderStyle}`,
        `Outline=${outline}`,
        `Shadow=0`,
        `MarginV=25`,
      ].join(",");

      const escapedSrtPath = srtPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
      const subtitleFilter = `subtitles=filename='${escapedSrtPath}':force_style='${forceStyle}'`;

      req.log.info({ subtitleFilter }, "Burning subtitles into video");
      await burnSubtitlesWithFallback(inputPath, subtitleFilter, srtPath, outputPath, req.log);

      const outputBuffer = await fs.readFile(outputPath);
      req.log.info({ size: outputBuffer.length }, "Subtitle burning complete");

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="subtitled-video.mp4"`);
      res.send(outputBuffer);
    } catch (err) {
      req.log.error({ err }, "Subtitle processing failed");
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : "Failed to process video. Please try again.";

        if (message.includes("[MISSING_MEDIA_TOOL]")) {
          res.status(500).json({
            error: "FFmpeg/ffprobe is not installed or not in PATH. Install FFmpeg and restart the API server.",
          });
        } else if (message.includes("[MISSING_FASTER_WHISPER]")) {
          res.status(503).json({
            error: message.replace("[MISSING_FASTER_WHISPER] ", ""),
          });
        } else {
          res.status(500).json({ error: "Failed to process video. Please try again." });
        }
      }
    } finally {
      fs.rm(tmpDir, { recursive: true, force: true }).catch((e) => {
        logger.warn({ err: e, tmpDir }, "Failed to clean up temp directory");
      });
    }
  }
);


async function isSubtitlesFilterAvailable(log: { warn: (obj: unknown, msg: string) => void }): Promise<boolean> {
  if (subtitlesFilterAvailableCache !== null) return subtitlesFilterAvailableCache;

  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-hide_banner", "-filters"]);
    subtitlesFilterAvailableCache = /\bsubtitles\b/i.test(stdout);
    return subtitlesFilterAvailableCache;
  } catch (err) {
    log.warn({ err }, "Failed to detect ffmpeg filters. Assuming subtitles filter is unavailable.");
    subtitlesFilterAvailableCache = false;
    return subtitlesFilterAvailableCache;
  }
}

function isMissingSubtitlesFilterError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const stderr = typeof err === "object" && err !== null && "stderr" in err ? String((err as { stderr?: unknown }).stderr ?? "") : "";
  const combined = `${message}
${stderr}`;
  return /no such filter:\s*'?(subtitles)'?/i.test(combined);
}

async function muxSubtitlesTrack(inputPath: string, srtPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    [
      "-i",
      inputPath,
      "-i",
      srtPath,
      "-map",
      "0",
      "-map",
      "1:0",
      "-c",
      "copy",
      "-c:s",
      "mov_text",
      outputPath,
      "-y",
    ],
    { maxBuffer: 1024 * 1024 * 50 },
  );
}

async function burnSubtitlesWithFallback(
  inputPath: string,
  subtitleFilter: string,
  srtPath: string,
  outputPath: string,
  log: { info: (obj: unknown, msg: string) => void; warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  const canBurn = await isSubtitlesFilterAvailable(log);

  if (!canBurn) {
    log.warn(
      {},
      "FFmpeg build does not include the subtitles filter. Embedding subtitles track (mov_text) instead.",
    );
    await muxSubtitlesTrack(inputPath, srtPath, outputPath);
    log.info({}, "Subtitles embedded as selectable track (mov_text).");
    return;
  }

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-i",
        inputPath,
        "-vf",
        subtitleFilter,
        "-c:v",
        "libx264",
        "-crf",
        "23",
        "-preset",
        "fast",
        "-c:a",
        "copy",
        outputPath,
        "-y",
      ],
      { maxBuffer: 1024 * 1024 * 50 },
    );
  } catch (err) {
    if (!isMissingSubtitlesFilterError(err)) {
      throw err;
    }

    subtitlesFilterAvailableCache = false;
    log.warn(
      { err },
      "Subtitles filter became unavailable at runtime. Falling back to embedded subtitle track (mov_text).",
    );
    await muxSubtitlesTrack(inputPath, srtPath, outputPath);
    log.info({}, "Subtitles embedded as selectable track (mov_text).");
  }
}

function splitIntoSubtitleLines(text: string, maxWords: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const lines: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(" ");
      if (chunk) lines.push(chunk);
    }
  }
  return lines;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

export default router;
