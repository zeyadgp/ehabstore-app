import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ASSISTANT_SETTINGS,
  getAssistantSettingsServer,
  saveAssistantSettingsServer,
  chatWithStoreAssistantServer,
  testAssistantConnectionServer,
  assistantSettingsSchema,
  type AssistantSettings,
  type ChatMessage,
  type ProductCatalogBrief,
  type AiModelProvider,
} from "@/lib/assistant-settings.functions";

const LOCAL_STORAGE_KEY = "store_ai_assistant_settings";
const QUERY_KEY = ["store-ai-assistant-settings"];

function getStoredLocal(): AssistantSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = assistantSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useAssistantSettings() {
  const fetchServer = useServerFn(getAssistantSettingsServer);

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AssistantSettings> => {
      try {
        const res = await fetchServer();
        if (res) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res));
            } catch {
              /* ignore */
            }
          }
          return res;
        }
      } catch {
        // Fallback to client-side supabase
        try {
          const { data } = await supabase
            .from("site_settings")
            .select("value")
            .eq("key", "store_ai_assistant_settings")
            .maybeSingle();

          if (data?.value) {
            const parsed = assistantSettingsSchema.safeParse(JSON.parse(data.value));
            if (parsed.success) {
              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed.data));
                } catch {
                  /* ignore */
                }
              }
              return parsed.data;
            }
          }
        } catch {
          /* ignore */
        }
      }

      return getStoredLocal() ?? DEFAULT_ASSISTANT_SETTINGS;
    },
    initialData: getStoredLocal() ?? DEFAULT_ASSISTANT_SETTINGS,
    staleTime: 30_000,
  });
}

export function useSaveAssistantSettings() {
  const qc = useQueryClient();
  const saveServer = useServerFn(saveAssistantSettingsServer);

  return useMutation({
    mutationFn: async (settings: AssistantSettings) => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        } catch {
          /* ignore */
        }
      }

      try {
        await saveServer({ data: settings });
      } catch {
        // Direct supabase client fallback
        const json = JSON.stringify(settings);
        const { data: existing } = await supabase
          .from("site_settings")
          .select("id")
          .eq("key", "store_ai_assistant_settings")
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("site_settings")
            .update({ value: json, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase.from("site_settings").insert({
            key: "store_ai_assistant_settings",
            value: json,
            group: "store_features",
            description: "إعدادات مساعد الذكاء الاصطناعي ونماذج المفاتيح والتعطيل",
          });
        }
      }

      return settings;
    },
    onSuccess: (saved) => {
      qc.setQueryData(QUERY_KEY, saved);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useTestAssistantConnection() {
  const testServer = useServerFn(testAssistantConnectionServer);
  return useMutation({
    mutationFn: async (payload: {
      provider: AiModelProvider;
      apiKey?: string;
      model?: string;
      geminiModel?: string;
      geminiAutoFallback?: boolean;
    }) => {
      return await testServer({ data: payload });
    },
  });
}

export type ConversationMessage = ChatMessage & {
  id: string;
  timestamp: number;
  recommendedProductIds?: string[];
};

export function useAssistantChat(products: ProductCatalogBrief[]) {
  const { data: settings } = useAssistantSettings();
  const chatServer = useServerFn(chatWithStoreAssistantServer);

  const initialGreeting: ConversationMessage = {
    id: "init-1",
    role: "assistant",
    content: settings?.welcomeMessage || DEFAULT_ASSISTANT_SETTINGS.welcomeMessage,
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<ConversationMessage[]>([initialGreeting]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || loading) return;

      const userMsg: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const payloadMessages: ChatMessage[] = nextMessages
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await chatServer({
          data: {
            messages: payloadMessages,
            products: products.slice(0, 40),
          },
        });

        const assistantMsg: ConversationMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          recommendedProductIds: res.recommendedProductIds,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg: ConversationMessage = {
          id: `asst-err-${Date.now()}`,
          role: "assistant",
          content:
            err?.message ||
            "عذراً، حدث خطأ أثناء الاتصال بمساعد الذكاء الاصطناعي. تفضلي بطرح سؤالك مرة أخرى.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, chatServer, products],
  );

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: "assistant",
        content: settings?.welcomeMessage || DEFAULT_ASSISTANT_SETTINGS.welcomeMessage,
        timestamp: Date.now(),
      },
    ]);
  }, [settings?.welcomeMessage]);

  return {
    messages,
    sendMessage,
    resetChat,
    loading,
  };
}
