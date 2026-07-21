#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 IMAGE_DIRECTORY WATERMARK_PNG" >&2
  exit 1
fi

image_directory=$1
watermark_png=$2

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagickのmagickコマンドが必要です。" >&2
  exit 1
fi

if [ ! -d "$image_directory" ]; then
  echo "画像ディレクトリが見つかりません: $image_directory" >&2
  exit 1
fi

if [ ! -f "$watermark_png" ]; then
  echo "透かしPNGが見つかりません: $watermark_png" >&2
  exit 1
fi

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

processed=0
while IFS= read -r -d '' input_path; do
  case "$input_path" in
    *_wm.*) continue ;;
  esac

  width=$(magick identify -format '%w' "$input_path")
  height=$(magick identify -format '%h' "$input_path")
  if [ "$width" -lt "$height" ]; then
    short_edge=$width
  else
    short_edge=$height
  fi

  logo_size=$((short_edge * 21 / 100))
  tile_size=$((short_edge * 33 / 100))
  [ "$logo_size" -ge 1 ] || logo_size=1
  [ "$tile_size" -ge 1 ] || tile_size=1

  logo_layer="$temporary_directory/logo.png"
  tile_layer="$temporary_directory/tile.png"
  output_path="${input_path%.*}_wm.${input_path##*.}"

  magick "$watermark_png" \
    -strip \
    -resize "${logo_size}x${logo_size}" \
    -fill white \
    -colorize 100 \
    -channel A \
    -evaluate multiply 0.08 \
    +channel \
    -background none \
    -rotate -25 \
    "$logo_layer"

  magick -size "${tile_size}x${tile_size}" xc:none \
    "$logo_layer" \
    -gravity center \
    -composite \
    "$tile_layer"

  magick "$input_path" \
    \( -size "${width}x${height}" "tile:$tile_layer" \) \
    -compose over \
    -composite \
    -strip \
    -quality 88 \
    "$output_path"

  processed=$((processed + 1))
  echo "生成: $output_path"
done < <(find "$image_directory" -maxdepth 1 -type f \( -iname '2025-gakusai*_s.jpg' -o -iname '2025-gakusai*_s.jpeg' \) -print0)

echo "完了: ${processed}枚"
