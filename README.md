## 🎥 Video Subtitles AI

Video Subtitles AI helps you generate and burn subtitles into videos using AI speech-to-text.

## Local development (npm)

This repository is configured as an **npm workspaces** monorepo.

### Requirements

- Node.js 20+ (Node.js 24 recommended)
- npm 10+
- ffmpeg installed and available in PATH (required for subtitle rendering)
- OpenAI API key

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Set these before starting the API server:

- `AI_INTEGRATIONS_OPENAI_API_KEY` (your API key)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` (usually `https://api.openai.com/v1`)
- Optional: `PORT` (API server port, defaults to `3000`)

Example:

```bash
export AI_INTEGRATIONS_OPENAI_API_KEY="your_key_here"
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
export PORT=3000
```

### 3) Start the API server

```bash
npm run dev --workspace=@workspace/api-server
```

### 4) Start the frontend app

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
