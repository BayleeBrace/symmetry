import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

type OgImageOptions = {
  eyebrow: string;
  title: string;
  detail: string;
};

export async function createBrandedOgImage({
  eyebrow,
  title,
  detail,
}: OgImageOptions) {
  const [photo, wordmark, serif, sans] = await Promise.all([
    readFile(join(process.cwd(), "public/images/shop-hero.jpg")),
    readFile(join(process.cwd(), "public/symmetry-wordmark.svg")),
    readFile(join(process.cwd(), "public/fonts/og-serif.ttf")),
    readFile(join(process.cwd(), "public/fonts/og-sans.ttf")),
  ]);

  const photoUrl = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const wordmarkUrl = `data:image/svg+xml;base64,${wordmark.toString("base64")}`;

  const rendered = new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#161616",
        color: "#ffffff",
      }}
    >
      {/* ImageResponse requires native image elements for embedded data URLs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt=""
        width="1200"
        height="1600"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 54%",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(15,15,15,.5)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage:
            "linear-gradient(90deg, rgba(22,22,22,.94) 0%, rgba(22,22,22,.8) 48%, rgba(22,22,22,.22) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          padding: "58px 64px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wordmarkUrl}
            alt="Symmetry"
            width="430"
            height="62"
            style={{ width: 430, height: 62, objectFit: "contain" }}
          />
          <div
            style={{
              display: "flex",
              marginTop: 14,
              color: "#e0dbd5",
              fontFamily: "Brand Sans",
              fontSize: 17,
              fontWeight: 300,
              letterSpacing: "0.24em",
            }}
          >
            BARBERS · SAUNDERSFOOT
          </div>
        </div>

        <div style={{ display: "flex", width: 620, flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              marginBottom: 14,
              color: "rgba(255,255,255,.7)",
              fontFamily: "Brand Sans",
              fontSize: 16,
              fontWeight: 300,
              letterSpacing: "0.18em",
            }}
          >
            {eyebrow.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontFamily: "Brand Serif",
              fontSize: 72,
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              whiteSpace: "pre-line",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              width: 72,
              height: 2,
              margin: "23px 0 18px",
              background: "#4a2026",
            }}
          />
          <div
            style={{
              display: "flex",
              color: "#d3cec8",
              fontFamily: "Brand Sans",
              fontSize: 19,
              fontWeight: 300,
              letterSpacing: "0.035em",
            }}
          >
            {detail}
          </div>
        </div>
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      fonts: [
        { name: "Brand Serif", data: serif, style: "normal", weight: 300 },
        { name: "Brand Sans", data: sans, style: "normal", weight: 300 },
      ],
    },
  );
  const jpeg = await sharp(Buffer.from(await rendered.arrayBuffer()))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg" },
  });
}
