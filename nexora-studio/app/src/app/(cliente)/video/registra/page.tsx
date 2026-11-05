import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { TeleprompterRecorder } from "@/components/videos/teleprompter-recorder";
import { BLOCK_MESSAGES, getPlanUsage } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Registra con il teleprompter" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Registrazione dal browser con il testo dello script a schermo (fotocamera frontale). */
export default async function RegistraPage(props: PageProps<"/video/registra">) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const { script: scriptParam } = await props.searchParams;

  // Prima di registrare: se il piano non consente nuovi montaggi lo diciamo subito.
  const { blocked } = await getPlanUsage(ws);
  if (blocked) {
    const b = BLOCK_MESSAGES[blocked];
    return (
      <PageContainer className="max-w-2xl">
        <EmptyState
          icon={CreditCard}
          title={b.title}
          description={b.text}
          action={
            <Button variant="brand" asChild>
              <Link href="/piano">{b.cta}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  let script: { id: string; title: string; hook: string; body: string } | null = null;
  if (typeof scriptParam === "string" && UUID_RE.test(scriptParam)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("scripts")
      .select("id, title, hook, body, workspace_id")
      .eq("id", scriptParam)
      .maybeSingle();
    if (data && data.workspace_id === ws.id)
      script = { id: data.id, title: data.title, hook: data.hook, body: data.body };
  }

  return <TeleprompterRecorder workspaceId={ws.id} script={script} />;
}
