/** يمنع تنفيذ الصيغ عند فتح ملفات CSV في برامج الجداول. */
export function csvSafe(value: unknown): string {
  const s = String(value ?? "");
  const quoted = s.length >= 2 && s.startsWith('"') && s.endsWith('"');
  let inner = quoted ? s.slice(1, -1) : s;
  if (/^[=+\-@\t\r]/.test(inner) && !/^-?\d+(\.\d+)?$/.test(inner)) inner = `'${inner}`;
  return quoted ? `"${inner}"` : inner;
}
