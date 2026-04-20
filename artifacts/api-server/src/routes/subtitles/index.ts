import { Router, type IRouter } from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

const execAsync = promisify(exec);

const router: IRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
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

    const language = typeof req.body.language === "string" ? req.body.language : "en";
    const color = typeof req.body.color === "string" ? req.body.color : "white";

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
      await fs.writeFile(inputPath, req.file.buffer);

      // Get video duration via ffprobe
      req.log.info("Getting video duration");
      const { stdout: probeOutput } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
      );
      const videoDuration = parseFloat(probeOutput.trim());
      req.log.info({ videoDuration }, "Video duration obtained");

      // Extract audio
      req.log.info({ language, color }, "Extracting audio from video");
      await execAsync(
        `ffmpeg -i "${inputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`
      );

      const audioBuffer = await fs.readFile(audioPath);
      req.log.info({ size: audioBuffer.length }, "Transcribing audio");

      // Use gpt-4o-mini-transcribe — only supports response_format: "json"
      const audioFile = new File([audioBuffer], "audio.wav", { type: "audio/wav" });
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-mini-transcribe",
        language,
        response_format: "json",
      });

      const fullText = (transcription as { text: string }).text?.trim() ?? "";
      req.log.info({ chars: fullText.length }, "Transcription complete");

      if (!fullText) {
        req.log.warn("No speech detected — returning original video");
        const originalBuffer = await fs.readFile(inputPath);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="subtitled-video.mp4"`);
        res.send(originalBuffer);
        return;
      }

      // Split into subtitle lines and estimate timing based on word position
      const lines = splitIntoSubtitleLines(fullText, 7);
      const totalWords = fullText.split(/\s+/).length;
      // Assume speech fills ~85% of video duration (accounting for pauses etc.)
      const speechDuration = videoDuration * 0.85;
      const wordsPerSecond = totalWords / speechDuration;
      // Estimate speech start offset (usually starts a bit into the video)
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

      // Burn subtitles using ffmpeg with ASS style
      // ASS color format is ABGR: yellow = &H0000FFFF&, white = &H00FFFFFF&
      const primaryColour = color === "yellow" ? "&H0000FFFF&" : "&H00FFFFFF&";
      const subtitleFilter = `subtitles='${srtPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}':force_style='Fontsize=22,PrimaryColour=${primaryColour},OutlineColour=&H00000000&,BorderStyle=3,Outline=2,Shadow=0,MarginV=25,Bold=1'`;

      req.log.info("Burning subtitles into video");
      await execAsync(
        `ffmpeg -i "${inputPath}" -vf "${subtitleFilter}" -c:v libx264 -crf 23 -preset fast -c:a copy "${outputPath}" -y`,
        { maxBuffer: 1024 * 1024 * 50 }
      );

      const outputBuffer = await fs.readFile(outputPath);
      req.log.info({ size: outputBuffer.length }, "Subtitle burning complete");

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="subtitled-video.mp4"`);
      res.send(outputBuffer);
    } catch (err) {
      req.log.error({ err }, "Subtitle processing failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process video. Please try again." });
      }
    } finally {
      fs.rm(tmpDir, { recursive: true, force: true }).catch((e) => {
        logger.warn({ err: e, tmpDir }, "Failed to clean up temp directory");
      });
    }
  }
);

/**
 * Split text into subtitle lines with at most `maxWords` words each.
 * Tries to keep natural sentence breaks where possible.
 */
function splitIntoSubtitleLines(text: string, maxWords: number): string[] {
  // Split on sentence boundaries first, then further chunk if needed
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
