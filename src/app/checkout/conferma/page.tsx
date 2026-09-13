import { Suspense } from "react";
import { OrderConfirmation } from "@/components/OrderConfirmation";

export const metadata = { title: "Ordine confermato" };

export default function ConfermaPage() {
  return (
    <Suspense fallback={<div className="container-editorial py-24" />}>
      <OrderConfirmation />
    </Suspense>
  );
}
