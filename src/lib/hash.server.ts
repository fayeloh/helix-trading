/** Stable, cheap hash used to detect whether an account's holdings changed. */
export function stableHash(value: unknown): string {
  const str = JSON.stringify(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 ^ c) * 16777619;
    h2 = (h2 + c * (i + 1)) >>> 0;
  }
  return `${(h1 >>> 0).toString(16)}${h2.toString(16)}`;
}
