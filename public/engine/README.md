# Rapfi WebAssembly

Run `bash scripts/build-wasm.sh` after activating Emscripten. The script compiles the Rapfi core without `main()`, then copies the generated SIMD artifact to `rapfi.js` and `rapfi.wasm` in this directory. The exported C++ API provides `evaluate_board` and `set_search_limits`; the latter accepts depth, time per move, transposition-table size in MB, request ID, position index, and total positions. The table defaults to 512 MB in the app and Rapfi reports its actual allocation if memory pressure forces the table to shrink.

The worker creates one Emscripten module instance and calls `_evaluate_board` for each position. The C++ adapter keeps Rapfi's global `Search::Engine`, board history, and transposition table alive. Search progress (score, depth, node count, elapsed time, and current best move) is posted to the worker client at 500 ms intervals. It accepts one `x,y,player` move per line; the React SGF parser normalizes SGF to this format before calling WASM. Coordinates are zero-based and player `1` is black, `2` white.

The default build uses Rapfi's embedded classical evaluation tables. It does not require the `Networks` submodule, but it does not load Rapfi NNUE weights. Add/configure a compatible model separately if NNUE evaluation is required.

If the WASM files are absent or fail to load, the worker uses the local heuristic evaluator.