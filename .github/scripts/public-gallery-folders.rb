# Resolve the same shared gallery folders as _layouts/gallery.html, before Jekyll builds.
require 'date'
require 'json'
require 'yaml'

def gallery_folder(path)
  text = File.read(path, encoding: 'bom|utf-8')
  front_matter = text.match(/\A---[ \t]*\r?\n(.*?)^(?:---|\.\.\.)[ \t]*\r?$/m)
  return unless front_matter

  page = YAML.safe_load(front_matter[1], permitted_classes: [Date, Time], aliases: true, filename: path)
  return unless page.is_a?(Hash) && page['layout'] == 'gallery' && page['published'] != false

  if page['portfolio'] == 'personal'
    folder = page['gallery']
    return folder if folder.is_a?(String) && !folder.empty? && !folder.include?('/') && !%w[. ..].include?(folder)
    abort "#{path}: Set gallery to the shared gallery folder name."
  end

  route = page['permalink'] || "/#{path.sub(%r{/index\.[^/]+\z}, '/')}"
  folder = %r{\A/galleries/([^/]+)/(?:index\.html)?\z}.match(route.to_s)
  return folder[1] if folder
  abort "#{path}: The studio gallery must publish at /galleries/<folder>/."
rescue Psych::Exception => error
  abort "#{path}: Invalid YAML front matter: #{error.message}"
end

config = File.exist?('_config.yml') ? YAML.safe_load_file('_config.yml') : {}
excluded = Array(config&.fetch('exclude', []))
folders = STDIN.read.split("\0").filter_map do |path|
  next if path.split('/').any? { |part| part.start_with?('_', '.') }
  next if excluded.any? { |pattern| path.start_with?(pattern + '/') || File.fnmatch?(pattern, path, File::FNM_PATHNAME) }
  gallery_folder(path)
end
puts JSON.generate(folders.uniq.sort)
