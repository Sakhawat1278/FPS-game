const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    result += UNAMBIGUOUS_CHARS[randomIndex];
  }
  return result;
}

export function sanitizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

