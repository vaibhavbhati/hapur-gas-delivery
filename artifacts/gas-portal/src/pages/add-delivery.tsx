import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateDelivery,
  useGetDeliveries,
  useRequestUploadUrl,
  useAttachDeliveryFile,
  getGetDeliveriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  CheckCircle2,
  UserCheck,
  UserPlus,
  Lock,
  Paperclip,
  X,
  FileImage,
  FileText,
  File as FileIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  consumerNumber: z.string().min(1, "Consumer Number is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  deliveryDate: z.string().min(1, "Date of Delivery is required"),
  mobileNumber: z
    .string()
    .min(1, "Mobile Number is required")
    .min(10, "Enter a valid 10-digit mobile number"),
});

type FormData = z.infer<typeof formSchema>;

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (type.includes("word") || type.includes("document")) return <FileText className="w-4 h-4 text-blue-700" />;
  return <FileIcon className="w-4 h-4 text-muted-foreground" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface SelectedFile {
  id: string;
  file: File;
  error?: string;
}

export default function AddDeliveryPage() {
  const { isDeliveryLocked } = useAuth();
  const queryClient = useQueryClient();
  const [successData, setSuccessData] = React.useState<{ consumerNumber: string; customerName: string; nextEligibleDate: string; attachedCount: number } | null>(null);
  const [isExisting, setIsExisting] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const requestUploadUrl = useRequestUploadUrl();
  const attachFile = useAttachDeliveryFile();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      consumerNumber: "",
      customerName: "",
      deliveryDate: new Date().toISOString().split("T")[0],
      mobileNumber: "",
    },
  });

  const consumerNo = form.watch("consumerNumber");
  const [debouncedConsumerNo] = useDebounce(consumerNo, 600);

  const { data: searchRes, isFetching: isSearching } = useGetDeliveries(
    { search: debouncedConsumerNo, limit: 1 },
    { query: { enabled: !!debouncedConsumerNo && debouncedConsumerNo.length > 2 } }
  );

  React.useEffect(() => {
    const liveConsumerNo = form.getValues("consumerNumber");
    if (!liveConsumerNo) {
      setIsExisting(false);
      return;
    }
    if (searchRes?.data?.length) {
      const match = searchRes.data.find((d) => d.consumerNumber === debouncedConsumerNo);
      if (match) {
        form.setValue("mobileNumber", match.mobileNumber);
        form.setValue("customerName", match.customerName);
        setIsExisting(true);
      } else {
        setIsExisting(false);
      }
    } else if (debouncedConsumerNo) {
      setIsExisting(false);
    }
  }, [searchRes, debouncedConsumerNo, form]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles: SelectedFile[] = [];
    for (const file of Array.from(incoming)) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      if (!ALLOWED_TYPES.includes(file.type)) {
        newFiles.push({ id, file, error: "Unsupported file type" });
      } else if (file.size > MAX_FILE_SIZE) {
        newFiles.push({ id, file, error: "File exceeds 20 MB limit" });
      } else {
        newFiles.push({ id, file });
      }
    }
    setSelectedFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const createMutation = useCreateDelivery();

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    setSuccessData(null);

    const validFiles = selectedFiles.filter((f) => !f.error);

    try {
      // 1. Create the delivery
      // @ts-expect-error: mobileNumber not in generated type but required
      const delivery = await createMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: getGetDeliveriesQueryKey() });

      // 2. Upload selected files
      let attachedCount = 0;
      if (validFiles.length > 0) {
        setIsUploading(true);
        for (const sf of validFiles) {
          try {
            const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
              data: { name: sf.file.name, size: sf.file.size, contentType: sf.file.type },
            });
            await fetch(uploadURL, {
              method: "PUT",
              body: sf.file,
              headers: { "Content-Type": sf.file.type },
            });
            await attachFile.mutateAsync({
              id: delivery.id,
              data: {
                fileName: sf.file.name,
                fileType: sf.file.type,
                fileSize: sf.file.size,
                objectPath,
              },
            });
            attachedCount++;
          } catch {
            // continue uploading the rest even if one fails
          }
        }
        setIsUploading(false);
      }

      // 3. Show success + reset
      setSuccessData({
        consumerNumber: delivery.consumerNumber,
        customerName: delivery.customerName,
        nextEligibleDate: delivery.nextEligibleDate,
        attachedCount,
      });
      form.reset({
        consumerNumber: "",
        customerName: "",
        deliveryDate: new Date().toISOString().split("T")[0],
        mobileNumber: "",
      });
      setIsExisting(false);
      setSelectedFiles([]);
    } catch (e: any) {
      setIsUploading(false);
      const msg = e?.response?.data?.message ?? "Failed to record delivery. Please try again.";
      setSubmitError(msg);
    }
  };

  const isPending = createMutation.isPending || isUploading;

  if (isDeliveryLocked) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-5">
          <div className="bg-destructive/10 rounded-full p-6">
            <Lock className="w-12 h-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            Your account has been restricted from adding deliveries. Please contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Add Delivery</h1>
        <p className="text-muted-foreground mt-1">Record a new gas delivery for a consumer.</p>
      </div>

      <AnimatePresence>
        {successData && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-success/10 border-2 border-success/20 p-6 rounded-2xl flex gap-4 items-start"
          >
            <CheckCircle2 className="w-8 h-8 text-success shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-success-foreground text-lg mb-1">Delivery Recorded Successfully</h3>
              <p className="text-sm text-success-foreground/80 mb-3">
                Consumer <strong>{successData.consumerNumber}</strong> ({successData.customerName}) has been updated.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="bg-white/50 px-4 py-3 rounded-xl border border-success/10">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Next Eligible Date</p>
                  <p className="font-display font-bold text-xl text-success">{formatDate(successData.nextEligibleDate)}</p>
                </div>
                {successData.attachedCount > 0 && (
                  <div className="bg-white/50 px-4 py-3 rounded-xl border border-success/10 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-success" />
                    <p className="text-sm font-medium text-success-foreground">
                      {successData.attachedCount} file{successData.attachedCount !== 1 ? "s" : ""} attached
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Details</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Consumer Number */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Consumer Number <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  {...form.register("consumerNumber")}
                  placeholder="Enter consumer number"
                  className="font-mono text-lg"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>
              {form.formState.errors.consumerNumber && (
                <p className="text-destructive text-sm">{form.formState.errors.consumerNumber.message}</p>
              )}
            </div>

            {/* Existing / new indicator */}
            <AnimatePresence mode="wait">
              {debouncedConsumerNo && (
                <motion.div
                  key={isExisting ? "existing" : "new"}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${isExisting ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>
                    {isExisting ? <UserCheck className="w-5 h-5 shrink-0" /> : <UserPlus className="w-5 h-5 shrink-0" />}
                    <div>
                      <p className="font-semibold">{isExisting ? "Existing Consumer Found" : "New Consumer"}</p>
                      <p className="text-sm opacity-80">
                        {isExisting
                          ? "Details have been auto-populated from previous records."
                          : "No previous records found. Please enter all details manually."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Customer Name + Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Customer Name <span className="text-destructive">*</span>
                </label>
                <Input {...form.register("customerName")} placeholder="Full Name" />
                {form.formState.errors.customerName && (
                  <p className="text-destructive text-sm">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Mobile Number <span className="text-destructive">*</span>
                </label>
                <Input
                  {...form.register("mobileNumber")}
                  placeholder="e.g. 9876543210"
                  disabled={isExisting}
                  className={isExisting ? "bg-slate-50 cursor-not-allowed opacity-70" : ""}
                />
                {form.formState.errors.mobileNumber && (
                  <p className="text-destructive text-sm">{form.formState.errors.mobileNumber.message}</p>
                )}
              </div>
            </div>

            {/* Date of Delivery */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Date of Delivery <span className="text-destructive">*</span>
              </label>
              <Input type="date" {...form.register("deliveryDate")} />
              {form.formState.errors.deliveryDate && (
                <p className="text-destructive text-sm">{form.formState.errors.deliveryDate.message}</p>
              )}
            </div>

            {/* File Attachments */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                Attach Files
                <span className="text-muted-foreground font-normal text-xs ml-1">(optional — images, PDFs, Word docs · max 20 MB · up to 5)</span>
              </label>

              {/* Drop zone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-6 py-8 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-slate-50"
                } ${selectedFiles.length >= MAX_FILES ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="w-7 h-7 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {selectedFiles.length >= MAX_FILES
                    ? "Maximum 5 files selected"
                    : "Click to browse or drag & drop files here"}
                </p>
                <p className="text-xs text-muted-foreground">Images, PDFs, Word documents</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />

              {/* Selected files list */}
              {selectedFiles.length > 0 && (
                <ul className="space-y-2">
                  {selectedFiles.map((sf) => (
                    <li
                      key={sf.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        sf.error ? "border-destructive/40 bg-destructive/5" : "border-border bg-slate-50"
                      }`}
                    >
                      {getFileIcon(sf.file.type)}
                      <span className="flex-1 truncate font-medium max-w-[200px]" title={sf.file.name}>
                        {sf.file.name}
                      </span>
                      {sf.error ? (
                        <span className="text-xs text-destructive shrink-0">{sf.error}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">{formatBytes(sf.file.size)}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(sf.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-border">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto gap-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isUploading ? "Uploading files..." : "Recording..."}
                  </>
                ) : (
                  "Record Delivery"
                )}
              </Button>
            </div>

            {submitError && (
              <p className="text-destructive text-sm">{submitError}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
