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
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(initial ?? {});
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      const val = values[f.name];
      if (f.required) {
        if (val === undefined || val === null || String(val).trim() === "") {
          newErrors[f.name] = `${f.label.replace(/\s*\*.*$/, "").replace(/\s*\(.*\)$/, "")} is required`;
          continue;
        }
      }
      if (f.type === "number" && f.required) {
        const num = Number(val);
        if (isNaN(num) || num <= 0) {
          newErrors[f.name] = `Please enter a valid amount greater than 0`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validate()) return;
            // Build cleaned and trimmed values
            const cleanValues: FormValues = {};
            for (const [k, v] of Object.entries(values)) {
              cleanValues[k] = typeof v === "string" ? v.trim() : v;
            }
            await onSubmit(cleanValues);
            setOpen(false);
          }}
        >
          {fields.map((f) => {
            const hasError = !!errors[f.name];
            return (
              <div
                key={f.name}
                className={f.full || f.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                <Label
                  htmlFor={f.name}
                  className={`mb-1.5 block text-xs ${hasError ? "text-destructive font-medium" : ""}`}
                >
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "select" ? (
                  <Select
                    value={(values[f.name] as string) ?? ""}
                    onValueChange={(v) => set(f.name, v)}
                  >
                    <SelectTrigger
                      id={f.name}
                      className={hasError ? "border-destructive focus:ring-destructive" : undefined}
                    >
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
                    className={hasError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={(values[f.name] as string | number) ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className={hasError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                )}
                {hasError && (
                  <p className="mt-1 text-[11px] text-destructive font-medium animate-in fade-in-50">
                    {errors[f.name]}
                  </p>
                )}
              </div>
            );
          })}

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
