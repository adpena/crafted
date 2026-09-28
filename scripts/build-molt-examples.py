#!/usr/bin/env python3
"""Rebuild portfolio examples from a tracked Molt snapshot; publish only with --publish.

Requires Molt's Python dependencies, Rust/wasm toolchain and WASI SDK 34.
The target directory must be new: no artifacts from another source tree are reused.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

COMMIT = "7c82badf37973ea11db74bfd7e92b2271281706b"
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("repository", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--publish", action="store_true")
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=False)
source = out / "source"
source.mkdir()
archive = out / "source.tar"
with archive.open("wb") as stream:
    subprocess.run(["git", "-C", str(args.repository), "archive", COMMIT], stdout=stream, check=True)
with tarfile.open(archive) as bundle:
    bundle.extractall(source, filter="data")
env = {**os.environ, "PYTHONPATH": str(source / "src"), "MOLT_PROJECT_ROOT": str(source),
       "CARGO_TARGET_DIR": str(out / "target"), "CARGO_BUILD_JOBS": "4", "MOLT_DISABLE_AUTO_JANITOR": "1"}
programs = ["mandelbrot", "transfer-summary", "word-count"]
results = []
for name in programs + ["word-count"]:
    build = out / (name if name != "word-count" or not (out / name).exists() else "word-count-repeat")
    command = [sys.executable, "-m", "molt", "build", str(ROOT / f"public/molt-compiled/{name}.py"),
               "--target", "wasm", "--profile", "browser", "--rebuild", "--out-dir", str(build), "--json"]
    result = subprocess.run(command, env=env, cwd=source, text=True, capture_output=True)
    (out / f"{build.name}.log").write_text(result.stdout + result.stderr)
    result.check_returncode()
    wasm = build / "output_linked.wasm"
    results.append({"name": build.name, "bytes": wasm.stat().st_size,
                    "sha256": hashlib.sha256(wasm.read_bytes()).hexdigest()})
    print(json.dumps(results[-1]), flush=True)
assert results[-1]["sha256"] == results[-2]["sha256"], "Repeated build differs"
(out / "results.json").write_text(json.dumps(results, indent=2) + "\n")
if args.publish:
    for name in programs:
        shutil.copyfile(out / name / "output_linked.wasm", ROOT / f"public/molt-compiled/{name}.wasm")
