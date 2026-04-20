# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (env: AI_INTEGRATIONS_OPENAI_BASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY)

## Applications

### AI Subtitle Adder (`artifacts/subtitle-adder`)
- React + Vite frontend at preview path `/`
- Dark cinematic design with amber/gold accent
- Single-page flow: Upload → Configure → Processing → Download
- Communicates with API via `POST /api/subtitles/process` (multipart/form-data)
- No video storage — ephemeral processing only

### API Server (`artifacts/api-server`)
- Express 5 backend serving `/api`
- Key route: `POST /api/subtitles/process` — accepts video + language + color, returns processed video
- Uses OpenAI Whisper (`whisper-1`) for audio transcription via `openai.audio.transcriptions.create()`
- Uses ffmpeg to burn SRT subtitles into video with ASS styling
- Uses multer for multipart file uploads (500MB limit, in-memory storage)
- No database needed — videos processed ephemerally using temp dirs

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Libs

- `lib/integrations-openai-ai-server` — OpenAI client + utilities (audio, image, batch)
- `lib/api-client-react` — generated React Query hooks from OpenAPI spec
- `lib/api-zod` — generated Zod validation schemas from OpenAPI spec

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
