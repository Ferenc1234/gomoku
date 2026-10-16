#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAPFI_DIR="$ROOT_DIR/engine-src/Rapfi"
OUT_DIR="$ROOT_DIR/public/engine"

if ! command -v emcmake >/dev/null 2>&1; then
    echo "Emscripten is not active. Run: source /path/to/emsdk/emsdk_env.sh" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

# build_variant <build-dir-name> <extra cmake args...>
build_variant() {
    local build_name="$1"
    shift
    local build_dir="$ROOT_DIR/build/rapfi-wasm-$build_name"

    echo "==> Building variant: $build_name"
    emcmake cmake \
        -S "$RAPFI_DIR" \
        -B "$build_dir" \
        -DCMAKE_BUILD_TYPE=Release \
        -DRAPFI_DIRECT_WASM_API=ON \
        -DNO_COMMAND_MODULES=ON \
        "$@"

    cmake --build "$build_dir" --target rapfi --parallel
}

# Single-thread SIMD128 (always shipped; also copied to the generic rapfi.* names).
build_variant st-simd \
    -DNO_MULTI_THREADING=ON \
    -DUSE_WASM_SIMD=ON

# Single-thread Relaxed SIMD (used when the browser reports relaxed SIMD support).
build_variant st-relaxed \
    -DNO_MULTI_THREADING=ON \
    -DUSE_WASM_SIMD=ON \
    -DUSE_WASM_SIMD_RELAXED=ON

# Multi-thread SIMD128 (requires cross-origin isolation; falls back to ST).
build_variant mt-simd \
    -DNO_MULTI_THREADING=OFF \
    -DWASM_MULTITHREAD=ON \
    -DUSE_WASM_SIMD=ON

# Multi-thread Relaxed SIMD.
build_variant mt-relaxed \
    -DNO_MULTI_THREADING=OFF \
    -DWASM_MULTITHREAD=ON \
    -DUSE_WASM_SIMD=ON \
    -DUSE_WASM_SIMD_RELAXED=ON

# Keep the plain rapfi.* artifacts as the default single-thread SIMD build so
# older caches and the existing worker candidate list keep resolving.
if [ -f "$OUT_DIR/rapfi-simd128.js" ]; then
    cp -f "$OUT_DIR/rapfi-simd128.js" "$OUT_DIR/rapfi.js"
fi
if [ -f "$OUT_DIR/rapfi-simd128.wasm" ]; then
    cp -f "$OUT_DIR/rapfi-simd128.wasm" "$OUT_DIR/rapfi.wasm"
fi

echo "==> Engine artifacts in $OUT_DIR"
ls -la "$OUT_DIR"
