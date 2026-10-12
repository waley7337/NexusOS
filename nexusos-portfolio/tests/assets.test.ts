import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cv, degree, folders } from "~/data/assets";

const publicDir = path.resolve(__dirname, "../public");
const all = [...new Map(folders.flatMap((f) => f.assets).map((a) => [a.id, a])).values()];
const onDisk = (p: string) => fs.existsSync(path.join(publicDir, p));

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

  it("publishes the real CV and withholds the degree pending a decision", () => {
    expect(cv.status).toBe("published");
    expect(degree.status).toBe("withheld");
  });

  it("asset ids are unique across folders", () => {
    const ids = folders.flatMap((f) => f.assets.map((a) => `${f.id}/${a.id}`));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
