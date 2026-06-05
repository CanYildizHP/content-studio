import path from 'path';

export const BRAIN_PATH = 'C:/Users/CanYildiz/Desktop/Git/Brain';

export function brainPath(...segments: string[]): string {
  return path.join(BRAIN_PATH, ...segments);
}
