import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User as UserIcon, Building2, Eye, EyeOff, X, Loader2, AlertCircle } from 'lucide-react';
import { User, Warehouse } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  onClose: () => void;
  apiUrl: string;
}

export default function Login({ onLoginSuccess, onClose, apiUrl }: LoginProps) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [warehouseId, setWarehouseId] = useState('1'); // Default fixed to 1 as requested
  const [showPassword, setShowPassword] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Load warehouses from backend on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch(`${apiUrl}/warehouses`);
        if (!res.ok) throw new Error('Failed to fetch warehouses');
        const data = await res.json();
        if (Array.isArray(data)) {
          setWarehouses(data);
          // If the list is loaded, make sure 1 is in there, or set to first available if 1 doesn't exist
          const hasDefault = data.some((w: any) => String(w.id) === '1');
          if (!hasDefault && data.length > 0) {
            setWarehouseId(String(data[0].id));
          }
        }
      } catch (err) {
        console.error('Error fetching warehouses, using fallback:', err);
        // Fallback static list containing default central warehouse
        setWarehouses([
          { id: 1, name: 'Almacén Central (Default)', code: 'ALM-CTR' },
          { id: 2, name: 'Estación Cocina Caliente', code: 'EST-CC' },
          { id: 3, name: 'Estación Repostería', code: 'EST-RP' }
        ]);
      }
    };

    fetchWarehouses();
  }, [apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName,
          password,
          warehouseId: Number(warehouseId)
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Credenciales incorrectas');
      }

      if (data.success && data.user && data.token) {
        onLoginSuccess(data.user, data.token);
      } else {
        throw new Error('Formato de respuesta inválido del servidor');
      }
    } catch (err: any) {
      console.error('Error durante el inicio de sesión:', err);
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Click outside to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Main Login Card Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10"
      >
        {/* Close button inside modal */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="text-center mb-8 pr-6 pl-6">
          <div className="mx-auto w-14 h-14 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20 mb-4 animate-pulse">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-serif font-black tracking-tight text-slate-900 leading-tight">
            Acceso Administrativo
          </h2>
          <p className="text-slate-505 text-xs sm:text-sm font-sans tracking-wide mt-1.5 uppercase font-semibold">
            Restaurante Flavoro
          </p>
        </div>

        {/* Error Message Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm font-medium">{error}</div>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* User field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Usuario
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <UserIcon className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ingresa tu usuario"
                disabled={isLoading}
                className="w-full pl-10.5 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 rounded-2xl text-sm transition outline-none font-medium text-slate-800 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full pl-10.5 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 rounded-2xl text-sm transition outline-none font-medium text-slate-800 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Warehouse Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Sucursal / Almacén
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Building2 className="w-4.5 h-4.5" />
              </span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10.5 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 rounded-2xl text-sm transition outline-none font-medium text-slate-800 disabled:opacity-50 appearance-none cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code || `ID: ${w.id}`})
                  </option>
                ))}
              </select>
              {/* Custom select arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-primary-500 hover:bg-primary-600 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary-500/25 border-none disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                Autenticando...
              </>
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>

        {/* Demo/Helper Section */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-1.5"
            >
              <div className="text-xxs font-mono text-slate-500 uppercase tracking-wider font-bold">Credenciales Semilla:</div>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Usuario:</span> <code className="bg-slate-250 px-1.5 py-0.5 rounded text-slate-800 font-bold font-mono">admin</code>
              </div>
              <div className="text-xs text-slate-650 flex justify-between">
                <span>Contraseña:</span> <code className="bg-slate-250 px-1.5 py-0.5 rounded text-slate-800 font-bold font-mono">admin123</code>
              </div>
              <div className="text-xxs text-slate-400 mt-2 italic font-sans leading-relaxed">
                * Estas credenciales se inicializan de forma automática en la base de datos al arrancar el servidor backend por primera vez.
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
