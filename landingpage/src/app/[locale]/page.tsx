import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CrisisTicker from "@/components/CrisisTicker";
import ProblemStats from "@/components/ProblemStats";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import AIDetection from "@/components/AIDetection";
import ImpactNumbers from "@/components/ImpactNumbers";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />
            <Hero />
            <CrisisTicker />
            <ProblemStats />
            <HowItWorks />
            <Features />
            <AIDetection />
            <ImpactNumbers />
            <Testimonials />
            <Pricing />
            <FAQ />
            <CTA />
            <Footer />
        </main>
    );
}
