import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/db";
import { dateTimeFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Brickweld" },
      {
        name: "description",
        content: "Manage user roles and business configuration for the construction control system.",
      },
      { property: "og:title", content: "Settings — Brickweld" },
      { property: "og:description", content: "Role assignment and application configuration." },
    ],
  }),
  component: SettingsPage,
});

type Profile = { id: string; full_name: string; email: string | null; phone: string | null };
type RoleRow = { id: string; user_id: string; role: AppRole; created_at: string };
type Setting = { key: string; value: unknown; description: string | null; updated_at: string };

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as AppRole[]).map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));

function SettingsPage() {
  const { isMD, roles: myRoles, user, refreshRoles } = useAuth();

  const profiles = useRows<Profile>("profiles", { order: { col: "full_name", asc: true } });
  const userRoles = useRows<RoleRow>("user_roles", { order: { col: "created_at", asc: true } });
  const settings = useRows<Setting>("app_settings", { order: { col: "key", asc: true } });

  const saveRole = useSaveRow("user_roles", "Role");
  const deleteRole = useDeleteRow("user_roles", "Role");
  const saveSetting = useSaveRow("app_settings", "Setting");

  const [editing, setEditing] = useState<Setting | null>(null);

  const roleFields: Field[] = [
    {
      name: "user_id",
      label: "User",
      type: "select",
      required: true,
      options: (profiles.data ?? []).map((p) => ({
        value: p.id,
        label: p.email ? `${p.full_name} (${p.email})` : p.full_name,
      })),
      full: true,
    },
    { name: "role", label: "Role", type: "select", required: true, options: ROLE_OPTIONS, full: true },
  ];

  const rolesByUser = (userId: string) => (userRoles.data ?? []).filter((r) => r.user_id === userId);
  const nameOf = (userId: string) =>
    profiles.data?.find((p) => p.id === userId)?.full_name ?? userId.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Role-based access and business configuration."
        actions={
          <Badge variant="secondary">
            You: {myRoles.length ? myRoles.map((r) => ROLE_LABEL[r]).join(", ") : "No role"}
          </Badge>
        }
      />

      {!isMD && (
        <Card className="mb-4 border-warning/40">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Only an MD / Administrator can change roles or configuration. You have read-only access here.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="roles">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="roles">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="config">App settings</TabsTrigger>
          <TabsTrigger value="company">Company info</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Users</CardTitle>
              {isMD && (
                <FormDialog
                  title="Assign role"
                  description="Grant a role to an existing user."
                  fields={roleFields}
                  submitting={saveRole.isPending}
                  trigger={
                    <Button size="sm">
                      <Plus className="mr-2 size-4" /> Assign role
                    </Button>
                  }
                  onSubmit={async (values) => {
                    await saveRole.mutateAsync({
                      values: { user_id: String(values["user_id"]), role: String(values["role"]) },
                    });
                    if (String(values["user_id"]) === user?.id) await refreshRoles();
                  }}
                />
              )}
            </CardHeader>
            <CardContent>
              <DataTable
                rows={profiles.data ?? []}
                loading={profiles.isLoading || userRoles.isLoading}
                exportName="users-and-roles"
                empty="No users yet."
                columns={[
                  { header: "Name", cell: (r) => r.full_name, value: (r) => r.full_name },
                  { header: "Email", cell: (r) => r.email ?? "—", value: (r) => r.email },
                  { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
                  {
                    header: "Roles",
                    cell: (r) => {
                      const rs = rolesByUser(r.id);
                      if (!rs.length) return <span className="text-muted-foreground">No role</span>;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {rs.map((x) => (
                            <Badge key={x.id} variant={x.role === "md" ? "default" : "secondary"}>
                              {ROLE_LABEL[x.role]}
                            </Badge>
                          ))}
                        </div>
                      );
                    },
                    value: (r) => rolesByUser(r.id).map((x) => x.role).join(" "),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={userRoles.data ?? []}
                loading={userRoles.isLoading}
                exportName="role-assignments"
                empty="No roles assigned yet."
                columns={[
                  { header: "User", cell: (r) => nameOf(r.user_id), value: (r) => nameOf(r.user_id) },
                  { header: "Role", cell: (r) => ROLE_LABEL[r.role], value: (r) => r.role },
                  {
                    header: "Granted",
                    cell: (r) => dateTimeFmt(r.created_at),
                    value: (r) => r.created_at,
                  },
                  {
                    header: "",
                    className: "text-right",
                    cell: (r) =>
                      isMD ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove role"
                          disabled={deleteRole.isPending}
                          onClick={async () => {
                            await deleteRole.mutateAsync(r.id);
                            if (r.user_id === user?.id) await refreshRoles();
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application settings</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={(settings.data ?? []).map((s) => ({ ...s, id: s.key }))}
                loading={settings.isLoading}
                exportName="app-settings"
                empty="No configuration entries."
                columns={[
                  { header: "Key", cell: (r) => r.key, value: (r) => r.key },
                  {
                    header: "Value",
                    cell: (r) => <code className="text-xs">{JSON.stringify(r.value)}</code>,
                    value: (r) => JSON.stringify(r.value),
                  },
                  { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
                  {
                    header: "Updated",
                    cell: (r) => dateTimeFmt(r.updated_at),
                    value: (r) => r.updated_at,
                  },
                  {
                    header: "",
                    className: "text-right",
                    cell: (r) =>
                      isMD ? (
                        <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Company name</p>
                  <p className="mt-1 font-medium text-foreground">Brickweld</p>
                  <p className="text-xs text-muted-foreground">Civil - Interior - Fabrication</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone number</p>
                  <p className="mt-1 font-medium text-foreground">+91-9742255005</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Email address</p>
                  <p className="mt-1 font-medium text-foreground">rajesh@brickweld.org.in</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Registered address</p>
                  <p className="mt-1 text-sm text-foreground">
                    No.106/A, G.K.D.Nagar, Sri Dhasappa Kalyana Mandapam, Avalapalli Road, Hosur, Tamil Nadu 635109
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editing && (
        <FormDialog
          key={editing.key}
          title={`Edit ${editing.key}`}
          description="Value must be valid JSON (for example 8, true, or {\u0022rate\u0022: 500})."
          open
          onOpenChange={(v) => {
            if (!v) setEditing(null);
          }}
          submitting={saveSetting.isPending}
          fields={[
            { name: "value", label: "Value (JSON)", type: "textarea", required: true, full: true },
            { name: "description", label: "Description", type: "text", full: true },
          ]}
          initial={{
            value: JSON.stringify(editing.value),
            description: editing.description ?? "",
          }}
          onSubmit={async (values) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(String(values["value"]));
            } catch {
              throw new Error("Value is not valid JSON");
            }
            await saveSetting.mutateAsync({
              id: editing.key,
              values: { value: parsed, description: values["description"] || null },
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
