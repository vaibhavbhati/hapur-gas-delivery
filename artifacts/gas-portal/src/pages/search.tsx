import * as React from "react";
import { useGetDeliveries } from "@workspace/api-client-react";
import { useDebounce } from "use-debounce";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, isEligible } from "@/lib/utils";
import { Search as SearchIcon, CheckCircle2, XCircle } from "lucide-react";
import { DeliveryFilesToggle } from "@/components/DeliveryFiles";

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 500);

  const { data, isLoading } = useGetDeliveries(
    { search: debouncedSearch, limit: 50 },
    { query: { enabled: true } }
  );

  const deliveries = data?.data || [];

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-display font-bold">Search Consumers</h1>
        <p className="text-muted-foreground mt-1">Look up delivery history and check eligibility status.</p>
      </div>

      <div className="relative max-w-2xl">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          className="pl-12 h-14 text-lg bg-white shadow-sm"
          placeholder="Search by consumer no, name, or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isLoading && searchTerm && (
           <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left relative">
            <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">Consumer No.</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Mobile</th>
                <th className="px-6 py-4 font-semibold">Last Delivery</th>
                <th className="px-6 py-4 font-semibold">Next Eligible</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Files</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <SearchIcon className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-lg font-medium">No results found</p>
                      <p className="text-sm">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
              {deliveries.map((delivery) => {
                const eligible = isEligible(delivery.nextEligibleDate);
                return (
                  <tr key={delivery.id} className="bg-white border-b last:border-0 hover:bg-slate-50 transition-colors align-top">
                    <td className="px-6 py-4 font-medium font-mono text-foreground">{delivery.consumerNumber}</td>
                    <td className="px-6 py-4 font-medium">{delivery.customerName}</td>
                    <td className="px-6 py-4">{delivery.mobileNumber}</td>
                    <td className="px-6 py-4">{formatDate(delivery.deliveryDate)}</td>
                    <td className="px-6 py-4 font-medium">{formatDate(delivery.nextEligibleDate)}</td>
                    <td className="px-6 py-4">
                      {eligible ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success/15 text-success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
                          <XCircle className="w-3.5 h-3.5" />
                          Not Eligible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <DeliveryFilesToggle deliveryId={delivery.id} canDelete={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
