"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setOrders(data);
      setLoading(false);
    }

    fetchOrders();

    // Realtime subscription
    const subscription = supabase
      .channel("orders_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { orders, loading };
}

export function useStats() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingProduction: 0,
    completedToday: 0,
    activeStaff: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, created_at");
      const { count: staffCount } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true });

      if (orders) {
        const today = new Date().toISOString().split("T")[0];
        setStats({
          totalOrders: orders.length,
          pendingProduction: orders.filter(
            (o) => o.status === "pending" || o.status === "in-progress",
          ).length,
          completedToday: orders.filter(
            (o) => o.status === "completed" && o.created_at.startsWith(today),
          ).length,
          activeStaff: staffCount || 0,
        });
      }
      setLoading(false);
    }

    fetchStats();
  }, []);

  return { stats, loading };
}
