import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  pattern,
} from "obscenity";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

// Server only: keeps the word list out of the client bundle.
// English list + a few locale terms. Add more `addPhrase` lines to extend.
const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .addPhrase((p: any) => p.setMetadata({ originalWord: "gago" }).addPattern(pattern`|gago|`))
  .addPhrase((p: any) => p.setMetadata({ originalWord: "tangina" }).addPattern(pattern`tangina`))
  .addPhrase((p: any) => p.setMetadata({ originalWord: "putang" }).addPattern(pattern`putang`))
  .addPhrase((p: any) => p.setMetadata({ originalWord: "tarantado" }).addPattern(pattern`tarantado`))
  .addPhrase((p: any) => p.setMetadata({ originalWord: "ulol" }).addPattern(pattern`|ulol|`));

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
});

export function isFoul(text: string): boolean {
  // Also test with separators stripped so "f.u_c.k" does not slip through.
  return matcher.hasMatch(text) || matcher.hasMatch(text.replace(/[._]+/g, ""));
}

/** Full server-side check: format + foul language. Error message or null. */
export function validateUsername(raw: unknown): string | null {
  const format = validateUsernameFormat(raw);
  if (format) return format;
  if (isFoul(normalizeUsername(raw as string))) return "That username is not allowed";
  return null;
}
