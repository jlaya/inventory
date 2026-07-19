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
      bg: 'bg-blue-600 border-blue-700 text-white',
      title: 'text-blue-100',
      number: 'text-white',
      iconBg: 'bg-white/20 text-white',
      activeBorder: 'ring-4 ring-blue-300 border-white',
      borderT: 'border-blue-500/50',
      subtitle: 'text-blue-100/90',
      badge: 'bg-white text-blue-900',
    },
    yellow: {
      bg: 'bg-amber-500 border-amber-600 text-amber-950',
      title: 'text-amber-950/75',
      number: 'text-amber-950',
      iconBg: 'bg-amber-950/10 text-amber-950',
      activeBorder: 'ring-4 ring-amber-300 border-amber-950',
      borderT: 'border-amber-400/50',
      subtitle: 'text-amber-900',
      badge: 'bg-amber-950 text-white',
    },
    red: {
      bg: 'bg-rose-600 border-rose-700 text-white',
      title: 'text-rose-100',
      number: 'text-white',
      iconBg: 'bg-white/20 text-white',
      activeBorder: 'ring-4 ring-rose-300 border-white',
      borderT: 'border-rose-500/50',
      subtitle: 'text-rose-100/90',
      badge: 'bg-white text-rose-900',
    },
    green: {
      bg: 'bg-emerald-600 border-emerald-700 text-white',
      title: 'text-emerald-100',
      number: 'text-white',
      iconBg: 'bg-white/20 text-white',
      activeBorder: 'ring-4 ring-emerald-300 border-white',
      borderT: 'border-emerald-500/50',
      subtitle: 'text-emerald-100/90',
      badge: 'bg-white text-emerald-900',
    },
    purple: {
      bg: 'bg-purple-600 border-purple-700 text-white',
      title: 'text-purple-100',
      number: 'text-white',
      iconBg: 'bg-white/20 text-white',
      activeBorder: 'ring-4 ring-purple-300 border-white',
      borderT: 'border-purple-500/50',
      subtitle: 'text-purple-100/90',
      badge: 'bg-white text-purple-900',
    },
  };

  const scheme = colorMap[color];

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      id={id}
      className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        activo ? scheme.activeBorder + ' shadow-md' : 'hover:shadow-md'
      } ${scheme.bg}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-mono font-medium uppercase tracking-wider ${scheme.title}`}>
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
      <div className={`mt-4 pt-3 border-t flex items-center justify-between ${scheme.borderT}`}>
        <span className={`text-xs font-sans ${scheme.subtitle}`}>{subtitulo}</span>
        {activo && (
          <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${scheme.badge}`}>
            Filtrando
          </span>
        )}
      </div>
    </motion.div>
  );
}
