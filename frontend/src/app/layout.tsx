import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { ReduxProvider } from "@/lib/store/ReduxProvider";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "SousFlow - Login",
  description: "Smart Irrigation Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${tajawal.variable} font-sans antialiased text-[#5A4A3A] bg-[#F5F0E8]`}>
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
