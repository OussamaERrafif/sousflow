"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUpMutation } from "@/lib/store/apiSlice";
import { Leaf, Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  
  const [signUp, { isLoading }] = useSignUpMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
      }).unwrap();
      router.push("/");
    } catch (err: any) {
      setError(err?.data?.detail || "Registration failed. Please try again.");
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
          <h2 className="text-xl font-black text-zinc-800 mb-6">Create Account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full ltr:pl-11 rtl:pr-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Email *</label>
              <div className="relative">
                <Mail className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full ltr:pl-11 rtl:pr-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full ltr:pl-11 rtl:pr-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="+212612345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Password *</label>
              <div className="relative">
                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full ltr:pl-11 rtl:pr-11 ltr:pr-11 rtl:pl-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="••••••••"
                  required
                  minLength={6}
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

            <div>
              <label className="block text-sm font-bold text-zinc-600 mb-1.5">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full ltr:pl-11 rtl:pr-11 ltr:pr-11 rtl:pl-11 px-4 py-3 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-500 font-bold text-sm">
              Already have an account?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-[#C17A3A] hover:underline font-bold"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
