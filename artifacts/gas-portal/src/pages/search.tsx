import * as React from "react";
import { useGetDeliveries } from "@workspace/api-client-react";
import { useDebounce } from "use-debounce";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, isEligible } from "@/lib/utils";
import {
  Search as SearchIcon,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  History,
  FileImage,
  FileText,
  File as FileIcon,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DeliveryFileInfo {
  id: number;
  deliveryId: number;
  fileName: string;
  fileType: string;
  objectPath: string;
}

interface DeliveryRecord {
  id: number;
  consumerNumber: string;
  customerName: string;
  mobileNumber: string;
  deliveryDate: string;
  nextEligibleDate: string;
  createdByName?: string;
  createdAt?: string;
  files?: DeliveryFileInfo[];
}

interface ConsumerGroup {
  consumerNumber: string;
  customerName: string;
  mobileNumber: string;
  latest: DeliveryRecord;
  all: DeliveryRecord[];
}

function groupByConsumer(deliveries: DeliveryRecord[]): ConsumerGroup[] {
  const map = new Map<string, DeliveryRecord[]>();
  for (const d of deliveries) {
    const list = map.get(d.consumerNumber) ?? [];
    list.push(d);
    map.set(d.consumerNumber, list);
  }
  return Array.from(map.entries()).map(([consumerNumber, records]) => {
    const sorted = [...records].sort(
      (a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime()
    );
    return {
      consumerNumber,
      customerName: sorted[0].customerName,
      mobileNumber: sorted[0].mobileNumber,
      latest: sorted[0],
      all: sorted,
    };
  });
}

function getDownloadUrl(objectPath: string) {
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.replace("/objects", "")
    : "/" + objectPath.replace(/^\//, "");
  return `${BASE}/api/storage/objects${stripped}`;
}

function FileIconLink({ file }: { file: DeliveryFileInfo }) {
  let Icon = FileIcon;
  let colorClass = "text-muted-foreground";
  if (file.fileType.startsWith("image/")) {
    Icon = FileImage;
    colorClass = "text-blue-500";
  } else if (file.fileType === "application/pdf") {
    Icon = FileText;
    colorClass = "text-red-500";
  } else if (file.fileType.includes("word") || file.fileType.includes("document")) {
    Icon = FileText;
    colorClass = "text-blue-700";
  }

  return (
    <a
      href={getDownloadUrl(file.objectPath)}
      target="_blank"
      rel="noopener noreferrer"
      title={file.fileName}
      className={`${colorClass} hover:opacity-70 transition-opacity`}
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

function InlineFiles({ files }: { files?: DeliveryFileInfo[] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {files.map((f) => (
        <FileIconLink key={f.id} file={f} />
      ))}
    </div>
  );
}

function ConsumerRow({ group }: { group: ConsumerGroup }) {
  const [expanded, setExpanded] = React.useState(false);
  const eligible = isEligible(group.latest.nextEligibleDate);
  const hasMultiple = group.all.length > 1;

  return (
    <>
      <tr className="bg-white border-b hover:bg-slate-50 transition-colors align-top">
        <td className="px-6 py-4 font-medium font-mono text-foreground">
          {group.consumerNumber}
        </td>
        <td className="px-6 py-4 font-medium">{group.customerName}</td>
        <td className="px-6 py-4">{group.mobileNumber}</td>
        <td className="px-6 py-4">{formatDate(group.latest.deliveryDate)}</td>
        <td className="px-6 py-4 font-medium">{formatDate(group.latest.nextEligibleDate)}</td>
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
          <InlineFiles files={group.latest.files} />
        </td>
        <td className="px-6 py-4 text-right">
          {hasMultiple ? (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {group.all.length} deliveries
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">1 delivery</span>
          )}
        </td>
      </tr>

      {expanded && hasMultiple && (
        <tr className="bg-slate-50 border-b">
          <td colSpan={8} className="px-6 pb-4 pt-0">
            <div className="ml-2 border-l-2 border-primary/20 pl-4 space-y-0">
              <div className="flex items-center gap-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <History className="w-3.5 h-3.5" />
                Full Delivery History
              </div>
              <div className="space-y-2">
                {group.all.map((d, i) => {
                  const elig = isEligible(d.nextEligibleDate);
                  return (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center gap-4 bg-white rounded-md border border-border px-4 py-3 text-sm"
                    >
                      <div className="flex flex-col min-w-[120px]">
                        <span className="text-xs text-muted-foreground">Delivery Date</span>
                        <span className="font-medium">{formatDate(d.deliveryDate)}</span>
                      </div>
                      <div className="flex flex-col min-w-[140px]">
                        <span className="text-xs text-muted-foreground">Next Eligible</span>
                        <span className="font-medium">{formatDate(d.nextEligibleDate)}</span>
                      </div>
                      <div className="flex items-center">
                        {elig ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
                            <CheckCircle2 className="w-3 h-3" />
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
                            <XCircle className="w-3 h-3" />
                            Not Eligible
                          </span>
                        )}
                      </div>
                      {d.createdByName && (
                        <div className="flex flex-col min-w-[100px]">
                          <span className="text-xs text-muted-foreground">Added by</span>
                          <span>{d.createdByName}</span>
                        </div>
                      )}
                      {d.files && d.files.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">Files</span>
                          <InlineFiles files={d.files} />
                        </div>
                      )}
                      {i === 0 && (
                        <span className="ml-auto self-center text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 500);

  const { data, isLoading } = useGetDeliveries(
    { search: debouncedSearch, limit: 200 },
    { query: { enabled: true } }
  );

  const deliveries = (data?.data || []) as DeliveryRecord[];
  const groups = groupByConsumer(deliveries);

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Search Consumers</h1>
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
                <th className="px-6 py-4 font-semibold text-right">History</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && groups.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <SearchIcon className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-lg font-medium">No results found</p>
                      <p className="text-sm">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
              {groups.map((group) => (
                <ConsumerRow key={group.consumerNumber} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
