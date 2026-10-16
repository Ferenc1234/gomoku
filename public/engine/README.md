# Rapfi WebAssembly

Run `bash scripts/build-wasm.sh` after activating Emscripten. The script compiles the Rapfi core without `main()`, then copies the generated SIMD artifact to `rapfi.js` and `rapfi.wasm` in this directory. The exported C++ API provides `evaluate_board`, `set_search_limits`, `enable_nnue`, `disable_nnue`, and `nnue_active`; `set_search_limits` accepts depth, time per move, transposition-table size in MB, request ID, position index, and total positions. The table defaults to 512 MB in the app and Rapfi reports its actual allocation if memory pressure forces the table to shrink.

The worker creates one Emscripten module instance and calls `_evaluate_board` for each position. The C++ adapter keeps Rapfi's global `Search::Engine`, board history, and transposition table alive. Search progress (score, depth, node count, elapsed time, and current best move) is posted to the worker client at 500 ms intervals. It accepts one `x,y,player` move per line; the React SGF parser normalizes SGF to this format before calling WASM. Coordinates are zero-based and player `1` is black, `2` white.

The default build uses Rapfi's embedded classical evaluation tables. It does not bundle the `Networks` submodule, so the WASM stays small (~1 MB) and evaluates with classical patterns only.

## Optional NNUE (`Silnější engine · NNUE`)

The build also contains Rapfi's mix9svq NNUE code. The app exposes a **Silnější engine** button that downloads the official weights (`mix9svqfreestyle_bsmix.bin.lz4`, ~10 MB, CC0) from the `dhbloo/rapfi-networks` GitHub repo on demand, stores them in the Cache Storage API (`gomoku-engine-nnue-v1`), writes them into the Emscripten filesystem, and calls `enable_nnue` to point Rapfi's evaluator config at the file. `evaluate_board` returns `"nnue": true` once the network is active, and the raw chip switches to `WASM · NNUE`.

Because a worker instance is recreated per analysis, the weights are re-read from Cache Storage and re-enabled each time; the first download is the only network transfer. Clicking the button again calls `disable_nnue` and reverts to the classical evaluator. If the network file cannot be loaded the engine silently falls back to classical evaluation and the UI reports it.

The API is only available when the WASM is rebuilt with the runtime NNUE hooks. To rebuild:

```sh
source "$HOME/emsdk/emsdk_env.sh"
bash scripts/build-wasm.sh
```

If the WASM files are absent or fail to load, the worker uses the local heuristic evaluator.