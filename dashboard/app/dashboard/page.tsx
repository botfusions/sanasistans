"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ToolInventory from "@/components/ToolInventory";
import {
  Users,
  ShoppingBag,
  Database,
  ArrowUpRight,
  Activity,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    agents: 12,
    orders: 0,
    visualMemory: 0,
  });
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch initial stats
    const fetchStats = async () => {
      const { count: orderCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      const { count: vmCount } = await supabase
        .from("visual_memory")
        .select("*", { count: "exact", head: true });

      setStats((prev) => ({
        ...prev,
        orders: orderCount || 0,
        visualMemory: vmCount || 0,
      }));
    };

    fetchStats();

    // Real-time subscription
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          setStats((prev) => ({ ...prev, orders: prev.orders + 1 }));
          const newOrder = payload.new as { customer_name?: string };
          addLog("New Order Received", newOrder.customer_name || "Internal");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visual_memory" },
        () => {
          setStats((prev) => ({
            ...prev,
            visualMemory: prev.visualMemory + 1,
          }));
          addLog("Visual Memory Updated", "New vector embedding saved");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addLog = (action: string, detail: string) => {
    setLogs((prev) =>
      [
        {
          id: Date.now(),
          action,
          detail,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 5),
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Active Swarm Agents"
          value={stats.agents.toString()}
          icon={<Users className="text-blue-400" />}
          trend="+2 online"
        />
        <StatCard
          title="Processed Orders"
          value={stats.orders.toString()}
          icon={<ShoppingBag className="text-purple-400" />}
          trend="Real-time Sync"
        />
        <StatCard
          title="Visual Memory Neurons"
          value={stats.visualMemory.toString()}
          icon={<Database className="text-green-400" />}
          trend="Vector-indexed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Section: Tools */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold glow-text uppercase tracking-widest flex items-center gap-2">
              <Activity size={18} className="text-blue-500" />
              Visible Swarm Inventory
            </h2>
          </div>
          <ToolInventory />
        </div>

        {/* Sidebar Section: Live Activity */}
        <div className="space-y-6 text-Turkish">
          <h2 className="text-lg font-semibold glow-text uppercase tracking-widest">
            Canlı Aktivite
          </h2>
          <div className="glass-card flex flex-col gap-4 min-h-[400px]">
            {logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-sm text-center px-4">
                <div className="h-12 w-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-4">
                  <Activity size={20} className="animate-pulse" />
                </div>
                Bekleniyor...
                <br />
                Sistem aktiviteleri burada belirecek.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="border-b border-white/5 pb-3 last:border-0 last:pb-0 animate-in slide-in-from-right-4 duration-300"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {log.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    {log.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
}) {
  return (
    <div className="glass-card relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
        {title}
      </p>
      <div className="flex items-end gap-3">
        <h3 className="text-4xl font-bold text-white tracking-tighter">
          {value}
        </h3>
        <span className="text-[10px] font-medium text-green-400 mb-1 flex items-center gap-1">
          <ArrowUpRight size={12} />
          {trend}
        </span>
      </div>
    </div>
  );
}
