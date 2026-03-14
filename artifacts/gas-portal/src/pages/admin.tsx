import * as React from "react";
import { 
  useGetDeliveries, 
  useDeleteDelivery, 
  useExportDeliveries, 
  getGetDeliveriesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Download, Trash2, Loader2 } from "lucide-react";
import { DeliveryFilesToggle } from "@/components/DeliveryFiles";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const limit = 20;

  const { data, isLoading } = useGetDeliveries({ page, limit });
  const deliveries = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const deleteMutation = useDeleteDelivery({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDeliveriesQueryKey() });
      }
    }
  });

  const { refetch: fetchExport, isFetching: isExporting } = useExportDeliveries({ 
    query: { enabled: false } 
  });

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const handleExport = async () => {
    try {
      const result = await fetchExport();
      if (result.data) {
        const url = window.URL.createObjectURL(result.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deliveries-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export Excel file.");
    }
  };

  return (
    <div className="space-y-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage all delivery records and export data.</p>
        </div>
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export to Excel
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left relative">
            <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Consumer</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Next Eligible</th>
                <th className="px-6 py-4 font-semibold">Files</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Loading records...</td>
                </tr>
              )}
              {!isLoading && deliveries.map((delivery) => (
                <tr key={delivery.id} className="bg-white border-b last:border-0 hover:bg-slate-50 transition-colors align-top">
                  <td className="px-6 py-4 text-muted-foreground">#{delivery.id}</td>
                  <td className="px-6 py-4 font-medium font-mono text-foreground">{delivery.consumerNumber}</td>
                  <td className="px-6 py-4">{delivery.customerName}</td>
                  <td className="px-6 py-4">{formatDate(delivery.deliveryDate)}</td>
                  <td className="px-6 py-4">{formatDate(delivery.nextEligibleDate)}</td>
                  <td className="px-6 py-4">
                    <DeliveryFilesToggle deliveryId={delivery.id} canDelete={true} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                      onClick={() => handleDelete(delivery.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="border-t border-border p-4 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
