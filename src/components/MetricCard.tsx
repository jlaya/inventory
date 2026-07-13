import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  titulo: string;
  valor: number | string;
  subtitulo: string;
  color: 'blue' | 'yellow' | 'red' | 'green' | 'purple';
  icono: LucideIcon;
  activo?: boolean;
  onClick?: () => void;
  id?: string;
}

export default function MetricCard({
  titulo,
  valor,
  subtitulo,
  color,
  icono: Icono,
  activo = false,
  onClick,
  id,
}: MetricCardProps) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50 border-blue-100',
      text: 'text-blue-900',
      number: 'text-blue-600',
      iconBg: 'bg-blue-100 text-blue-600',
      activeBorder: 'ring-2 ring-blue-500 border-blue-500',
    },
    yellow: {
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-900',
      number: 'text-amber-600',
      iconBg: 'bg-amber-100 text-amber-600',
      activeBorder: 'ring-2 ring-amber-500 border-amber-500',
    },
    red: {
      bg: 'bg-rose-50 border-rose-100',
      text: 'text-rose-900',
      number: 'text-rose-600',
      iconBg: 'bg-rose-100 text-rose-600',
      activeBorder: 'ring-2 ring-rose-500 border-rose-500',
    },
    green: {
      bg: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-900',
      number: 'text-emerald-600',
      iconBg: 'bg-emerald-100 text-emerald-600',
      activeBorder: 'ring-2 ring-emerald-500 border-emerald-500',
    },
    purple: {
      bg: 'bg-purple-50 border-purple-100',
      text: 'text-purple-900',
      number: 'text-purple-600',
      iconBg: 'bg-purple-100 text-purple-600',
      activeBorder: 'ring-2 ring-purple-500 border-purple-500',
    },
  };

  const scheme = colorMap[color];

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      id={id}
      className={`p-5 rounded-2xl border bg-white shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        activo ? scheme.activeBorder + ' shadow-md' : 'hover:shadow-md'
      } ${scheme.bg}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
            {titulo}
          </p>
          <p className="text-3xl font-display font-bold mt-1 tracking-tight">
            <span className={scheme.number}>{valor}</span>
          </p>
        </div>
        <div className={`p-3 rounded-xl ${scheme.iconBg}`}>
          <Icono className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-150/40 flex items-center justify-between">
        <span className="text-xs text-slate-600 font-sans">{subtitulo}</span>
        {activo && (
          <span className="text-[10px] uppercase font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
            Filtrando
          </span>
        )}
      </div>
    </motion.div>
  );
}
