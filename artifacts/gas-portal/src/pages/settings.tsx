import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const settingsSchema = z.object({
  waitingDays: z.coerce.number().min(1, "Must be at least 1 day").max(365, "Must be less than a year"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { waitingDays: 25 }
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({ waitingDays: settings.waitingDays });
    }
  }, [settings, form]);

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
      }
    }
  });

  const onSubmit = async (data: SettingsForm) => {
    await updateMutation.mutateAsync({ data });
  };

  if (isLoading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Portal Settings</h1>
        <p className="text-muted-foreground mt-1">Configure global application parameters.</p>
      </div>

      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-success/10 text-success p-4 rounded-xl flex items-center gap-3 border border-success/20"
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-medium">Settings updated successfully.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Delivery Rules</CardTitle>
              <CardDescription>Rules applied to all new delivery records.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground flex justify-between">
                <span>Waiting Period (Days)</span>
              </label>
              <div className="flex gap-4 items-center">
                <Input 
                  type="number" 
                  {...form.register("waitingDays")} 
                  className="max-w-[200px] text-lg font-display"
                />
                <span className="text-muted-foreground text-sm">days between eligible gas deliveries</span>
              </div>
              {form.formState.errors.waitingDays && (
                <p className="text-destructive text-sm">{form.formState.errors.waitingDays.message}</p>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <Button 
                type="submit" 
                disabled={updateMutation.isPending || !form.formState.isDirty}
              >
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
