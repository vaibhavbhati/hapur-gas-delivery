import * as React from "react";
import { useGetDeliveries } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Calendar, Droplets, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { data: deliveriesRes, isLoading } = useGetDeliveries({ limit: 100 });
  
  const deliveries = deliveriesRes?.data || [];
  
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM
  
  const todayCount = deliveries.filter(d => d.deliveryDate.startsWith(todayStr)).length;
  const monthCount = deliveries.filter(d => d.deliveryDate.startsWith(thisMonthStr)).length;
  
  const recentDeliveries = [...deliveries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const stats = [
    { title: "Total Deliveries", value: deliveriesRes?.total || 0, icon: Droplets, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Today's Deliveries", value: todayCount, icon: Activity, color: "text-teal-600", bg: "bg-teal-100" },
    { title: "This Month", value: monthCount, icon: Calendar, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Total Consumers", value: new Set(deliveries.map(d => d.consumerNumber)).size, icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your gas delivery operations.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-32 bg-slate-100 rounded-2xl" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`p-4 rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-display font-bold mb-4">Recent Deliveries</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold">Consumer No.</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Delivery Date</th>
                  <th className="px-6 py-4 font-semibold">Next Eligible</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No recent deliveries found.
                    </td>
                  </tr>
                )}
                {recentDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="bg-white border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{delivery.consumerNumber}</td>
                    <td className="px-6 py-4">{delivery.customerName}</td>
                    <td className="px-6 py-4">{formatDate(delivery.deliveryDate)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatDate(delivery.nextEligibleDate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
