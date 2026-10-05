import QRCode from "qrcode";

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
}

/**
 * Encodes a string or buffer into a TLV (Tag-Length-Value) Uint8Array byte sequence
 * according to ZATCA (الهيئة العامة للزكاة والضريبة والجمارك) Phase 1 & 2 e-invoicing specs.
 */
function toTlv(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const length = valueBytes.length;
  const result = new Uint8Array(2 + length);
  result[0] = tag;
  result[1] = length;
  result.set(valueBytes, 2);
  return result;
}

/**
 * Builds the combined TLV buffer and converts it to a standard Base64 string.
 */
export function buildZatcaTlvBase64(data: ZatcaInvoiceData): string {
  const tlv1 = toTlv(1, data.sellerName);
  const tlv2 = toTlv(2, data.vatNumber || "300000000000003");
  const tlv3 = toTlv(3, data.timestamp);
  const tlv4 = toTlv(4, data.totalWithVat.toFixed(2));
  const tlv5 = toTlv(5, data.vatAmount.toFixed(2));

  const totalLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const part of [tlv1, tlv2, tlv3, tlv4, tlv5]) {
    combined.set(part, offset);
    offset += part.length;
  }

  // Convert Uint8Array to binary string, then btoa
  let binary = "";
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i] ?? 0);
  }
  return btoa(binary);
}

/**
 * Generates an SVG or PNG Data URL QR code for the ZATCA compliant invoice.
 */
export async function generateZatcaQrDataUrl(data: ZatcaInvoiceData): Promise<string> {
  const base64Data = buildZatcaTlvBase64(data);
  try {
    return await QRCode.toDataURL(base64Data, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
      color: {
        dark: "#18181b",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Failed to generate ZATCA QR code:", err);
    return "";
  }
}
