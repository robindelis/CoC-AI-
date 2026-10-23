#!/usr/bin/env python3
"""
Clash of Clans CSV Extractor & Supercell LZMA Decoder
Extracts and decompresses all game logic, balancing, and configuration CSV files
from the Waydroid installation into clean, readable CSV files.
"""

import os
import sys
import glob
import zipfile
import lzma
from pathlib import Path

BASE_OUT = Path.home() / "coc_dumps"
APP_DIR = Path.home() / ".local/share/waydroid/data/app"
DATA_DIR = Path.home() / ".local/share/waydroid/data/data/com.supercell.clashofclans"

def decompress_sc_bytes(data: bytes) -> bytes:
    """Decompresses Supercell LZMA compressed files (with Sig: or legacy headers)."""
    # Check if raw or standard
    try:
        return lzma.decompress(data)
    except Exception:
        pass

    # Detect header offset
    start_offset = 0
    if data.startswith(b"Sig:"):
        # 4 bytes "Sig:" + 64 bytes SHA512 signature = 68 bytes
        start_offset = 68
    elif len(data) > 9 and data[9] == 0x5D:
        start_offset = 9

    payload = data[start_offset:]
    props = payload[:5]
    size_32 = payload[5:9]
    body = payload[9:]

    # Reconstruct standard 13-byte LZMA FORMAT_ALONE header: 5 bytes props + 8 bytes uncompressed size
    header_32 = props + size_32 + b"\x00\x00\x00\x00" + body
    try:
        return lzma.decompress(header_32, format=lzma.FORMAT_ALONE)
    except Exception:
        pass

    # Fallback to unknown size (0xFFFFFFFFFFFFFFFF)
    header_dummy = props + b"\xff" * 8 + body
    try:
        return lzma.decompress(header_dummy, format=lzma.FORMAT_ALONE)
    except Exception:
        pass

    # Try brute-force common Supercell offsets
    for off in (68, 9, 10, 12, 14, 18):
        try:
            return lzma.decompress(data[off:], format=lzma.FORMAT_ALONE)
        except Exception:
            continue

    raise ValueError("Failed to decompress file with Supercell LZMA routines.")

def find_asset_pack() -> Path | None:
    """Finds the Clash of Clans asset pack APK installed in Waydroid."""
    matches = list(APP_DIR.glob("**/split_install_time_asset_pack.apk"))
    if matches:
        return matches[0]
    # Fallback to base.apk or any coc apk
    matches = list(APP_DIR.glob("**/com.supercell.clashofclans*/*.apk"))
    if matches:
        return matches[0]
    return None

def main():
    print("=" * 60)
    print("  Clash of Clans CSV Extractor & Supercell Decoder")
    print("=" * 60)

    asset_pack = find_asset_pack()
    if not asset_pack or not asset_pack.is_file():
        print(f"[!] Error: Could not locate Clash of Clans APK in {APP_DIR}")
        sys.exit(1)

    print(f"[+] Found Clash of Clans asset pack:\n    {asset_pack}")

    BASE_OUT.mkdir(parents=True, exist_ok=True)
    logic_dir = BASE_OUT / "logic"
    csv_dir = BASE_OUT / "csv"
    loc_dir = BASE_OUT / "localization"

    logic_dir.mkdir(exist_ok=True)
    csv_dir.mkdir(exist_ok=True)
    loc_dir.mkdir(exist_ok=True)

    success_count = 0
    fail_count = 0

    with zipfile.ZipFile(asset_pack, "r") as z:
        for entry in z.infolist():
            filename = entry.filename
            if not filename.endswith(".csv"):
                continue

            raw_data = z.read(entry)
            try:
                decoded = decompress_sc_bytes(raw_data)
            except Exception as e:
                # Some small localization or plain CSVs might already be plain text
                if b"," in raw_data and b"\n" in raw_data:
                    decoded = raw_data
                else:
                    print(f" [✗] Failed to decode: {filename} ({e})")
                    fail_count += 1
                    continue

            # Determine destination subfolder
            base_name = Path(filename).name
            if "logic" in filename:
                out_path = logic_dir / base_name
            elif "localization" in filename:
                out_path = loc_dir / base_name
            else:
                out_path = csv_dir / base_name

            with open(out_path, "wb") as f_out:
                f_out.write(decoded)

            success_count += 1

    print("\n" + "-" * 60)
    print(f"[✓] Extraction Complete!")
    print(f"    - Successfully extracted & decoded: {success_count} CSV files")
    if fail_count > 0:
        print(f"    - Failed: {fail_count} files")
    print(f"\nYour files are saved in:")
    print(f"  • Game Logic (Stats, Buildings, Troops, Spells, Heroes):")
    print(f"    {logic_dir}")
    print(f"  • General Game Configuration:")
    print(f"    {csv_dir}")
    print(f"  • Localizations & Text:")
    print(f"    {loc_dir}")
    print("-" * 60)

if __name__ == "__main__":
    main()
