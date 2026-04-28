"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignInApiAuthSigninPostMutation } from "@/lib/store/generated/api";
import { routing } from "@/i18n/routing";
import { setCredentials } from "@/lib/store/slices/authSlice";
import { useAppDispatch } from "@/lib/store/hooks";
import { Leaf, User, Lock, Eye, EyeOff, AlertCircle, Zap } from "lucide-react";

const FAST_LOGIN_USER = "admin";
const FAST_LOGIN_PASS = "admin123";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [signIn, { isLoading }] = useSignInApiAuthSigninPostMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await signIn({ signInRequest: { username, password } }).unwrap();
      try { localStorage.setItem("token", data.access_token); } catch {}
      dispatch(setCredentials({ user: data.user as { id: string; username: string }, token: data.access_token }));
      router.push("/");
    } catch (err: any) {
      setError(err?.data?.detail || "Invalid username or password");
    }
  };

  const handleFastLogin = async () => {
    setError("");
    setUsername(FAST_LOGIN_USER);
    setPassword(FAST_LOGIN_PASS);
    try {
      const data = await signIn({ signInRequest: { username: FAST_LOGIN_USER, password: FAST_LOGIN_PASS } }).unwrap();
      try { localStorage.setItem("token", data.access_token); } catch {}
      dispatch(setCredentials({ user: data.user as { id: string; username: string }, token: data.access_token }));
      router.push(`/${routing.defaultLocale}`);
    } catch (err: any) {
      setError(err?.data?.detail || "Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] p-4">

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#3D1F0F] rounded-2xl mb-4">
            <Leaf className="w-8 h-8 text-[#C17A3A]" />
          </div>
          <h1 className="text-3xl font-black text-[#3D1F0F]">SousFlow</h1>
          <p className="text-[#8B7355] font-bold mt-1">Smart Irrigation System</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-zinc-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-zinc-800">Welcome Back</h2>
            <button
              type="button"
              onClick={handleFastLogin}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-black shadow-lg bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              Fast Login
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full ltr:pl-11 rtl:pr-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full ltr:pl-11 rtl:pr-11 ltr:pr-11 rtl:pl-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
