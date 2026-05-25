import { ImageResponse } from "next/og";

// Larger PNG referenced by the PWA manifest as the 512x512 maskable icon.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function IconLarge() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #047857 0%, #064e3b 100%)",
          color: "white",
          fontSize: 300,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        26
      </div>
    ),
    { ...size },
  );
}
