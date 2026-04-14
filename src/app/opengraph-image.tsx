import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Envoy — Support that runs itself";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "src/app/fonts/DMSans-Bold.ttf")
  );

  return new ImageResponse(
    (
      <div style={{ background: "#FAF8F5", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", fontFamily: "DM Sans" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "linear-gradient(90deg, #2D6A4F 0%, #95D5B2 50%, #E09F3E 100%)", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
          <svg width="38" height="38" viewBox="0 0 19 19" fill="none"><path d="M18.1852 0.0127508L0.130847 6.66435C-0.0469936 6.72987-0.0424457 6.98296 0.137634 7.04205L7.3403 9.40542C7.49762 9.45704 7.6703 9.42743 7.80144 9.32635L12.9798 5.3347C13.0726 5.26316 13.1916 5.38214 13.12 5.47495L9.1284 10.6533C9.02731 10.7844 8.9977 10.9571 9.04932 11.1144L11.4127 18.3171C11.4718 18.4972 11.7249 18.5017 11.7904 18.3239L18.442 0.269561C18.501 0.109459 18.3453-0.0462341 18.1852 0.0127508Z" fill="#2D6A4F"/></svg>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em" }}>envoy</span>
        </div>
        <div style={{ fontSize: "72px", fontWeight: 700, color: "#1B4332", lineHeight: 1.08, letterSpacing: "-0.03em", display: "flex" }}>Support that runs itself</div>
        <div style={{ position: "absolute", bottom: "48px", left: "80px", fontSize: "20px", fontWeight: 700, color: "#6B6560", letterSpacing: "0.02em", display: "flex" }}>byenvoy.com</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "DM Sans",
          data: font,
          style: "normal" as const,
          weight: 700 as const,
        },
      ],
    },
  );
}
