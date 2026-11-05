import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const user = await requireUser("/app/profilo");
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Profilo" />
      <Card>
        <CardBody className="sm:p-8">
          <ProfileForm
            nome={user.profile?.nome ?? ""}
            cognome={user.profile?.cognome ?? ""}
            email={user.email}
            marketing={user.membership?.consenso_marketing ?? false}
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="sm:p-8">
          <CardTitle>Password</CardTitle>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </CardBody>
      </Card>
      <form action="/esci" method="post">
        <Button type="submit" variant="secondary">
          <LogOut aria-hidden /> Esci
        </Button>
      </form>
    </div>
  );
}
