import { ListPlus } from "lucide-react";
import { useRows } from "@/lib/db";
import { currency } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReceiptItem = {
  id: string;
  receipt_id: string;
  material: string;
  unit: string | null;
  ordered_quantity: number;
  received_quantity: number;
  rate: number;
  amount: number;
};

type ReceiptRow = {
  id: string;
  receipt_number: string;
  total_amount: number;
};

interface Props {
  receipt: ReceiptRow | null;
  onClose: () => void;
}

export function ReceiptItemsSheet({ receipt, onClose }: Props) {
  const items = useRows<ReceiptItem>("material_receipt_items", {
    filters: receipt ? [{ col: "receipt_id", op: "eq", value: receipt.id }] : [],
    order: { col: "created_at" },
    enabled: !!receipt,
  });

  const total = (items.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  return (
    <Sheet open={!!receipt} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ListPlus className="size-4 text-primary" />
            Received Materials — {receipt?.receipt_number}
          </SheetTitle>
          <SheetDescription>
            Delivered materials recorded on GRN {receipt?.receipt_number}.
          </SheetDescription>
        </SheetHeader>

        {items.isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading received items…</p>
        ) : (items.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No line items found for this receipt.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/60">
                  <TableHead>Material</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Ordered Qty</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.material}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.unit || "—"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.ordered_quantity > 0 ? item.ordered_quantity : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{item.received_quantity}</TableCell>
                    <TableCell className="text-right text-sm">{currency(item.rate)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold font-mono">
                      {currency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 border-t bg-muted/40 text-xs flex justify-between font-bold text-sm">
              <span>Total Received Value:</span>
              <span className="font-mono text-primary">{currency(receipt?.total_amount ?? total)}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
