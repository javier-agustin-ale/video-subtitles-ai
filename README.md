## 🎥 Video Subtitles AI

Video Subtitles AI helps you generate and burn subtitles into videos using AI speech-to-text.

## Local development (npm)

This repository is now configured as an **npm workspaces** monorepo.

### Requirements

- Node.js 20+ (Node.js 24 recommended)
- npm 10+
- ffmpeg installed and available in PATH (for subtitle rendering)

### Install

```bash
npm install
```

### Useful scripts

```bash
npm run typecheck
npm run build
npm run dev --workspace=@workspace/api-server
npm run dev --workspace=@workspace/subtitle-adder
```

## Project structure

- `artifacts/subtitle-adder`: React + Vite frontend
- `artifacts/api-server`: Express API for subtitle generation
- `lib/*`: shared libraries (API client, schemas, db, integrations)
