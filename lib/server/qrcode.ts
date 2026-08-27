import "server-only";
import QRCode from "qrcode";

/** Renders a QR code for the given text as a data: URL PNG, styled to match the dark turf theme. */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: {
      dark: "#05100a",
      light: "#f4f7f2",
    },
  });
}
