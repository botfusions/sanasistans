"use client";

import { Calendar, Package, Users } from "lucide-react";
import { useOrders, useStats } from "@/hooks/use-data";
import List01 from "./list-01";
import List02 from "./list-02";
import List03 from "./list-03";

export default function Content() {
  const { orders, loading: ordersLoading } = useOrders();
  const { stats, loading: statsLoading } = useStats();

  const staffStats = [
    {
      id: "1",
      title: "Aktif Personel",
      balance: stats.activeStaff.toString(),
      type: "savings" as const,
      description: "Üretim bandında",
    },
    {
      id: "2",
      title: "Bekleyen Sipariş",
      balance: stats.pendingProduction.toString(),
      type: "checking" as const,
      description: "Üretime hazır",
    },
    {
      id: "3",
      title: "Bugün Tamamlanan",
      balance: stats.completedToday.toString(),
      type: "investment" as const,
      description: "Sevkiyata hazır",
    },
    {
      id: "4",
      title: "Toplam Sipariş",
      balance: stats.totalOrders.toString(),
      type: "debt" as const,
      description: "Genel arşiv",
    },
  ];

  const recentOrders = orders.map((order) => ({
    id: order.id.toString(),
    title: order.customer_name || "İsimsiz Müşteri",
    amount: order.total_amount ? `${order.total_amount} ₺` : "-",
    type: "incoming" as const,
    category: "shopping",
    icon: Package,
    timestamp: new Date(order.created_at).toLocaleString("tr-TR"),
    status:
      order.status === "completed"
        ? ("completed" as const)
        : ("pending" as const),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0F0F12] rounded-xl p-6 flex flex-col border border-gray-200 dark:border-[#1F1F23]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-left flex items-center gap-2 ">
            <Users className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-50" />
            Personel & Üretim Özeti
          </h2>
          <div className="flex-1">
            <List01
              className="h-full"
              accounts={staffStats}
              totalBalance={`${stats.totalOrders} Sipariş`}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F0F12] rounded-xl p-6 flex flex-col border border-gray-200 dark:border-[#1F1F23]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-left flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-50" />
            Son Siparişler
          </h2>
          <div className="flex-1">
            <List02 className="h-full" transactions={recentOrders} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0F0F12] rounded-xl p-6 flex flex-col items-start justify-start border border-gray-200 dark:border-[#1F1F23]">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-left flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-50" />
          Üretim Hedefleri & Durum
        </h2>
        <List03 />
      </div>
    </div>
  );
}
