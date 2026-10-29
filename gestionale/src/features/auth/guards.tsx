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
  const { loading, session, agent, noProfile, isPlatformAdmin, mustSetPassword, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/accedi" replace state={{ from: location.pathname }} />;
  if (mustSetPassword) return <Navigate to="/imposta-password" replace />;
  // L'admin della piattaforma senza agenzia va direttamente al pannello admin
  if ((noProfile || !agent) && isPlatformAdmin) return <Navigate to="/admin" replace />;
  if (noProfile || !agent)
    return (
      <AuthLayout
        title="Account non attivo"
        subtitle="Il tuo account o la tua agenzia non sono attivi in questo momento. Se fai parte di un'agenzia, chiedi al titolare di riattivarti; se sei il titolare, contatta Mattonio."
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

/** Pannello admin: solo per gli amministratori di Mattonio. */
export function RequireAdmin() {
  const { loading, session, isPlatformAdmin, mustSetPassword, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/accedi" replace state={{ from: location.pathname }} />;
  if (mustSetPassword) return <Navigate to="/imposta-password" replace />;
  if (!isPlatformAdmin)
    return (
      <AuthLayout title="Area riservata" subtitle="Questa sezione è solo per gli amministratori di Mattonio.">
        <Button size="lg" variant="outline" className="w-full" onClick={signOut}>
          <LogOut aria-hidden />
          Esci
        </Button>
      </AuthLayout>
    );
  return <Outlet />;
}
