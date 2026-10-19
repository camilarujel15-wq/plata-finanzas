import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Íconos PNG para el manifest (192/512, incluye variante maskable con margen seguro). */
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const maskable = params.size.endsWith("m");
  const size = Math.min(1024, Math.max(48, parseInt(params.size, 10) || 192));
  const radius = maskable ? 0 : size * 0.22;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16a34a",
          borderRadius: radius,
          color: "white",
          fontSize: size * (maskable ? 0.34 : 0.45),
          fontWeight: 800,
          letterSpacing: -size * 0.01,
        }}
      >
        S/
      </div>
    ),
    { width: size, height: size },
  );
}
