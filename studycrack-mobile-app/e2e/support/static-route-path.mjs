import { isAbsolute, relative, sep } from 'node:path';

export function isPathInsideRoot(rootPath, filePath) {
  const relativePath = relative(rootPath, filePath);
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}
