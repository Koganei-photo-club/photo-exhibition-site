#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "digest"
require "fileutils"
require "open3"
require "tmpdir"

LONG_EDGE = 1600
JPEG_QUALITY = 88
WATERMARK_OPACITY = 0.08
UUID_BASENAME = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i
SUPPORTED_EXTENSIONS = %w[.jpg .jpeg .png].freeze

unless ARGV.length == 3
  warn "Usage: #{$PROGRAM_NAME} SOURCE_DIR OUTPUT_DIR WATERMARK_PNG"
  exit 1
end

source_dir, output_dir, watermark_path = ARGV.map { |path| File.expand_path(path) }
abort "Source directory not found: #{source_dir}" unless Dir.exist?(source_dir)
abort "Watermark PNG not found: #{watermark_path}" unless File.file?(watermark_path)
abort "ImageMagick is required." unless system("command", "-v", "magick", out: File::NULL)

source_paths = Dir.children(source_dir)
                  .map { |name| File.join(source_dir, name) }
                  .select { |path| File.file?(path) && SUPPORTED_EXTENSIONS.include?(File.extname(path).downcase) }
                  .sort_by { |path| File.basename(path).unicode_normalize(:nfc) }
abort "No supported images found in: #{source_dir}" if source_paths.empty?

FileUtils.mkdir_p(output_dir)
local_directory = File.expand_path("../.local", __dir__)
FileUtils.mkdir_p(local_directory)
manifest_path = File.join(local_directory, "2026-gakusai-image-manifest.csv")
generated_names = []
rows = []

run = lambda do |*command|
  stdout, stderr, status = Open3.capture3(*command)
  abort "Command failed: #{command.join(' ')}\n#{stdout}\n#{stderr}" unless status.success?
  stdout
end

source_paths.each do |source_path|
  source_name = File.basename(source_path)
  source_basename = File.basename(source_name, File.extname(source_name))
  source_sha256 = Digest::SHA256.file(source_path).hexdigest
  stable_id = UUID_BASENAME.match?(source_basename) ? source_basename.downcase : source_sha256
  output_name = "#{stable_id}_wm.jpg"
  output_path = File.join(output_dir, output_name)
  abort "Output name collision: #{output_name}" if generated_names.include?(output_name)

  Dir.mktmpdir("2026-gakusai-watermark") do |temporary_dir|
    base_path = File.join(temporary_dir, "base.jpg")
    logo_path = File.join(temporary_dir, "logo.png")
    tile_path = File.join(temporary_dir, "tile.png")

    run.call(
      "magick", source_path,
      "-auto-orient", "-resize", "#{LONG_EDGE}x#{LONG_EDGE}>",
      "-colorspace", "sRGB", "-strip", "-quality", "92", base_path
    )

    dimensions = run.call("magick", "identify", "-format", "%w,%h", base_path).strip
    width, height = dimensions.split(",").map(&:to_i)
    short_edge = [width, height].min
    logo_size = [(short_edge * 0.21).round, 1].max
    tile_size = [(short_edge * 0.33).round, 1].max

    run.call(
      "magick", watermark_path,
      "-strip", "-resize", "#{logo_size}x#{logo_size}",
      "-fill", "white", "-colorize", "100",
      "-channel", "A", "-evaluate", "multiply", WATERMARK_OPACITY.to_s, "+channel",
      "-background", "none", "-rotate", "-25", logo_path
    )
    run.call(
      "magick", "-size", "#{tile_size}x#{tile_size}", "xc:none",
      logo_path, "-gravity", "center", "-composite", tile_path
    )
    run.call(
      "magick", base_path,
      "(", "-size", "#{width}x#{height}", "tile:#{tile_path}", ")",
      "-compose", "over", "-composite", "-strip",
      "-interlace", "Plane", "-sampling-factor", "4:2:0",
      "-quality", JPEG_QUALITY.to_s, output_path
    )

    rows << {
      "source_filename" => source_name,
      "source_sha256" => source_sha256,
      "stable_id" => stable_id,
      "stable_id_kind" => UUID_BASENAME.match?(source_basename) ? "existing_uuid" : "generated_sha256",
      "output_filename" => output_name,
      "output_width" => width,
      "output_height" => height,
      "source_bytes" => File.size(source_path),
      "output_bytes" => File.size(output_path)
    }
  end

  generated_names << output_name
  puts "Generated: #{source_name} -> #{output_name}"
end

CSV.open(manifest_path, "w", write_headers: true, headers: rows.first.keys, encoding: "UTF-8") do |csv|
  rows.each { |row| csv << row.values }
end

existing_generated = Dir.glob(File.join(output_dir, "*_wm.jpg"))
existing_generated.each do |path|
  FileUtils.rm_f(path) unless generated_names.include?(File.basename(path))
end

puts "Completed: #{rows.length} images"
puts "Existing UUID names retained: #{rows.count { |row| row['stable_id_kind'] == 'existing_uuid' }}"
puts "SHA-256 names generated: #{rows.count { |row| row['stable_id_kind'] == 'generated_sha256' }}"
puts "Manifest: #{manifest_path}"
