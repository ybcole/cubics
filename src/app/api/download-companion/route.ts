import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, mkdirSync, cpSync, rmSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

export async function GET() {
  const src = join(process.cwd(), "cubics-companion");
  const tmp = join(process.cwd(), ".tmp-ext");

  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  cpSync(src, join(tmp, "cubics-companion"), { recursive: true });

  const outZip = join(process.cwd(), ".next", "cubics-companion.zip");
  execSync(`cd "${tmp}" && zip -r "${outZip}" cubics-companion`);

  rmSync(tmp, { recursive: true, force: true });

  const zip = readFileSync(outZip);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="cubics-companion.zip"',
    },
  });
}
