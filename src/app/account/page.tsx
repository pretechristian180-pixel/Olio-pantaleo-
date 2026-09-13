import type { Metadata } from "next";
import { AccountPanel } from "@/components/AccountPanel";

export const metadata: Metadata = { title: "Il tuo account" };

export default function AccountPage() {
  return (
    <section className="container-editorial py-16">
      <AccountPanel />
    </section>
  );
}
