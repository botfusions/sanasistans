"use client";

import {
  Wrench,
  Search,
  Globe,
  Mail,
  Image,
  Brain,
  Code,
  Zap,
} from "lucide-react";

const TOOLS = [
  {
    name: "Brave Search",
    desc: "Real-time web search and knowledge retrieval.",
    icon: Search,
    color: "text-orange-400",
  },
  {
    name: "Gmail Integration",
    desc: "Automated order parsing and email management.",
    icon: Mail,
    color: "text-red-400",
  },
  {
    name: "Visual Memory",
    desc: "Vector-based image embedding and search.",
    icon: Image,
    color: "text-blue-400",
  },
  {
    name: "Scrapling",
    desc: "High-performance web scraping and data extraction.",
    icon: Globe,
    color: "text-green-400",
  },
  {
    name: "LLM Swarm",
    desc: "Multi-model orchestration (GPT, Claude, Groq).",
    icon: Brain,
    color: "text-purple-400",
  },
  {
    name: "KAYA News",
    desc: "Strategic news analysis and alignment tracking.",
    icon: Zap,
    color: "text-yellow-400",
  },
];

export default function ToolInventory() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {TOOLS.map((tool, i) => (
        <div key={i} className="glass-card group flex flex-col gap-4">
          <div
            className={`p-3 rounded-xl bg-white/5 w-fit group-hover:bg-white/10 transition-colors`}
          >
            <tool.icon className={`${tool.color} w-6 h-6`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white group-hover:glow-text transition-all">
              {tool.name}
            </h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              {tool.desc}
            </p>
          </div>
          <div className="mt-auto pt-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Active System
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
