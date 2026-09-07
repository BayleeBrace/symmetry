import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Symmetry Barbers in Saundersfoot — same chairs, new name";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [photo, wordmark] = await Promise.all([
    readFile(join(process.cwd(), "public/images/shop-hero.jpg")),
    readFile(join(process.cwd(), "public/symmetry-wordmark.svg")),
  ]);
  const photoUrl = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const wordmarkUrl = `data:image/svg+xml;base64,${wordmark.toString("base64")}`;

  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#161616", color: "#ffffff" }}>
      <img src={photoUrl} alt="" width="1200" height="1600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 54%" }} />
      <div style={{ display: "flex", position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(22,22,22,.96) 0%, rgba(22,22,22,.78) 43%, rgba(22,22,22,.24) 74%, rgba(22,22,22,.16) 100%), linear-gradient(0deg, rgba(22,22,22,.66), transparent 50%)" }} />
      <div style={{ display: "flex", position: "relative", width: "100%", padding: "62px 64px", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <img src={wordmarkUrl} alt="Symmetry" width="430" height="62" style={{ width: 430, height: 62, objectFit: "contain" }} />
          <div style={{ display: "flex", marginTop: 13, color: "#d0cbc5", fontSize: 18, fontWeight: 300, letterSpacing: "0.22em" }}>BARBERS · SAUNDERSFOOT</div>
        </div>
        <div style={{ display: "flex", width: 530, flexDirection: "column" }}>
          <div style={{ display: "flex", width: 88, height: 3, marginBottom: 24, background: "#7b3d46" }} />
          <div style={{ display: "flex", color: "#ffffff", fontSize: 43, fontWeight: 300, letterSpacing: "-0.025em" }}>same chairs. new name.</div>
          <div style={{ display: "flex", marginTop: 15, color: "#cdb9bb", fontSize: 18, fontWeight: 300, letterSpacing: "0.14em", textTransform: "uppercase" }}>cuts, fades and beards · saundersfoot</div>
        </div>
      </div>
    </div>,
    size,
  );
}
