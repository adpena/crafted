# Compiled Python examples

The portfolio runs three fixed programs: an ASCII Mandelbrot renderer, an Austin ISD charter-transfer summary, and a word counter. Molt compiles their Python source ahead of time. A browser worker loads the linked Wasm module with Molt's browser host, runs it, and returns stdout. The website does not compile arbitrary Python or contact a compilation service.

`src/components/CompiledMoltDemo.tsx` owns the selector, source display, worker lifecycle, and 30-second timeout. `public/molt-compiled/worker.js` accepts only the three named examples. Each run gets a fresh worker. Source, Wasm, host files, licenses, and a public build record are downloadable under `/molt-compiled/`.

## Rebuild

Use Molt commit `7c82badf37973ea11db74bfd7e92b2271281706b`, its Python dependencies, Rust with the Wasm target, and WASI SDK 34. See the tool versions in `public/molt-compiled/provenance.json`.

```sh
WASI_SDK_PATH=/path/to/wasi-sdk-34 python scripts/build-molt-examples.py /path/to/molt /new/build/directory --publish
```

The script creates a tracked-source archive and a fresh Cargo target directory, builds all three examples without the program cache, and repeats the word-counter build to check byte identity. `--publish` copies the verified outputs into the portfolio. Regenerate the provenance hashes after any public host or program change; never imply a source commit alone identifies an uncommitted build.

The browser host matches that Molt commit except for two documented adaptations: exporting the browser VFS as an ES module and forwarding the linked module's `molt_isolate_import`, following Molt's Node host. The program logic is in Wasm, not a JavaScript recreation.

## Verification

The portfolio Playwright suite runs all three modules in Chromium, WebKit, and the mobile Safari profile. It compares the complete stdout against CPython executing each checked-in source file, ignoring only the final newline. This establishes these examples' behavior, not full Python language compatibility. The September 25 receipt in `portfolio-molt-verification.json` describes the earlier single-example deployment; the current artifact identities are in the public build record.
