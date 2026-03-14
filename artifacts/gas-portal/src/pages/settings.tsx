import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey, useGetUsers, useUpdateUserPassword, getGetUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, CheckCircle2, Users, Eye, EyeOff, KeyRound, Lock, LockOpen, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const settingsSchema = z.object({
  waitingDays: z.coerce.number().min(1, "Must be at least 1 day").max(365, "Must be less than a year"),
});
type SettingsForm = z.infer<typeof settingsSchema>;

const passwordSchema = z.object({
  password: z.string().min(4, "Password must be at least 4 characters"),
});
type PasswordForm = z.infer<typeof passwordSchema>;

function UserPasswordRow({ user }: { user: { id: number; username: string; name: string; role: string; deliveryLocked: boolean } }) {
  const queryClient = useQueryClient();
  const [showInput, setShowInput] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [lockPending, setLockPending] = React.useState(false);

  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const updatePwMutation = useUpdateUserPassword({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
        setShowInput(false);
        form.reset();
        setTimeout(() => setSuccess(false), 3000);
      },
    },
  });

  const onSave = async (data: PasswordForm) => {
    await updatePwMutation.mutateAsync({ id: user.id, data });
  };

  const toggleLock = async () => {
    setLockPending(true);
    try {
      await fetch(`${BASE}/api/users/${user.id}/delivery-lock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !user.deliveryLocked }),
      });
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    } finally {
      setLockPending(false);
    }
  };

  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${user.deliveryLocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{user.name}</p>
              {user.deliveryLocked && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">@{user.username} · <span className="capitalize">{user.role}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {success && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Updated
            </span>
          )}
          {!isAdmin && (
            <Button
              variant={user.deliveryLocked ? "destructive" : "outline"}
              size="sm"
              onClick={toggleLock}
              disabled={lockPending}
              title={user.deliveryLocked ? "Unlock: allow adding deliveries" : "Lock: prevent adding deliveries"}
            >
              {lockPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : user.deliveryLocked ? (
                <><LockOpen className="w-3.5 h-3.5 mr-1.5" />Unlock</>
              ) : (
                <><Lock className="w-3.5 h-3.5 mr-1.5" />Lock</>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowInput(!showInput); form.reset(); }}
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            {showInput ? "Cancel" : "Set Password"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showInput && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={form.handleSubmit(onSave)}
          >
            <div className="flex gap-2 pt-2 pl-12">
              <div className="relative flex-1">
                <Input
                  {...form.register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="New password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={updatePwMutation.isPending} size="sm">
                {updatePwMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-destructive text-xs mt-1 pl-12">{form.formState.errors.password.message}</p>
            )}
            {updatePwMutation.isError && (
              <p className="text-destructive text-xs mt-1 pl-12">Failed to update password.</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const { data: users, isLoading: usersLoading } = useGetUsers();
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { waitingDays: 25 },
  });

  React.useEffect(() => {
    if (settings) form.reset({ waitingDays: settings.waitingDays });
  }, [settings, form]);

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
      },
    },
  });

  const onSubmit = async (data: SettingsForm) => {
    await updateMutation.mutateAsync({ data });
  };

  if (isLoading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Portal Settings</h1>
        <p className="text-muted-foreground mt-1">Configure application parameters and manage user access.</p>
      </div>

      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 border border-green-200"
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-medium">Settings updated successfully.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Rules */}
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
              <label className="text-sm font-semibold text-foreground">
                Waiting Period (Days)
              </label>
              <div className="flex flex-wrap gap-3 items-center">
                <Input
                  type="number"
                  {...form.register("waitingDays")}
                  className="w-32 text-lg font-display"
                />
                <span className="text-muted-foreground text-sm">days between eligible gas deliveries</span>
              </div>
              {form.formState.errors.waitingDays && (
                <p className="text-destructive text-sm">{form.formState.errors.waitingDays.message}</p>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Set passwords for all portal users.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="py-4 text-muted-foreground text-sm">Loading users...</div>
          ) : (
            <div>
              {((users ?? []) as Array<{ id: number; username: string; name: string; role: string; deliveryLocked: boolean }>).map((user) => (
                <UserPasswordRow key={user.id} user={user} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
