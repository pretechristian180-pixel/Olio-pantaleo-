import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthProvider";

function FullPageLoading() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-24" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

/** Le schermate dell'app richiedono un utente collegato con profilo attivo. */
export function RequireAuth() {
  const { loading, session, agent, noProfile, mustSetPassword, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/accedi" replace state={{ from: location.pathname }} />;
  if (mustSetPassword) return <Navigate to="/imposta-password" replace />;
  if (noProfile || !agent)
    return (
      <AuthLayout
        title="Account non attivo"
        subtitle="Non troviamo un profilo attivo collegato a questo account. Se fai parte di un'agenzia, chiedi al titolare di riattivarti."
      >
        <Button size="lg" variant="outline" className="w-full" onClick={signOut}>
          <LogOut aria-hidden />
          Esci
        </Button>
      </AuthLayout>
    );
  return <Outlet />;
}

/** Login e registrazione: se sei già dentro, vai all'app. */
export function GuestOnly() {
  const { loading, session, mustSetPassword } = useAuth();
  if (loading) return <FullPageLoading />;
  if (session && mustSetPassword) return <Navigate to="/imposta-password" replace />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
