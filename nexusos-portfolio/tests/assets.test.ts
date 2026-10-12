import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  DEGREE_PRIVACY_NOTICE,
  currentDesignShots,
  cv,
  degree,
  folders,
  portfolio2026Redacted,
  projectSummaryRedacted,
} from "~/data/assets";

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const all = [...new Map(folders.flatMap((f) => f.assets).map((a) => [a.id, a])).values()];
const onDisk = (p: string) => fs.existsSync(path.join(publicDir, p));
const served = (p: string) => fs.readFileSync(path.join(publicDir, p));

/** Raw bytes plus every inflatable stream, so text inside compressed content streams is visible. */
function pdfPlainBytes(file: Buffer): string {
  const parts = [file.toString("latin1")];
  let at = 0;
  for (;;) {
    const start = file.indexOf("stream", at, "latin1");
    if (start < 0) break;
    const body = start + (file[start + 6] === 0x0d ? 8 : 7);
    const end = file.indexOf("endstream", body, "latin1");
    if (end < 0) break;
    try {
      parts.push(zlib.inflateSync(file.subarray(body, end)).toString("latin1"));
    } catch {
      /* not a flate stream */
    }
    at = end + 9;
  }
  return parts.join("\n");
}

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe("asset registry", () => {
  it("every published asset and its preview exists under public/", () => {
    for (const a of all.filter((x) => x.status === "published")) {
      expect(onDisk(a.src), a.src).toBe(true);
      if (a.preview) expect(onDisk(a.preview), a.preview).toBe(true);
    }
  });

  it("withheld documents are never shipped as static files", () => {
    for (const a of all.filter((x) => x.status === "withheld")) {
      expect(onDisk(a.src), `${a.src} must not be in public/ while withheld`).toBe(false);
    }
  });

  it("asset ids are unique across folders", () => {
    const ids = folders.flatMap((f) => f.assets.map((a) => `${f.id}/${a.id}`));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("personal documents", () => {
  it("publishes the German CV as the only CV", () => {
    expect(cv.status).toBe("published");
    expect(all.filter((a) => /(^|-)cv(-|$)/.test(a.id)).map((a) => a.id)).toEqual(["cv-de"]);
  });

  it("serves the original degree certificate byte-for-byte", () => {
    expect(degree.status).toBe("published");
    const sha = crypto.createHash("sha256").update(served(degree.src)).digest("hex");
    expect(sha).toBe("6de4e19490780c64cf733d43860ddf7ef5453e0694894a7484e2ca077566a735");
  });

  it("shows the exact privacy notice and no preview that would reveal the certificate", () => {
    expect(degree.notice).toBe(
      "Privacy notice: This original degree certificate contains personal information, including date and place of birth, a diploma number, and signatures. Opening or downloading it will reveal these details.",
    );
    expect(degree.notice).toBe(DEGREE_PRIVACY_NOTICE);
    expect(degree.preview).toBeUndefined();
  });

  it.each([portfolio2026Redacted, projectSummaryRedacted])("$title has the removed values gone from every layer", (asset) => {
    expect(asset.label).toBe("Redacted copy");
    expect(asset.src).toMatch(/-redacted\.pdf$/);
    const plain = pdfPlainBytes(served(asset.src));
    expect(plain).toContain("REDACTED COPY");
    for (const gone of ["11/12/1997", "1997", "28 years", "waley7337/NexusOS"]) {
      expect(plain.includes(gone), `${asset.src} still contains ${gone}`).toBe(false);
    }
  });
});

describe("links and screenshots", () => {
  it("never links the private repository", () => {
    const files = [...walk(path.join(root, "src")), path.join(root, "index.html")];
    for (const f of files) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/github\.com\/waley7337\/nexusos/i);
    }
  });

  it("shows current-design screenshots only; legacy originals are not served", () => {
    for (const s of currentDesignShots) expect(s.src).toMatch(/^\/images\/screenshots\/current-design\//);
    expect(fs.existsSync(path.join(publicDir, "images/screenshots/legacy"))).toBe(false);
    expect(fs.existsSync(path.join(publicDir, "images/system"))).toBe(false);
    expect(fs.readdirSync(path.join(root, "assets/screenshots/legacy")).filter((f) => f.endsWith(".png"))).toHaveLength(16);
  });
});
