import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type ReverseGeo = {
  city: string;
  district: string;
  address: string;
};

/**
 * تحويل الإحداثيات إلى عنوان عبر خدمة OpenStreetMap المجانية (بدون أي مفتاح API).
 * يُنفَّذ على الخادم كي لا تُكشف أي بيانات أو مفاتيح في المتصفح.
 */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<ReverseGeo> => {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ar` +
      `&lat=${data.lat}&lon=${data.lng}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "ehab-store/1.0" } });
      if (!res.ok) throw new Error("geocode failed");
      const json = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const a = json.address ?? {};
      const city = a["state"] || a["city"] || a["governorate"] || a["town"] || a["village"] || "";
      const district = a["county"] || a["city_district"] || a["suburb"] || a["neighbourhood"] || "";
      const street = [a["road"], a["neighbourhood"], a["suburb"]].filter(Boolean).join(" - ");
      return {
        city,
        district,
        address: street || json.display_name || "",
      };
    } catch {
      return { city: "", district: "", address: "" };
    }
  });
