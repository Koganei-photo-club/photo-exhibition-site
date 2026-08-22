#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "fileutils"
require "open3"
require "tmpdir"
require "yaml"

DISPLAY_ORDER = [
  "藍",
  "優しさのなかに",
  "ひなたの隙間",
  "新緑の香りを感じて",
  "HEAVY",
  "ゴーザフォス",
  "ふじ",
  "夜の向こうへ",
  "光にのって",
  "宵のTOKYO",
  "TRACE",
  "藤はなお",
  "秘密の夜",
  "F(low)Light",
  "移ろい",
  "SsEhTiSbUuNyAa",
  "BANK",
  "黄色の記憶",
  "夏をつむ",
  "薄明に咲く",
  "小さな秋の入り口",
  "朝日を浴びて",
  "せいかつかん",
  "閑寂",
  "３",
  "街影",
  "親子",
  "個体群"
].freeze

unless ARGV.length == 4
  warn "Usage: #{$PROGRAM_NAME} CSV SOURCE_DIR OUTPUT_DIR WATERMARK_PNG"
  exit 1
end

csv_path, source_dir, output_dir, watermark_path = ARGV
[csv_path, source_dir, watermark_path].each do |path|
  abort "Not found: #{path}" unless File.exist?(path)
end

FileUtils.mkdir_p(output_dir)
rows = CSV.read(csv_path, headers: true, encoding: "UTF-8")
normalize = ->(value) { value.to_s.strip.unicode_normalize(:nfkc) }
rows_by_title = rows.to_h { |row| [normalize.call(row["作品タイトル"]), row] }

missing_titles = DISPLAY_ORDER.reject { |title| rows_by_title.key?(normalize.call(title)) }
abort "Titles missing from CSV: #{missing_titles.join(', ')}" unless missing_titles.empty?

duplicate_titles = rows.group_by { |row| normalize.call(row["作品タイトル"]) }
                       .select { |_title, matches| matches.length > 1 }
abort "Duplicate titles in CSV: #{duplicate_titles.keys.join(', ')}" unless duplicate_titles.empty?

Dir.glob(File.join(output_dir, "2026-summer*_wm.jpg")).each { |path| FileUtils.rm_f(path) }

works = DISPLAY_ORDER.each_with_index.map do |display_title, index|
  row = rows_by_title.fetch(normalize.call(display_title))
  display_no = index + 1
  consented = row["掲載可否"]&.strip == "同意"
  source_name = row["作品ファイル名"]&.strip
  source_path = File.join(source_dir, source_name.to_s)
  abort "Image missing: #{source_path}" unless File.file?(source_path)

  output_name = format("2026-summer%02d_wm.jpg", display_no)
  output_path = File.join(output_dir, output_name)

  if consented
    Dir.mktmpdir("2026-summer-watermark") do |temporary_dir|
      base_path = File.join(temporary_dir, "base.jpg")
      logo_path = File.join(temporary_dir, "logo.png")
      tile_path = File.join(temporary_dir, "tile.png")

      commands = [
        ["magick", source_path, "-auto-orient", "-resize", "2000x2000>",
         "-strip", "-quality", "92", base_path],
        ["magick", watermark_path, "-strip", "-resize", "320x320",
         "-fill", "white", "-colorize", "100", "-channel", "A",
         "-evaluate", "multiply", "0.08", "+channel", "-background", "none",
         "-rotate", "-25", logo_path],
        ["magick", "-size", "520x520", "xc:none", logo_path,
         "-gravity", "center", "-composite", tile_path],
        ["magick", base_path, "(", "-size", "2000x2000", "tile:#{tile_path}", ")",
         "-gravity", "center", "-compose", "over", "-composite", "-strip",
         "-interlace", "Plane", "-sampling-factor", "4:2:0", "-quality", "88",
         output_path]
      ]

      commands.each do |command|
        stdout, stderr, status = Open3.capture3(*command)
        abort "Image conversion failed for #{source_name}: #{stdout}\n#{stderr}" unless status.success?
      end
    end
  end

  work = {
    "no" => display_no,
    "title" => display_title,
    "author" => row["作者名"]&.strip.to_s,
    "image_public" => consented,
    "description" => ""
  }
  if consented
    work["images"] = {
      "thumb" => "/2026/summer/public-images/works/#{output_name}",
      "full" => "/2026/summer/public-images/works/#{output_name}"
    }
  end
  work
end

yaml_path = File.join(Dir.pwd, "_data/works/2026-summer.yml")
File.write(yaml_path, works.to_yaml(line_width: -1), mode: "w:UTF-8")

puts "All works: #{works.length}"
puts "Public images: #{works.count { |work| work['image_public'] }}"
puts "No Image cards: #{works.count { |work| !work['image_public'] }}"
puts "Generated images: #{output_dir}"
puts "Works data: #{yaml_path}"
