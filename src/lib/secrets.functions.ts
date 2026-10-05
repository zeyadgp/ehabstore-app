import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";

export type SecretItem = {
  name: string;
  hasValue: boolean;
};

export const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "LOVABLE_API_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_ID",
  "CALLMEBOT_APIKEY",
  "RESEND_API_KEY",
  "ORDER_EMAIL_FROM",
  "LOVABLE_CRON_SECRET",
  "LOVABLE_CRON_SECRET_PREVIOUS",
] as const;

export const getInternalSecrets = createServerFn({ method: "GET" }).handler(
  async (): Promise<SecretItem[]> => {
    await requireAdminCaller();

    return SECRET_NAMES.map((name) => ({
      name,
      hasValue: Boolean(process.env[name]?.trim()),
    }));
  },
);
