import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "email" | "tel";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  full?: boolean;
};

export type FormValues = Record<string, string | number | null>;

export function FormDialog({
  title,
  description,
  fields,
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange,
  submitting,
  onSubmit,
  extra,
}: {
  title: string;
  description?: string;
  fields: Field[];
  initial?: FormValues;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  submitting?: boolean;
  onSubmit: (values: FormValues) => Promise<void> | void;
  extra?: (values: FormValues) => ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  const [values, setValues] = useState<FormValues>(initial ?? {});

  useEffect(() => {
    if (open) setValues(initial ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(values);
            setOpen(false);
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className={f.full || f.type === "textarea" ? "sm:col-span-2" : undefined}>
              <Label htmlFor={f.name} className="mb-1.5 block text-xs">
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              {f.type === "select" ? (
                <Select
                  value={(values[f.name] as string) ?? ""}
                  onValueChange={(v) => set(f.name, v)}
                >
                  <SelectTrigger id={f.name}>
                    <SelectValue placeholder={f.placeholder ?? "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={(values[f.name] as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                />
              ) : (
                <Input
                  id={f.name}
                  type={f.type ?? "text"}
                  step={f.type === "number" ? "any" : undefined}
                  required={f.required}
                  value={(values[f.name] as string | number) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}

          {extra ? <div className="sm:col-span-2">{extra(values)}</div> : null}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
