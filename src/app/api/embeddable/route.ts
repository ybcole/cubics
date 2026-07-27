import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url).searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });

    // Try HEAD first to avoid downloading large bodies
    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    } catch (headErr) {
      // Some servers don't support HEAD; fallback to GET but don't read body
      res = await fetch(url, { method: 'GET', redirect: 'follow' });
    }

    const xfo = res.headers.get('x-frame-options');
    const csp = res.headers.get('content-security-policy');
    const frameAncestorsMatch = csp ? csp.match(/frame-ancestors\s+([^;]+)/i) : null;
    const frameAncestors = frameAncestorsMatch ? frameAncestorsMatch[1] : null;

    const blockedByXFO = xfo && /deny|sameorigin/i.test(xfo);
    const blockedByFrameAncestors = frameAncestors && /none/i.test(frameAncestors);

    const embeddable = !blockedByXFO && !blockedByFrameAncestors;

    return NextResponse.json(
      {
        embeddable,
        status: res.status,
        headers: {
          'x-frame-options': xfo,
          'content-security-policy': csp,
          frameAncestors,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ embeddable: false, error: String(err.message || err) }, { status: 200 });
  }
}
