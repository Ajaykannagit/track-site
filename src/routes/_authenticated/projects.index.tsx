import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, type Column } from "@/components/DataTable";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Brickweld" },
      { name: "description", content: "All construction projects with contract value, status and site details." },
      { property: "og:title", content: "Projects — Brickweld" },
      { property: "og:description", content: "Track every construction project from planning to handover." },
    ],
  }),
  component: ProjectsPage,
});

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
  quotation_amount: number;
  start_date: string | null;
  expected_completion_date: string | null;
  site_address: string | null;
  client_id: string | null;
};

function ProjectsPage() {
  const { canWriteFinance } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const projects = useRows<Project>("projects", { order: { col: "created_at" } });
  const clients = useRows<{ id: string; name: string }>("clients", { select: "id,name" });
  const save = useSaveRow("projects", "Project");

  const clientName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? "—";

  const filteredProjects = useMemo(() => {
    const list = projects.data ?? [];
    if (statusFilter === "active") return list.filter((p) => p.status === "active");
    if (statusFilter === "completed") return list.filter((p) => p.status === "completed");
    return list;
  }, [projects.data, statusFilter]);

  const columns: Column<Project>[] = [
    {
      header: "Project",
      cell: (r) => (
        <Link to="/projects/$projectId" params={{ projectId: r.id }} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
      value: (r) => r.name,
    },
    { header: "Code", cell: (r) => r.project_code, value: (r) => r.project_code },
    { header: "Client", cell: (r) => clientName(r.client_id), value: (r) => clientName(r.client_id) },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Contract value",
      cell: (r) => currency(r.quotation_amount),
      value: (r) => r.quotation_amount,
      className: "text-right",
    },
    { header: "Start", cell: (r) => dateFmt(r.start_date), value: (r) => r.start_date },
    {
      header: "Target",
      cell: (r) => dateFmt(r.expected_completion_date),
      value: (r) => r.expected_completion_date,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every site with client, contract value and delivery dates."
        actions={
          canWriteFinance ? (
            <FormDialog
              title="New project"
              description="Create a project record with client, contract value and site details."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New project
                </Button>
              }
              submitting={save.isPending}
              fields={[
                { name: "name", label: "Project name", required: true },
                { name: "project_code", label: "Project code", required: true },
                {
                  name: "client_id",
                  label: "Client",
                  type: "select",
                  options: (clients.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: ["planning", "active", "on_hold", "completed", "cancelled"].map((s) => ({
                    value: s,
                    label: s.replace("_", " "),
                  })),
                },
                { name: "quotation_amount", label: "Contract value (₹)", type: "number" },
                { name: "start_date", label: "Start date", type: "date" },
                { name: "expected_completion_date", label: "Expected completion", type: "date" },
                { name: "house_number", label: "House / plot number" },
                { name: "site_address", label: "Site address", type: "textarea" },
                { name: "agreement_details", label: "Agreement details", type: "textarea" },
                { name: "details", label: "Scope / notes", type: "textarea" },
              ]}
              initial={{ status: "planning" }}
              onSubmit={async (values) => {
                await save.mutateAsync({
                  values: {
                    ...values,
                    quotation_amount: Number(values["quotation_amount"] ?? 0),
                  },
                });
              }}
            />
          ) : null
        }
      />
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as "all" | "active" | "completed")}
        className="mb-4"
      >
        <TabsList className="no-print">
          <TabsTrigger value="all">
            All ({(projects.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({(projects.data ?? []).filter((p) => p.status === "active").length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({(projects.data ?? []).filter((p) => p.status === "completed").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        rows={filteredProjects}
        columns={columns}
        loading={projects.isLoading}
        exportName={`projects-${statusFilter}`}
        empty={statusFilter === "all" ? "No projects yet." : `No ${statusFilter} projects.`}
      />
    </div>
  );
}
