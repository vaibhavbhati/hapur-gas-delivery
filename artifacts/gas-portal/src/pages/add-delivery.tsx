import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateDelivery, useGetDeliveries, getGetDeliveriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, UserCheck, UserPlus, Paperclip, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DeliveryFiles } from "@/components/DeliveryFiles";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  consumerNumber: z.string().min(1, "Consumer Number is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  deliveryDate: z.string().min(1, "Date is required"),
  mobileNumber: z.string().min(10, "Valid mobile number is required"),
});

type FormData = z.infer<typeof formSchema>;

export default function AddDeliveryPage() {
  const { isDeliveryLocked } = useAuth();
  const queryClient = useQueryClient();
  const [successData, setSuccessData] = React.useState<any>(null);
  const [isExisting, setIsExisting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      consumerNumber: "",
      customerName: "",
      deliveryDate: new Date().toISOString().split('T')[0],
      mobileNumber: "",
    }
  });

  const consumerNo = form.watch("consumerNumber");
  const [debouncedConsumerNo] = useDebounce(consumerNo, 600);

  const { data: searchRes, isFetching: isSearching } = useGetDeliveries(
    { search: debouncedConsumerNo, limit: 1 },
    { query: { enabled: !!debouncedConsumerNo && debouncedConsumerNo.length > 2 } }
  );

  React.useEffect(() => {
    // If the form's live consumer number is empty (e.g. just reset after submit),
    // don't auto-fill even if debouncedConsumerNo hasn't cleared yet.
    const liveConsumerNo = form.getValues("consumerNumber");
    if (!liveConsumerNo) {
      setIsExisting(false);
      return;
    }
    if (searchRes?.data?.length) {
      const match = searchRes.data.find(d => d.consumerNumber === debouncedConsumerNo);
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

  const createMutation = useCreateDelivery({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetDeliveriesQueryKey() });
        setSuccessData(data);
        form.reset({
          consumerNumber: "",
          customerName: "",
          deliveryDate: new Date().toISOString().split('T')[0],
          mobileNumber: "",
        });
        setIsExisting(false);
      }
    }
  });

  const onSubmit = async (data: FormData) => {
    setSuccessData(null);
    try {
      // The API spec doesn't include mobileNumber in CreateDeliveryRequest, but user reqs
      // state it must be editable for new users. Passing via ts-expect-error.
      // @ts-expect-error: bypassing generated types to fulfill UI requirements
      await createMutation.mutateAsync({ data });
    } catch (e) {
      console.error("Failed to create", e);
    }
  };

  if (isDeliveryLocked) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-5">
          <div className="bg-destructive/10 rounded-full p-6">
            <Lock className="w-12 h-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            Your account has been restricted from adding deliveries. Please contact the administrator to regain access.
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
            className="bg-success/10 border-2 border-success/20 p-6 rounded-2xl space-y-5"
          >
            <div className="flex gap-4 items-start">
              <CheckCircle2 className="w-8 h-8 text-success shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-success-foreground text-lg mb-1">Delivery Recorded Successfully</h3>
                <p className="text-sm text-success-foreground/80 mb-3">
                  Consumer <strong>{successData.consumerNumber}</strong> ({successData.customerName}) has been updated.
                </p>
                <div className="bg-white/50 px-4 py-3 rounded-xl inline-block border border-success/10">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Next Eligible Date</p>
                  <p className="font-display font-bold text-xl text-success">
                    {formatDate(successData.nextEligibleDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-success/20 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="w-4 h-4 text-success-foreground/70" />
                <span className="text-sm font-semibold text-success-foreground/80">Attach Files to This Delivery</span>
                <span className="text-xs text-muted-foreground">(optional — images, PDFs, Word docs)</span>
              </div>
              <DeliveryFiles deliveryId={successData.id} canDelete={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Details</CardTitle>
          <CardDescription>Enter the consumer's information below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Consumer Number</label>
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

            <AnimatePresence mode="wait">
              {debouncedConsumerNo && (
                <motion.div
                  key={isExisting ? "existing" : "new"}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-xl flex items-start gap-3 mb-6 ${isExisting ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Customer Name</label>
                <Input {...form.register("customerName")} placeholder="Full Name" />
                {form.formState.errors.customerName && (
                  <p className="text-destructive text-sm">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Mobile Number</label>
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date of Delivery</label>
              <Input 
                type="date" 
                {...form.register("deliveryDate")} 
              />
              {form.formState.errors.deliveryDate && (
                <p className="text-destructive text-sm">{form.formState.errors.deliveryDate.message}</p>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full md:w-auto"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Recording..." : "Record Delivery"}
              </Button>
            </div>
            
            {createMutation.isError && (
              <p className="text-destructive text-sm mt-2 text-center">
                Failed to record delivery. Please verify details.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
