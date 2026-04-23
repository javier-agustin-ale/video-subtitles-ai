## 🎥 Video Subtitles AI

Video Subtitles AI helps you generate and burn subtitles into videos using AI speech-to-text.

## Local development (npm)

This repository is configured as an **npm workspaces** monorepo.

### Requirements

- Node.js 20+ (Node.js 24 recommended)
- npm 10+
- ffmpeg installed and available in PATH (required for subtitle rendering)
- Python 3 (for local transcription with faster-whisper)

### 1) Install dependencies

```bash
npm install
```

### 2) Install local transcription runtime (faster-whisper)

```bash
python3 -m pip install faster-whisper
```

### 3) Configure environment variables

Optional API server variables:

- `PORT` (API server port, defaults to `3000`)
- `PYTHON_BIN` (defaults to `python3`)
- `FASTER_WHISPER_MODEL` (defaults to `base`)
- `FASTER_WHISPER_DEVICE` (`auto`, `cpu`, or `cuda`; defaults to `auto`)
- `FASTER_WHISPER_COMPUTE_TYPE` (defaults to `int8`)

Example:

```bash
export PORT=3000
export PYTHON_BIN=python3
export FASTER_WHISPER_MODEL=base
```

### 4) Start the API server

```bash
npm run dev --workspace=@workspace/api-server
```

### 5) Start the frontend app

In a second terminal:

```bash
npm run dev --workspace=@workspace/subtitle-adder
```

The frontend runs on `http://localhost:5173` by default and proxies `/api/*` to `http://localhost:3000` by default.

If your API uses a different URL, set `API_BASE_URL` when starting the frontend:

```bash
API_BASE_URL="http://localhost:4000" npm run dev --workspace=@workspace/subtitle-adder
```

### Useful scripts

```bash
npm run typecheck
npm run build
```

## Project structure

- `artifacts/subtitle-adder`: React + Vite frontend
- `artifacts/api-server`: Express API for subtitle generation
- `lib/*`: shared libraries (API client, schemas, db, integrations)


## Troubleshooting

### `ffprobe: command not found` / `ffmpeg: command not found`

This API requires FFmpeg tools (`ffmpeg` and `ffprobe`) available in your `PATH`.

Install FFmpeg:

- macOS (Homebrew): `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt update && sudo apt install -y ffmpeg`
- Windows (winget): `winget install Gyan.FFmpeg`

Then restart the API server.


> Note: **Translate to English** is currently disabled in the UI as a premium feature placeholder (coming soon).
