import { Router, type IRouter } from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Readable } from "stream";
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

      req.log.info({ language, color }, "Extracting audio from video");
      await execAsync(
        `ffmpeg -i "${inputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`
      );

      const audioBuffer = await fs.readFile(audioPath);
      req.log.info({ size: audioBuffer.length }, "Transcribing audio with Whisper");

      const audioFile = new File([audioBuffer], "audio.wav", { type: "audio/wav" });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      req.log.info(
        { segmentCount: transcription.segments?.length ?? 0 },
        "Transcription complete"
      );

      const segments = transcription.segments ?? [];

      if (segments.length === 0) {
        req.log.warn("No speech detected — returning original video with empty subtitles");
        const originalBuffer = await fs.readFile(inputPath);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="subtitled-video.mp4"`
        );
        res.send(originalBuffer);
        return;
      }

      const srtContent = segments
        .map((seg: { start: number; end: number; text: string }, idx: number) => {
          const start = formatSrtTime(seg.start);
          const end = formatSrtTime(seg.end);
          return `${idx + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
        })
        .join("\n");

      await fs.writeFile(srtPath, srtContent, "utf-8");
      req.log.info("SRT file written");

      const fontColor = color === "yellow" ? "yellow" : "white";
      const subtitleFilter = `subtitles='${srtPath.replace(/'/g, "\\'")}':force_style='Fontsize=20,PrimaryColour=&H00${colorToHex(fontColor)}&,OutlineColour=&H00000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=20'`;

      req.log.info("Burning subtitles into video with ffmpeg");
      await execAsync(
        `ffmpeg -i "${inputPath}" -vf "${subtitleFilter}" -c:v libx264 -crf 23 -preset fast -c:a copy "${outputPath}" -y`
      );

      const outputBuffer = await fs.readFile(outputPath);
      req.log.info({ size: outputBuffer.length }, "Subtitle burning complete");

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="subtitled-video.mp4"`
      );
      res.send(outputBuffer);
    } catch (err) {
      req.log.error({ err }, "Subtitle processing failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process video. Please try again." });
      }
    } finally {
      fs.rm(tmpDir, { recursive: true, force: true }).catch((err) => {
        logger.warn({ err, tmpDir }, "Failed to clean up temp directory");
      });
    }
  }
);

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

function colorToHex(color: string): string {
  if (color === "yellow") return "00FFFF";
  return "FFFFFF";
}



export default router;
