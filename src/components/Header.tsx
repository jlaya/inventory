import React from 'react';
import { ClipboardCheck, Bell, ShieldCheck, AlertTriangle, LogOut } from 'lucide-react';
import { AlertaAlmacen, User as UserType } from '../types';

interface HeaderProps {
  alertas: AlertaAlmacen[];
  onOpenAlerts: () => void;
  onResetData: () => void;
  onGoBack?: () => void;
  user?: UserType | null;
  onLogout?: () => void;
}

export default function Header({ alertas, onOpenAlerts, onResetData, onGoBack, user, onLogout }: HeaderProps) {
  const alertasNoLeidas = alertas.filter((a) => !a.leido).length;

  return (
    <header className="bg-slate-900 text-white shadow-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* Logo & Brand Title */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-600 rounded-xl shadow-lg shadow-sky-500/10 flex items-center justify-center">
              <ClipboardCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tracking-widest uppercase bg-primary-900/50 text-sky-400 px-2.5 py-0.5 rounded-full border border-sky-800/50">
                  RESTAURANTE CONTROL
                </span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tiempo Real
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white mt-1">
                RANGO DE TOLERANCIA PARA INVENTARIO
              </h1>
            </div>
          </div>

          {/* Quick Actions & Notifications */}
          <div className="flex items-center gap-4 self-end md:self-auto">
            {user && (
              <div className="flex items-center gap-3 bg-slate-800/40 pl-3 pr-2 py-1.5 rounded-xl border border-slate-700/30">
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-600"
                  />
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-100 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 leading-none mt-0.5 uppercase tracking-wide">
                    {user.charge || 'Usuario'} {user.warehouse ? `• ${user.warehouse.name}` : ''}
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Cerrar sesión"
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {onGoBack && (
              <button
                onClick={onGoBack}
                className="text-xs font-medium text-slate-400 hover:text-white px-3.5 py-2 rounded-xl bg-slate-800/40 hover:bg-slate-805 transition border border-slate-700/50 cursor-pointer"
                id="btn-volver-landing"
              >
                Volver al Sitio
              </button>
            )}

            {/* Notifications button removed */}
          </div>

        </div>

        {/* Subtitle / Concept Banner */}
        <div className="mt-5 p-4 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-3 items-start">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              <strong>El rango de tolerancia</strong> permite controlar las variaciones aceptables entre el
              stock físico y el stock del sistema para garantizar exactitud y disponibilidad.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700 shrink-0 self-end sm:self-auto">
            Actualizado: {new Date().toLocaleDateString('es-ES')}
          </div>
        </div>

      </div>
    </header>
  );
}
