import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow } from "@/lib/db";
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
      { property: "og:description", content: "Central master data for people, vendors and equipment." },
    ],
  }),
  component: MastersPage,
});

type Client = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null };
type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  employee_type: string;
  designation: string | null;
  wage_type: string;
  wage_rate: number;
  active: boolean;
};
type Contractor = {
  id: string;
  contractor_code: string;
  name: string;
  contractor_type: string | null;
  phone: string | null;
  active: boolean;
};
type Supplier = { id: string; name: string; gst_number: string | null; phone: string | null; active: boolean };
type Machine = { id: string; name: string; machine_code: string | null; description: string | null };

const Active = ({ on }: { on: boolean }) => (
  <Badge variant={on ? "default" : "secondary"}>{on ? "Active" : "Inactive"}</Badge>
);

function MastersPage() {
  const { canWriteFinance } = useAuth();

  const clients = useRows<Client>("clients", { order: { col: "name", asc: true } });
  const employees = useRows<Employee>("employees", { order: { col: "full_name", asc: true } });
  const contractors = useRows<Contractor>("contractors", { order: { col: "name", asc: true } });
  const suppliers = useRows<Supplier>("suppliers", { order: { col: "name", asc: true } });
  const machines = useRows<Machine>("machines", { order: { col: "name", asc: true } });

  const saveClient = useSaveRow("clients", "Client");
  const saveEmployee = useSaveRow("employees", "Employee");
  const saveContractor = useSaveRow("contractors", "Contractor");
  const saveSupplier = useSaveRow("suppliers", "Supplier");
  const saveMachine = useSaveRow("machines", "Machine");

  const addButton = (label: string) => (
    <Button>
      <Plus className="mr-2 size-4" /> {label}
    </Button>
  );

  const clientColumns: Column<Client>[] = [
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Contact", cell: (r) => r.contact_person ?? "—", value: (r) => r.contact_person },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    { header: "Email", cell: (r) => r.email ?? "—", value: (r) => r.email },
  ];

  const employeeColumns: Column<Employee>[] = [
    { header: "Code", cell: (r) => r.employee_code, value: (r) => r.employee_code },
    { header: "Name", cell: (r) => r.full_name, value: (r) => r.full_name },
    { header: "Type", cell: (r) => r.employee_type, value: (r) => r.employee_type },
    { header: "Designation", cell: (r) => r.designation ?? "—", value: (r) => r.designation },
    { header: "Wage", cell: (r) => `${currency(r.wage_rate)} / ${r.wage_type}`, value: (r) => r.wage_rate },
    { header: "Status", cell: (r) => <Active on={r.active} />, value: (r) => (r.active ? "active" : "inactive") },
  ];

  const contractorColumns: Column<Contractor>[] = [
    { header: "Code", cell: (r) => r.contractor_code, value: (r) => r.contractor_code },
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Type", cell: (r) => r.contractor_type ?? "—", value: (r) => r.contractor_type },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    { header: "Status", cell: (r) => <Active on={r.active} />, value: (r) => (r.active ? "active" : "inactive") },
  ];

  const supplierColumns: Column<Supplier>[] = [
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "GST", cell: (r) => r.gst_number ?? "—", value: (r) => r.gst_number },
    { header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    { header: "Status", cell: (r) => <Active on={r.active} />, value: (r) => (r.active ? "active" : "inactive") },
  ];

  const machineColumns: Column<Machine>[] = [
    { header: "Code", cell: (r) => r.machine_code ?? "—", value: (r) => r.machine_code },
    { header: "Name", cell: (r) => r.name, value: (r) => r.name },
    { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
  ];

  const activeField: Field = {
    name: "active",
    label: "Status",
    type: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  };

  return (
    <div>
      <PageHeader title="Masters" description="Clients, employees, contractors, suppliers and machinery." />

      <Tabs defaultValue="clients">
        <TabsList className="no-print">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Add client"
              fields={[
                { name: "name", label: "Client name", required: true },
                { name: "contact_person", label: "Contact person" },
                { name: "phone", label: "Phone", type: "tel" },
                { name: "email", label: "Email", type: "email" },
                { name: "address", label: "Address", type: "textarea" },
              ]}
              trigger={addButton("Add client")}
              submitting={saveClient.isPending}
              onSubmit={async (values) => {
                await saveClient.mutateAsync({ values });
              }}
            />
          ) : null}
          <DataTable rows={clients.data ?? []} columns={clientColumns} loading={clients.isLoading} exportName="clients" />
        </TabsContent>

        <TabsContent value="employees" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Add employee"
              description="Labour and office staff with their wage basis."
              initial={{ employee_type: "labour", wage_type: "daily", active: "true" }}
              fields={[
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
              ]}
              trigger={addButton("Add employee")}
              submitting={saveEmployee.isPending}
              onSubmit={async (values) => {
                await saveEmployee.mutateAsync({
                  values: {
                    ...values,
                    wage_rate: Number(values["wage_rate"] ?? 0),
                    ot_rate_per_hour: values["ot_rate_per_hour"] ? Number(values["ot_rate_per_hour"]) : null,
                    active: values["active"] !== "false",
                  },
                });
              }}
            />
          ) : null}
          <DataTable
            rows={employees.data ?? []}
            columns={employeeColumns}
            loading={employees.isLoading}
            exportName="employees"
          />
        </TabsContent>

        <TabsContent value="contractors" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Add contractor"
              initial={{ active: "true" }}
              fields={[
                { name: "contractor_code", label: "Contractor code", required: true },
                { name: "name", label: "Name", required: true },
                { name: "contractor_type", label: "Trade / type", placeholder: "Masonry, steel, electrical…" },
                { name: "phone", label: "Phone", type: "tel" },
                { name: "email", label: "Email", type: "email" },
                activeField,
                { name: "bank_details", label: "Bank details", type: "textarea" },
                { name: "address", label: "Address", type: "textarea" },
              ]}
              trigger={addButton("Add contractor")}
              submitting={saveContractor.isPending}
              onSubmit={async (values) => {
                await saveContractor.mutateAsync({ values: { ...values, active: values["active"] !== "false" } });
              }}
            />
          ) : null}
          <DataTable
            rows={contractors.data ?? []}
            columns={contractorColumns}
            loading={contractors.isLoading}
            exportName="contractors"
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Add supplier"
              initial={{ active: "true" }}
              fields={[
                { name: "name", label: "Supplier name", required: true },
                { name: "gst_number", label: "GST number" },
                { name: "phone", label: "Phone", type: "tel" },
                { name: "email", label: "Email", type: "email" },
                activeField,
                { name: "address", label: "Address", type: "textarea" },
              ]}
              trigger={addButton("Add supplier")}
              submitting={saveSupplier.isPending}
              onSubmit={async (values) => {
                await saveSupplier.mutateAsync({ values: { ...values, active: values["active"] !== "false" } });
              }}
            />
          ) : null}
          <DataTable
            rows={suppliers.data ?? []}
            columns={supplierColumns}
            loading={suppliers.isLoading}
            exportName="suppliers"
          />
        </TabsContent>

        <TabsContent value="machines" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Add machine"
              fields={[
                { name: "machine_code", label: "Machine code" },
                { name: "name", label: "Machine name", required: true },
                { name: "description", label: "Description", type: "textarea" },
              ]}
              trigger={addButton("Add machine")}
              submitting={saveMachine.isPending}
              onSubmit={async (values) => {
                await saveMachine.mutateAsync({ values });
              }}
            />
          ) : null}
          <DataTable rows={machines.data ?? []} columns={machineColumns} loading={machines.isLoading} exportName="machines" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
