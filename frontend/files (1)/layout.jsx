import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export const metadata = {
  title: "AQUA — نظام الري الذكي",
  description: "Smart Irrigation Dashboard for Moroccan Farmers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
