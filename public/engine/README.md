# Rapfi WebAssembly

Run `bash scripts/build-wasm.sh` after activating Emscripten. It writes `rapfi.js` and `rapfi.wasm` into this directory. The build compiles the Rapfi core without `main()` and exports `evaluate_board` plus `set_search_limits`.

The worker creates one Emscripten module instance and calls `_evaluate_board` for each position. The C++ adapter keeps Rapfi's global `Search::Engine`, board history, and transposition table alive. It accepts one `x,y,player` move per line; the React SGF parser normalizes SGF to this format before calling WASM. Coordinates are zero-based and player `1` is black, `2` white.

The default build uses Rapfi's embedded classical evaluation tables. It does not require the `Networks` submodule, but it does not load Rapfi NNUE weights. Add/configure a compatible model separately if NNUE evaluation is required.

If the WASM files are absent or fail to load, the worker uses the local heuristic evaluator.