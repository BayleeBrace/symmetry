import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Symmetry Barbers in Saundersfoot — same chairs, new name";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [photo, serif, wordmark] = await Promise.all([
    readFile(join(process.cwd(), "public/images/shop-hero.jpg")),
    readFile(join(process.cwd(), "public/fonts/og-serif.ttf")),
    readFile(join(process.cwd(), "public/symmetry-wordmark.svg")),
  ]);
  const photoUrl = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const wordmarkUrl = `data:image/svg+xml;base64,${wordmark.toString("base64")}`;

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#161616", color: "#ffffff" }}>
      <div style={{ display: "flex", width: "49%", padding: "70px 62px", flexDirection: "column", justifyContent: "space-between", borderRight: "7px solid #4a2026" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#cdb9bb", fontSize: 20, letterSpacing: "0.18em", textTransform: "uppercase" }}>barbers in saundersfoot</div>
          <div style={{ display: "flex", marginTop: 32, fontFamily: "BrandSerif", fontSize: 88, lineHeight: .82, letterSpacing: "-0.035em", flexDirection: "column" }}>
            <span>same chairs.</span>
            <span>new name.</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <img src={wordmarkUrl} alt="Symmetry" width="410" height="59" style={{ width: 410, height: 59, objectFit: "contain" }} />
          <div style={{ display: "flex", marginTop: 10, color: "#c8c3bd", fontSize: 17, letterSpacing: "0.2em" }}>BARBERS · SAUNDERSFOOT</div>
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", width: "51%", height: "100%", overflow: "hidden" }}>
        <img src={photoUrl} alt="" width="612" height="816" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%" }} />
        <div style={{ display: "flex", position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(22,22,22,.18), transparent 28%)" }} />
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "BrandSerif", data: serif, weight: 300, style: "normal" }],
    },
  );
}
