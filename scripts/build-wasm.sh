#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAPFI_DIR="$ROOT_DIR/engine-src/Rapfi"
BUILD_DIR="$ROOT_DIR/build/rapfi-wasm"

if ! command -v emcmake >/dev/null 2>&1; then
    echo "Emscripten is not active. Run: source /path/to/emsdk/emsdk_env.sh" >&2
    exit 1
fi

mkdir -p "$ROOT_DIR/public/engine"

emcmake cmake \
    -S "$RAPFI_DIR" \
    -B "$BUILD_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DRAPFI_DIRECT_WASM_API=ON \
    -DNO_MULTI_THREADING=ON \
    -DNO_COMMAND_MODULES=ON \
    -DUSE_WASM_SIMD=ON

cmake --build "$BUILD_DIR" --target rapfi --parallel