import { useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useAuth, useSessione } from "@/lib/auth";
import { RUOLI } from "@/lib/labels";
import { navPerRuolo } from "./nav";

/** Su telefono: tutte le voci che non stanno nella barra in basso. */
export function MenuMobile() {
  const { ruolo, profilo } = useSessione();
  const { esci } = useAuth();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3 font-medium hover:bg-muted lg:hidden">
        <Menu className="size-5" aria-hidden />
        Menu
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {profilo.nome} · {RUOLI[ruolo]}
        </DropdownMenuLabel>
        {navPerRuolo(ruolo).map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} onSelect={() => navigate(to)}>
            <Icon aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void esci()}>
          <LogOut aria-hidden />
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
