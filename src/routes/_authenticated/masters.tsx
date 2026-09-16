import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/db";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/masters")({
  head: () => ({
    meta: [
      { title: "Masters — Brickweld" },
      {
        name: "description",
        content: "Manage clients, employees, contractors, suppliers and machinery master records.",
      },
      { property: "og:title", content: "Masters — Brickweld" },
      {
        property: "og:description",
        content: "Central master data for people, vendors and equipment.",
      },
    ],
  }),
  component: MastersPage,
});

type Client = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
};

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  employee_type: string;
  designation: string | null;
  wage_type: string;
  wage_rate: number;
  ot_rate_per_hour: number | null;
  phone: string | null;
  address: string | null;
  active: boolean;
};

type Contractor = {
  id: string;
  contractor_code: string;
  name: string;
  contractor_type: string | null;
  phone: string | null;
  email: string | null;
  bank_details: string | null;
  address: string | null;
  active: boolean;
};

type Supplier = {
  id: string;
  name: string;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
};

type Machine = {
  id: string;
  name: string;
  machine_code: string | null;
  description: string | null;
};

const Active = ({ on }: { on: boolean }) => (
  <Badge variant={on ? "default" : "secondary"}>{on ? "Active" : "Inactive"}</Badge>
);

function MastersPage() {
  const { isMD, canWriteSite } = useAuth();

  // Selected item states for Edit and Delete
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [deletingContractor, setDeletingContractor] = useState<Contractor | null>(null);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);

  // Filters
  const [empTypeFilter, setEmpTypeFilter] = useState<string>("all");
  const [empStatusFilter, setEmpStatusFilter] = useState<string>("all");

  const [conTypeFilter, setConTypeFilter] = useState<string>("all");
  const [conStatusFilter, setConStatusFilter] = useState<string>("all");

  const [supStatusFilter, setSupStatusFilter] = useState<string>("all");

  // Data queries
  const clients = useRows<Client>("clients", { order: { col: "name", asc: true } });
  const employees = useRows<Employee>("employees", { order: { col: "full_name", asc: true } });
  const contractors = useRows<Contractor>("contractors", { order: { col: "name", asc: true } });
  const suppliers = useRows<Supplier>("suppliers", { order: { col: "name", asc: true } });
  const machines = useRows<Machine>("machines", { order: { col: "name", asc: true } });

  // Mutations
  const saveClient = useSaveRow("clients", "Client");
  const deleteClient = useDeleteRow("clients", "Client");

  const saveEmployee = useSaveRow("employees", "Employee");
  const deleteEmployee = useDeleteRow("employees", "Employee");

  const saveContractor = useSaveRow("contractors", "Contractor");
  const deleteContractor = useDeleteRow("contractors", "Contractor");

  const saveSupplier = useSaveRow("suppliers", "Supplier");
  const deleteSupplier = useDeleteRow("suppliers", "Supplier");

  const saveMachine = useSaveRow("machines", "Machine");
  const deleteMachine = useDeleteRow("machines", "Machine");

  const canManageMasters = isMD; // Only MD has full authority over core masters
  const canManageMachines = isMD || canWriteSite;

  const addButton = (label: string) => (
    <Button>
      <Plus className="mr-2 size-4" /> {label}
    </Button>
  );

  const activeField: Field = {
    name: "active",
    label: "Status",
    type: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  };

  // Filtered lists
  const filteredEmployees = useMemo(() => {
    let list = employees.data ?? [];
    if (empTypeFilter !== "all") list = list.filter((e) => e.employee_type === empTypeFilter);
    if (empStatusFilter !== "all")
      list = list.filter((e) => (empStatusFilter === "active" ? e.active : !e.active));
    return list;
  }, [employees.data, empTypeFilter, empStatusFilter]);

  const filteredContractors = useMemo(() => {
    let list = contractors.data ?? [];
    if (conTypeFilter !== "all") list = list.filter((c) => c.contractor_type === conTypeFilter);
    if (conStatusFilter !== "all")
      list = list.filter((c) => (conStatusFilter === "active" ? c.active : !c.active));
    return list;
  }, [contractors.data, conTypeFilter, conStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    let list = suppliers.data ?? [];
    if (supStatusFilter !== "all")
      list = list.filter((s) => (supStatusFilter === "active" ? s.active : !s.active));
    return list;
  }, [suppliers.data, supStatusFilter]);

  // Unique contractor trades for filter
  const contractorTypes = useMemo(() => {
    const types = new Set<string>();
    (contractors.data ?? []).forEach((c) => {
      if (c.contractor_type) types.add(c.contractor_type);
    });
    return Array.from(types);
  }, [contractors.data]);

  // Client columns
  const clientColumns: Column<Client>[] = [
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Contact", cell: (r) => r.contact_person ?? "—", value: (r) => r.contact_person },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    { header: "Email", cell: (r) => r.email ?? "—", value: (r) => r.email },
    ...(canManageMasters
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Client) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingClient(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingClient(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Employee columns
  const employeeColumns: Column<Employee>[] = [
    { header: "Code", cell: (r) => r.employee_code, value: (r) => r.employee_code },
    { header: "Name", cell: (r) => r.full_name, value: (r) => r.full_name },
    { header: "Type", cell: (r) => r.employee_type, value: (r) => r.employee_type },
    { header: "Designation", cell: (r) => r.designation ?? "—", value: (r) => r.designation },
    {
      header: "Wage",
      cell: (r) => `${currency(r.wage_rate)} / ${r.wage_type}`,
      value: (r) => r.wage_rate,
    },
    {
      header: "Status",
      cell: (r) => <Active on={r.active} />,
      value: (r) => (r.active ? "active" : "inactive"),
    },
    ...(canManageMasters
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Employee) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingEmployee(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingEmployee(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Contractor columns
  const contractorColumns: Column<Contractor>[] = [
    { header: "Code", cell: (r) => r.contractor_code, value: (r) => r.contractor_code },
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Type", cell: (r) => r.contractor_type ?? "—", value: (r) => r.contractor_type },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    {
      header: "Status",
      cell: (r) => <Active on={r.active} />,
      value: (r) => (r.active ? "active" : "inactive"),
    },
    ...(canManageMasters
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Contractor) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingContractor(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingContractor(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Supplier columns
  const supplierColumns: Column<Supplier>[] = [
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "GST", cell: (r) => r.gst_number ?? "—", value: (r) => r.gst_number },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    {
      header: "Status",
      cell: (r) => <Active on={r.active} />,
      value: (r) => (r.active ? "active" : "inactive"),
    },
    ...(canManageMasters
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Supplier) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingSupplier(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingSupplier(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Machine columns
  const machineColumns: Column<Machine>[] = [
    { header: "Code", cell: (r) => r.machine_code ?? "—", value: (r) => r.machine_code },
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
    ...(canManageMachines
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Machine) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingMachine(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingMachine(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Form field definitions
  const clientFields: Field[] = [
    { name: "name", label: "Client name", required: true },
    { name: "contact_person", label: "Contact person" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address", type: "textarea" },
  ];

  const employeeFields: Field[] = [
    { name: "employee_code", label: "Employee code", required: true },
    { name: "full_name", label: "Full name", required: true },
    {
      name: "employee_type",
      label: "Employee type",
      type: "select",
      options: ["labour", "office"].map((t) => ({ value: t, label: t })),
    },
    { name: "designation", label: "Designation" },
    {
      name: "wage_type",
      label: "Wage type",
      type: "select",
      options: ["daily", "monthly", "hourly"].map((t) => ({ value: t, label: t })),
    },
    { name: "wage_rate", label: "Wage rate (₹)", type: "number", required: true },
    { name: "ot_rate_per_hour", label: "OT rate (₹/hr)", type: "number" },
    { name: "phone", label: "Phone", type: "tel" },
    activeField,
    { name: "address", label: "Address", type: "textarea" },
  ];

  const contractorFields: Field[] = [
    { name: "contractor_code", label: "Contractor code", required: true },
    { name: "name", label: "Name", required: true },
    { name: "contractor_type", label: "Trade / type", placeholder: "Masonry, steel, electrical…" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    activeField,
    { name: "bank_details", label: "Bank details", type: "textarea" },
    { name: "address", label: "Address", type: "textarea" },
  ];

  const supplierFields: Field[] = [
    { name: "name", label: "Supplier name", required: true },
    { name: "gst_number", label: "GST number" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    activeField,
    { name: "address", label: "Address", type: "textarea" },
  ];

  const machineFields: Field[] = [
    { name: "machine_code", label: "Machine code" },
    { name: "name", label: "Machine name", required: true },
    { name: "description", label: "Description", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader
        title="Masters"
        description="Clients, employees, contractors, suppliers and machinery."
      />

      <Tabs defaultValue="clients">
        <TabsList className="no-print">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
        </TabsList>

        {/* ================= CLIENTS ================= */}
        <TabsContent value="clients" className="mt-4 space-y-3">
          {canManageMasters && (
            <FormDialog
              title="Add client"
              fields={clientFields}
              trigger={addButton("Add client")}
              submitting={saveClient.isPending}
              onSubmit={async (values) => {
                await saveClient.mutateAsync({ values });
              }}
            />
          )}

          {editingClient && (
            <FormDialog
              open={!!editingClient}
              onOpenChange={(v) => !v && setEditingClient(null)}
              title="Edit client"
              fields={clientFields}
              submitting={saveClient.isPending}
              initial={{
                name: editingClient.name,
                contact_person: editingClient.contact_person ?? "",
                phone: editingClient.phone ?? "",
                email: editingClient.email ?? "",
                address: editingClient.address ?? "",
              }}
              onSubmit={async (values) => {
                await saveClient.mutateAsync({ id: editingClient.id, values });
                setEditingClient(null);
              }}
            />
          )}

          {deletingClient && (
            <ConfirmDeleteDialog
              open={!!deletingClient}
              onOpenChange={(v) => !v && setDeletingClient(null)}
              title="Delete client"
              description={`Are you sure you want to delete client "${deletingClient.name}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteClient.mutateAsync(deletingClient.id);
                setDeletingClient(null);
              }}
            />
          )}

          <DataTable
            rows={clients.data ?? []}
            columns={clientColumns}
            loading={clients.isLoading}
            exportName="brickweld-clients"
            exportTitle="Client Master Report"
            exportDescription="Construction Project Control System — Client Master Report"
          />
        </TabsContent>

        {/* ================= EMPLOYEES ================= */}
        <TabsContent value="employees" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canManageMasters && (
              <FormDialog
                title="Add employee"
                description="Labour and office staff with their wage basis."
                initial={{ employee_type: "labour", wage_type: "daily", active: "true" }}
                fields={employeeFields}
                trigger={addButton("Add employee")}
                submitting={saveEmployee.isPending}
                onSubmit={async (values) => {
                  await saveEmployee.mutateAsync({
                    values: {
                      ...values,
                      wage_rate: Number(values["wage_rate"] ?? 0),
                      ot_rate_per_hour: values["ot_rate_per_hour"]
                        ? Number(values["ot_rate_per_hour"])
                        : null,
                      active: values["active"] !== "false",
                    },
                  });
                }}
              />
            )}

            {/* Employee Filters */}
            <div className="no-print flex flex-wrap items-end gap-2">
              <div>
                <Label className="mb-1 block text-xs">Type</Label>
                <Select value={empTypeFilter} onValueChange={setEmpTypeFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="labour">Labour</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={empStatusFilter} onValueChange={setEmpStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(empTypeFilter !== "all" || empStatusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEmpTypeFilter("all");
                    setEmpStatusFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingEmployee && (
            <FormDialog
              open={!!editingEmployee}
              onOpenChange={(v) => !v && setEditingEmployee(null)}
              title="Edit employee"
              fields={employeeFields}
              submitting={saveEmployee.isPending}
              initial={{
                employee_code: editingEmployee.employee_code,
                full_name: editingEmployee.full_name,
                employee_type: editingEmployee.employee_type,
                designation: editingEmployee.designation ?? "",
                wage_type: editingEmployee.wage_type,
                wage_rate: editingEmployee.wage_rate,
                ot_rate_per_hour: editingEmployee.ot_rate_per_hour ?? "",
                phone: editingEmployee.phone ?? "",
                active: editingEmployee.active ? "true" : "false",
                address: editingEmployee.address ?? "",
              }}
              onSubmit={async (values) => {
                await saveEmployee.mutateAsync({
                  id: editingEmployee.id,
                  values: {
                    ...values,
                    wage_rate: Number(values["wage_rate"] ?? 0),
                    ot_rate_per_hour: values["ot_rate_per_hour"]
                      ? Number(values["ot_rate_per_hour"])
                      : null,
                    active: values["active"] !== "false",
                  },
                });
                setEditingEmployee(null);
              }}
            />
          )}

          {deletingEmployee && (
            <ConfirmDeleteDialog
              open={!!deletingEmployee}
              onOpenChange={(v) => !v && setDeletingEmployee(null)}
              title="Delete employee"
              description={`Are you sure you want to delete employee "${deletingEmployee.full_name}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteEmployee.mutateAsync(deletingEmployee.id);
                setDeletingEmployee(null);
              }}
            />
          )}

          <DataTable
            rows={filteredEmployees}
            columns={employeeColumns}
            loading={employees.isLoading}
            exportName="brickweld-employees"
            exportTitle="Employee Master Report"
            exportDescription="Construction Project Control System — Employee Master Report"
            appliedFilters={{
              ...(empTypeFilter !== "all" ? { Type: empTypeFilter } : {}),
              ...(empStatusFilter !== "all" ? { Status: empStatusFilter } : {}),
            }}
          />
        </TabsContent>

        {/* ================= CONTRACTORS ================= */}
        <TabsContent value="contractors" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canManageMasters && (
              <FormDialog
                title="Add contractor"
                initial={{ active: "true" }}
                fields={contractorFields}
                trigger={addButton("Add contractor")}
                submitting={saveContractor.isPending}
                onSubmit={async (values) => {
                  await saveContractor.mutateAsync({
                    values: { ...values, active: values["active"] !== "false" },
                  });
                }}
              />
            )}

            {/* Contractor Filters */}
            <div className="no-print flex flex-wrap items-end gap-2">
              {contractorTypes.length > 0 && (
                <div>
                  <Label className="mb-1 block text-xs">Trade</Label>
                  <Select value={conTypeFilter} onValueChange={setConTypeFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="All Trades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Trades</SelectItem>
                      {contractorTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={conStatusFilter} onValueChange={setConStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(conTypeFilter !== "all" || conStatusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConTypeFilter("all");
                    setConStatusFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingContractor && (
            <FormDialog
              open={!!editingContractor}
              onOpenChange={(v) => !v && setEditingContractor(null)}
              title="Edit contractor"
              fields={contractorFields}
              submitting={saveContractor.isPending}
              initial={{
                contractor_code: editingContractor.contractor_code,
                name: editingContractor.name,
                contractor_type: editingContractor.contractor_type ?? "",
                phone: editingContractor.phone ?? "",
                email: editingContractor.email ?? "",
                active: editingContractor.active ? "true" : "false",
                bank_details: editingContractor.bank_details ?? "",
                address: editingContractor.address ?? "",
              }}
              onSubmit={async (values) => {
                await saveContractor.mutateAsync({
                  id: editingContractor.id,
                  values: { ...values, active: values["active"] !== "false" },
                });
                setEditingContractor(null);
              }}
            />
          )}

          {deletingContractor && (
            <ConfirmDeleteDialog
              open={!!deletingContractor}
              onOpenChange={(v) => !v && setDeletingContractor(null)}
              title="Delete contractor"
              description={`Are you sure you want to delete contractor "${deletingContractor.name}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteContractor.mutateAsync(deletingContractor.id);
                setDeletingContractor(null);
              }}
            />
          )}

          <DataTable
            rows={filteredContractors}
            columns={contractorColumns}
            loading={contractors.isLoading}
            exportName="brickweld-contractors"
            exportTitle="Contractor Master Report"
            exportDescription="Construction Project Control System — Contractor Master Report"
            appliedFilters={{
              ...(conTypeFilter !== "all" ? { Trade: conTypeFilter } : {}),
              ...(conStatusFilter !== "all" ? { Status: conStatusFilter } : {}),
            }}
          />
        </TabsContent>

        {/* ================= SUPPLIERS ================= */}
        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canManageMasters && (
              <FormDialog
                title="Add supplier"
                initial={{ active: "true" }}
                fields={supplierFields}
                trigger={addButton("Add supplier")}
                submitting={saveSupplier.isPending}
                onSubmit={async (values) => {
                  await saveSupplier.mutateAsync({
                    values: { ...values, active: values["active"] !== "false" },
                  });
                }}
              />
            )}

            {/* Supplier Status Filter */}
            <div className="no-print flex flex-wrap items-end gap-2">
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={supStatusFilter} onValueChange={setSupStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {supStatusFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSupStatusFilter("all")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingSupplier && (
            <FormDialog
              open={!!editingSupplier}
              onOpenChange={(v) => !v && setEditingSupplier(null)}
              title="Edit supplier"
              fields={supplierFields}
              submitting={saveSupplier.isPending}
              initial={{
                name: editingSupplier.name,
                gst_number: editingSupplier.gst_number ?? "",
                phone: editingSupplier.phone ?? "",
                email: editingSupplier.email ?? "",
                active: editingSupplier.active ? "true" : "false",
                address: editingSupplier.address ?? "",
              }}
              onSubmit={async (values) => {
                await saveSupplier.mutateAsync({
                  id: editingSupplier.id,
                  values: { ...values, active: values["active"] !== "false" },
                });
                setEditingSupplier(null);
              }}
            />
          )}

          {deletingSupplier && (
            <ConfirmDeleteDialog
              open={!!deletingSupplier}
              onOpenChange={(v) => !v && setDeletingSupplier(null)}
              title="Delete supplier"
              description={`Are you sure you want to delete supplier "${deletingSupplier.name}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteSupplier.mutateAsync(deletingSupplier.id);
                setDeletingSupplier(null);
              }}
            />
          )}

          <DataTable
            rows={filteredSuppliers}
            columns={supplierColumns}
            loading={suppliers.isLoading}
            exportName="brickweld-suppliers"
            exportTitle="Supplier Master Report"
            exportDescription="Construction Project Control System — Supplier Master Report"
            appliedFilters={{
              ...(supStatusFilter !== "all" ? { Status: supStatusFilter } : {}),
            }}
          />
        </TabsContent>

        {/* ================= MACHINES ================= */}
        <TabsContent value="machines" className="mt-4 space-y-3">
          {canManageMachines && (
            <FormDialog
              title="Add machine"
              fields={machineFields}
              trigger={addButton("Add machine")}
              submitting={saveMachine.isPending}
              onSubmit={async (values) => {
                await saveMachine.mutateAsync({ values });
              }}
            />
          )}

          {editingMachine && (
            <FormDialog
              open={!!editingMachine}
              onOpenChange={(v) => !v && setEditingMachine(null)}
              title="Edit machine"
              fields={machineFields}
              submitting={saveMachine.isPending}
              initial={{
                machine_code: editingMachine.machine_code ?? "",
                name: editingMachine.name,
                description: editingMachine.description ?? "",
              }}
              onSubmit={async (values) => {
                await saveMachine.mutateAsync({ id: editingMachine.id, values });
                setEditingMachine(null);
              }}
            />
          )}

          {deletingMachine && (
            <ConfirmDeleteDialog
              open={!!deletingMachine}
              onOpenChange={(v) => !v && setDeletingMachine(null)}
              title="Delete machine"
              description={`Are you sure you want to delete machine "${deletingMachine.name}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteMachine.mutateAsync(deletingMachine.id);
                setDeletingMachine(null);
              }}
            />
          )}

          <DataTable
            rows={machines.data ?? []}
            columns={machineColumns}
            loading={machines.isLoading}
            exportName="brickweld-machines"
            exportTitle="Machine Master Report"
            exportDescription="Construction Project Control System — Machine Master Report"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
