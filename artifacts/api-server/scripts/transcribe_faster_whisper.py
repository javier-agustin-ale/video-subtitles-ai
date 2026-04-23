#!/usr/bin/env python3
import argparse
import json
import sys

from faster_whisper import WhisperModel


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="base")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute_type", default="int8")
    parser.add_argument("--beam_size", type=int, default=5)
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, _info = model.transcribe(args.audio_path, beam_size=args.beam_size)

    text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()
    print(json.dumps({"text": text}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        raise
