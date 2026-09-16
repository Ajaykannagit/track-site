import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Brickweld" },
      {
        name: "description",
        content: "All construction projects with contract value, status and site details.",
      },
      { property: "og:title", content: "Projects — Brickweld" },
      {
        property: "og:description",
        content: "Track every construction project from planning to handover.",
      },
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
  house_number: string | null;
  agreement_details: string | null;
  details: string | null;
};

function ProjectsPage() {
  const { isMD } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const projects = useRows<Project>("projects", { order: { col: "created_at" } });
  const clients = useRows<{ id: string; name: string }>("clients", { select: "id,name" });

  const save = useSaveRow("projects", "Project");
  const deleteProject = useDeleteRow("projects", "Project");

  const clientName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? "—";

  const filteredProjects = useMemo(() => {
    let list = projects.data ?? [];
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (clientFilter !== "all") {
      list = list.filter((p) => p.client_id === clientFilter);
    }
    return list;
  }, [projects.data, statusFilter, clientFilter]);

  const projectFields: Field[] = [
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
  ];

  const columns: Column<Project>[] = [
    {
      header: "Project",
      cell: (r) => (
        <Link
          to="/projects/$projectId"
          params={{ projectId: r.id }}
          className="font-medium hover:underline"
        >
          {r.name}
        </Link>
      ),
      value: (r) => r.name,
    },
    { header: "Code", cell: (r) => r.project_code, value: (r) => r.project_code },
    {
      header: "Client",
      cell: (r) => clientName(r.client_id),
      value: (r) => clientName(r.client_id),
    },
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
    {
      header: "Actions",
      className: "text-right w-28",
      cell: (r: Project) => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="icon" className="size-7" title="View details">
            <Link to="/projects/$projectId" params={{ projectId: r.id }}>
              <Eye className="size-3.5" />
            </Link>
          </Button>
          {isMD && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Edit project"
                onClick={() => setEditingProject(r)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                title="Delete project"
                onClick={() => setDeletingProject(r)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every site with client, contract value and delivery dates."
        actions={
          isMD ? (
            <FormDialog
              title="New project"
              description="Create a project record with client, contract value and site details."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New project
                </Button>
              }
              submitting={save.isPending}
              fields={projectFields}
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

      {/* Edit Project Dialog */}
      {editingProject && (
        <FormDialog
          open={!!editingProject}
          onOpenChange={(v) => !v && setEditingProject(null)}
          title="Edit project"
          description="Update project details, contract value, timeline or client."
          submitting={save.isPending}
          initial={{
            name: editingProject.name,
            project_code: editingProject.project_code,
            client_id: editingProject.client_id ?? "",
            status: editingProject.status,
            quotation_amount: editingProject.quotation_amount,
            start_date: editingProject.start_date ?? "",
            expected_completion_date: editingProject.expected_completion_date ?? "",
            house_number: editingProject.house_number ?? "",
            site_address: editingProject.site_address ?? "",
            agreement_details: editingProject.agreement_details ?? "",
            details: editingProject.details ?? "",
          }}
          fields={projectFields}
          onSubmit={async (values) => {
            await save.mutateAsync({
              id: editingProject.id,
              values: {
                ...values,
                quotation_amount: Number(values["quotation_amount"] ?? 0),
              },
            });
            setEditingProject(null);
          }}
        />
      )}

      {/* Confirm Delete Project Dialog */}
      {deletingProject && (
        <ConfirmDeleteDialog
          open={!!deletingProject}
          onOpenChange={(v) => !v && setDeletingProject(null)}
          title="Delete project"
          description={`Are you sure you want to delete project "${deletingProject.name}"? This action cannot be undone.`}
          onConfirm={async () => {
            await deleteProject.mutateAsync(deletingProject.id);
            setDeletingProject(null);
          }}
        />
      )}

      {/* Filters Bar */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="no-print flex-wrap">
            <TabsTrigger value="all">All ({(projects.data ?? []).length})</TabsTrigger>
            <TabsTrigger value="active">
              Active ({(projects.data ?? []).filter((p) => p.status === "active").length})
            </TabsTrigger>
            <TabsTrigger value="planning">
              Planning ({(projects.data ?? []).filter((p) => p.status === "planning").length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({(projects.data ?? []).filter((p) => p.status === "completed").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {(clients.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(statusFilter !== "all" || clientFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setClientFilter("all");
              }}
              className="h-9 px-2 text-xs"
            >
              <RotateCcw className="mr-1 size-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <DataTable
        rows={filteredProjects}
        columns={columns}
        loading={projects.isLoading}
        exportName="brickweld-projects"
        exportTitle="Projects Report"
        exportDescription="Construction Project Control System — Projects Report"
        appliedFilters={{
          ...(statusFilter !== "all" ? { Status: statusFilter } : {}),
          ...(clientFilter !== "all" ? { Client: clientName(clientFilter) } : {}),
        }}
        empty={statusFilter === "all" ? "No projects yet." : `No ${statusFilter} projects.`}
      />
    </div>
  );
}
