import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-md p-4 text-sm leading-5",
        tone === "error" ? "bg-negative/8 text-negative" : "bg-positive-tint text-positive-deep",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
