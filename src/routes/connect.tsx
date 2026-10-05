import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Link2, RefreshCw, Terminal } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/lib/store";

const title = "ربط المساعد الذكي | إيهاب ستور";
const description =
  "خطوات ربط إيهاب ستور مع ChatGPT وClaude وClaude Code والمساعدات التي تدعم MCP.";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectPage,
});

type ClientId = "chatgpt" | "claude" | "claude-code" | "other";

const clientLabels: Record<ClientId, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  "claude-code": "Claude Code",
  other: "مساعد آخر",
};

function slugifyAppName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  const safeSlug = slug || "lovable-app";
  const reserved = new Set([
    "workspace",
    "computer-use",
    "claude-in-chrome",
    "claude-preview",
    "claude-browser",
  ]);
  return reserved.has(safeSlug) ? `${safeSlug}-app` : safeSlug;
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function ConnectPage() {
  const { data: settings } = useSettings();
  const [mcpUrl, setMcpUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const appName = settings?.store_name?.trim() || "إيهاب ستور";
  const appSlug = useMemo(() => slugifyAppName(appName), [appName]);
  const claudeCommand = useMemo(
    () =>
      mcpUrl
        ? `claude mcp add --scope user --transport http ${appSlug} ${quoteForShell(mcpUrl)}`
        : "",
    [appSlug, mcpUrl],
  );
  const claudeUrl = useMemo(
    () =>
      mcpUrl
        ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(appName)}&connectorUrl=${encodeURIComponent(mcpUrl)}`
        : "https://claude.ai/customize/connectors",
    [appName, mcpUrl],
  );

  useEffect(() => {
    setMcpUrl(new URL("/mcp", window.location.origin).toString());
  }, []);

  async function copyValue(value: string, key: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("تم النسخ بنجاح");
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("تعذر النسخ، حدّد النص وانسخه يدوياً");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
          <Link2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-foreground sm:text-4xl">
          ربط المساعد الذكي
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          اربط مساعدك بالمتجر للبحث عن المنتجات والأقسام، ويمكن للمدير متابعة الطلبات وتحديثها.
        </p>
      </header>

      <section aria-labelledby="server-url" className="mt-10 border-y border-border py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="server-url" className="text-lg font-extrabold text-foreground">
              رابط خادم المتجر
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">انسخ هذا الرابط عند إعداد الاتصال.</p>
          </div>
          <Button
            type="button"
            onClick={() => void copyValue(mcpUrl, "url")}
            disabled={!mcpUrl}
            className="h-11 shrink-0"
          >
            {copied === "url" ? <Check /> : <Copy />}
            {copied === "url" ? "تم النسخ" : "نسخ الرابط"}
          </Button>
        </div>
        <div
          dir="ltr"
          className="mt-4 min-h-14 overflow-x-auto rounded-md border border-border bg-muted px-4 py-4 text-left font-mono text-sm text-foreground"
        >
          {mcpUrl || "جارٍ تجهيز الرابط…"}
        </div>
      </section>

      <InstructionSection
        title="طريقة الاتصال"
        subtitle="اختر مساعداً واتبع خطواته بالترتيب."
        icon={<Link2 className="h-5 w-5" aria-hidden="true" />}
      >
        <Tabs defaultValue="chatgpt" dir="rtl">
          <ClientTabs />
          <TabsContent value="chatgpt">
            <Steps
              items={[
                <>
                  افتح{" "}
                  <ExternalAnchor href="https://chatgpt.com/#settings/Connectors/Advanced">
                    إعدادات التطبيقات
                  </ExternalAnchor>{" "}
                  وفعّل وضع المطور بعد قراءة التنبيه. إذا لم يظهر الخيار، اطلب من مسؤول حساب ChatGPT
                  تفعيله.
                </>,
                <>
                  افتح{" "}
                  <ExternalAnchor href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins">
                    إضافة تطبيق جديد
                  </ExternalAnchor>
                  .
                </>,
                <>اكتب اسم المتجر في خانة الاسم، ثم الصق رابط خادم المتجر في خانة الرابط.</>,
                <>راجع التفاصيل، فعّل خيار الموافقة على المتابعة، ثم اضغط «إنشاء».</>,
                <>فعّل التطبيق من شريط المحادثة، ثم اطلب من ChatGPT استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
          <TabsContent value="claude">
            <Steps
              items={[
                <>
                  افتح <ExternalAnchor href={claudeUrl}>إضافة موصل Claude</ExternalAnchor>، وستظهر
                  بيانات المتجر جاهزة.
                </>,
                <>راجع الاسم والرابط، ثم اضغط «إضافة».</>,
                <>
                  إذا لم يفتح النموذج الجاهز، افتح صفحة الموصلات في Claude، واختر إضافة موصل مخصص،
                  ثم الصق الرابط أعلاه.
                </>,
                <>فعّل الموصل من شريط المحادثة، ثم اطلب من Claude استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
          <TabsContent value="claude-code">
            <Steps
              items={[
                <>انسخ الأمر التالي وشغّله في نافذة الأوامر:</>,
                <>
                  ابدأ Claude Code ثم اكتب <bdi dir="ltr">/mcp</bdi> للتأكد من الاتصال، وسجّل الدخول
                  من هناك إذا طُلب منك.
                </>,
                <>اطلب من Claude Code استخدام المتجر.</>,
              ]}
              afterFirst={
                <CopyBlock
                  value={claudeCommand}
                  copied={copied === "command"}
                  onCopy={() => void copyValue(claudeCommand, "command")}
                />
              }
            />
          </TabsContent>
          <TabsContent value="other">
            <Steps
              items={[
                <>افتح إعدادات خوادم MCP أو الموصلات المخصصة في مساعدك.</>,
                <>أنشئ اتصالاً جديداً بخادم MCP بعيد.</>,
                <>اكتب اسم المتجر والصق رابط خادم المتجر أعلاه.</>,
                <>أكمل تسجيل الدخول أو الموافقة إذا ظهرت لك.</>,
                <>فعّل الاتصال، ثم اطلب من المساعد استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
        </Tabs>
      </InstructionSection>

      <InstructionSection
        title="تحديث الاتصال بعد تغييرات المتجر"
        subtitle="حدّث الاتصال بعد نشر أي أدوات جديدة حتى يتعرّف عليها مساعدك."
        icon={<RefreshCw className="h-5 w-5" aria-hidden="true" />}
      >
        <Tabs defaultValue="chatgpt" dir="rtl">
          <ClientTabs />
          <TabsContent value="chatgpt">
            <Steps
              items={[
                <>افتح صفحة التطبيقات في ChatGPT واختر هذا المتجر.</>,
                <>مرّر إلى «المعلومات» واضغط «تحديث».</>,
                <>إذا تغيّر الرابط، احذف التطبيق وأعد خطوات الاتصال بالرابط الجديد.</>,
                <>ابدأ محادثة جديدة واطلب من ChatGPT استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
          <TabsContent value="claude">
            <Steps
              items={[
                <>افتح صفحة الموصلات في Claude واختر موصل المتجر.</>,
                <>حدّث أدوات الموصل أو أعد تحميلها.</>,
                <>إذا تغيّر الرابط، احذف الموصل وأعد إضافته بالرابط الجديد.</>,
                <>اطلب من Claude استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
          <TabsContent value="claude-code">
            <Steps
              items={[
                <>ابدأ جلسة Claude Code جديدة لتحميل أحدث أدوات المتجر.</>,
                <>
                  إذا تغيّر الرابط، شغّل <bdi dir="ltr">claude mcp remove {appSlug}</bdi> ثم شغّل
                  أمر التثبيت أعلاه من جديد.
                </>,
                <>اطلب من Claude Code استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
          <TabsContent value="other">
            <Steps
              items={[
                <>افتح إعدادات خادم MCP أو الموصل في مساعدك.</>,
                <>اختر اتصال المتجر وحدّث الأدوات أو أعد الاتصال.</>,
                <>إذا تغيّر الرابط، الصق أحدث رابط ظاهر أعلى الصفحة.</>,
                <>ابدأ محادثة جديدة واطلب من المساعد استخدام المتجر.</>,
              ]}
            />
          </TabsContent>
        </Tabs>
      </InstructionSection>
    </main>
  );
}

function InstructionSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12" aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ClientTabs() {
  return (
    <TabsList className="no-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
      {(Object.entries(clientLabels) as [ClientId, string][]).map(([id, label]) => (
        <TabsTrigger
          key={id}
          value={id}
          className="min-h-10 min-w-28 flex-1 px-3 text-xs sm:text-sm"
        >
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

function Steps({ items, afterFirst }: { items: ReactNode[]; afterFirst?: ReactNode }) {
  return (
    <ol className="mt-5 space-y-4">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-7 text-foreground">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-extrabold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div>{item}</div>
            {index === 0 ? afterFirst : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-4"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function CopyBlock({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted p-2"
      dir="ltr"
    >
      <code className="min-w-0 flex-1 overflow-x-auto px-2 py-2 text-left text-xs leading-6 text-foreground">
        {value || "جارٍ تجهيز الأمر…"}
      </code>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={onCopy}
        disabled={!value}
        aria-label="نسخ أمر Claude Code"
        title="نسخ الأمر"
      >
        {copied ? <Check /> : <Terminal />}
      </Button>
    </div>
  );
}
