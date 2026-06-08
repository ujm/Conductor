import { randomBytes } from "node:crypto";

/** テキストを URL セーフなスラグに変換する。非 ASCII 文字は除去し、空になる場合はランダム ID にフォールバックする */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return `template-${randomBytes(4).toString("hex")}`;
  }
  return slug;
}
