const DOUBLE_BACKSLASH_REGEX = new RegExp('\\\\', 'g');
const LEADING_FORWARD_SLASH_REGEX = new RegExp(/^\/+/);

export function getUploadPath(file: { path: string; base: string }, uploadPath: string): string {
  let relativeFilename = file.path
    .replace(file.base, '')
    .replace(DOUBLE_BACKSLASH_REGEX, '/');

  // Remove any remaining, leading forward slashes, which could throw off the
  // upload path by creating unintended intermediary directories.
  if (relativeFilename.startsWith('/')) {
    relativeFilename = relativeFilename.replace(LEADING_FORWARD_SLASH_REGEX, '');
  }

  // Apply upload path
  if (!uploadPath) {
    // No separators necessary
    return relativeFilename;
  }

  return `${uploadPath}/${relativeFilename}`;
}