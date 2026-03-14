"use client";

import { useRouter } from "next/navigation";
import { Leaf, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

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
          <h2 className="text-xl font-black text-zinc-800 mb-4">Account Registration</h2>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Self-registration is not available. Accounts are created by your administrator.
              Please contact your farm owner or system administrator to get access.
            </p>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="w-full bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] py-3.5 rounded-xl font-bold transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
