"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [method, setMethod] = useState<"passkey" | "email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (method === "email") {
        const { error: reqError } = await authClient.emailOtp.sendVerificationOtp({ 
          email: identifier, 
          type: "sign-in" 
        });
        if (reqError) throw reqError;
      } else if (method === "phone") {
        const { error: reqError } = await authClient.phoneNumber.sendOtp({ 
          phoneNumber: identifier 
        });
        if (reqError) throw reqError;
      }
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (method === "email") {
        const { error: verError } = await authClient.signIn.emailOtp({ 
          email: identifier, 
          otp 
        });
        if (verError) throw verError;
      } else if (method === "phone") {
        const { error: verError } = await authClient.phoneNumber.verify({ 
          phoneNumber: identifier, 
          code: otp 
        });
        if (verError) throw verError;
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const { error: pkError } = await authClient.signIn.passkey();
      if (pkError) throw pkError;
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Passkey login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">CRM Secure Login</h2>
          <p className="mt-2 text-sm text-gray-600">Access strictly restricted to authorized staff.</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {step === "request" ? (
          <div className="space-y-6">
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email or Phone Number
                </label>
                <input
                  type={method === "email" ? "email" : "tel"}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setMethod(e.target.value.includes("@") ? "email" : "phone");
                  }}
                  disabled={isLoading}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="name@example.com or +919876543210"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send Verification Code"}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-gray-500">Or continue with</span>
              </div>
            </div>

            <button 
              onClick={handlePasskeyLogin} 
              disabled={isLoading}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Passkey
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center tracking-widest text-lg disabled:opacity-50"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || otp.length < 6}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify & Sign In"}
            </button>
            <button 
              type="button" 
              onClick={() => setStep("request")} 
              disabled={isLoading}
              className="w-full text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              &larr; Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
