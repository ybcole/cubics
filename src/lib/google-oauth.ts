export function withEnglishGoogleUi(url: URL | null): string | null {
  if (!url) return null;
  const next = new URL(url.toString());
  next.searchParams.set("hl", "en-US");
  return next.toString();
}
