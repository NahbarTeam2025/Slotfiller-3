import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { X } from "lucide-react";

export function Onboarding() {
  const { user, businessId } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [services, setServices] = useState<string[]>(["Haarschnitt", "Färben", "Waschen & Föhnen"]);
  const [newService, setNewService] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (businessId) {
      navigate("/");
    }
  }, [businessId, navigate]);

  const handleAddService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService("");
    }
  };

  const handleRemoveService = (service: string) => {
    setServices(services.filter((s) => s !== service));
  };

  const handleSave = async () => {
    if (!user || !businessName.trim()) return;
    setLoading(true);

    try {
      await setDoc(doc(db, "businesses", user.uid), {
        name: businessName.trim(),
        email: user.email,
        phone: "",
        googleUid: user.uid,
        serviceTypes: services,
        openingHours: {
          monday: { open: "08:00", close: "18:00", closed: false },
          tuesday: { open: "08:00", close: "18:00", closed: false },
          wednesday: { open: "08:00", close: "18:00", closed: false },
          thursday: { open: "08:00", close: "18:00", closed: false },
          friday: { open: "08:00", close: "18:00", closed: false },
          saturday: { open: "08:00", close: "14:00", closed: false },
          sunday: { open: "08:00", close: "18:00", closed: true },
        },
        smsBalance: 50, // Starter balance
        twilioSid: "",
        twilioToken: "",
        twilioPhone: "",
        createdAt: new Date().toISOString(),
      });
      // Force reload to update auth context
      window.location.href = "/";
    } catch (error) {
      console.error("Error creating business profile", error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black p-4 sm:p-8">
      <div className="flex flex-col lg:flex-row w-full max-w-5xl mx-auto my-auto bg-white dark:bg-card-dark rounded-2xl shadow-xl overflow-hidden min-h-[600px] border border-gray-100 dark:border-slate-800">
        {/* Left Side */}
        <div className="w-full lg:w-1/2 bg-deep-blue p-8 sm:p-12 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8 sm:mb-12">
              <div className="w-4 h-4 bg-accent rounded-sm"></div>
              <span className="font-bold tracking-widest text-sm">SLOTFILLER</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">Die Zukunft<br className="hidden sm:block"/>deines<br className="hidden sm:block"/>Salons.</h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-sm">
              Einfache Terminplanung, maximale Auslastung. Modernste Technik für dein Handwerk.
            </p>
          </div>
          
          <div className="relative z-10 bg-white/5 border border-white/10 p-4 sm:p-6 rounded-xl font-mono text-[10px] sm:text-xs text-accent mt-8 lg:mt-0">
            <div className="flex gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <p>&gt; initializing_onboarding_sequence...</p>
            <p className="text-gray-400">&gt; loading metadata: {businessName || "new_business"}</p>
            <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-accent w-1/3"></div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 flex flex-col">
          <div className="mb-8 sm:mb-10">
            <p className="text-accent text-xs font-bold tracking-widest uppercase mb-2">Onboarding</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-deep-blue dark:text-white mb-2">Willkommen bei SlotFiller</h2>
            <p className="text-gray-500 dark:text-gray-400">Richten wir dein Profil ein.</p>
          </div>

          <div className="space-y-8 flex-1">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Business-Name</label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="z.B. Hair & Style"
                className="text-lg py-6 border-0 border-b-2 border-gray-200 dark:border-slate-700 rounded-none px-0 focus:ring-0 focus:border-accent dark:bg-transparent dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">Deine ersten Dienstleistungen</label>
              <div className="space-y-2 mb-4">
                {services.map((service) => (
                  <div key={service} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-800">
                    <span className="font-medium text-deep-blue dark:text-white">{service}</span>
                    <button onClick={() => handleRemoveService(service)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
                  placeholder="Weitere Dienstleistung hinzufügen..."
                  className="border-dashed border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Button onClick={handleAddService} variant="outline" className="border-dashed border-2 border-gray-200 dark:border-slate-700 text-accent hover:text-accent-hover hover:border-accent">
                  +
                </Button>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={!businessName.trim() || loading}
            className="w-full py-6 text-lg bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover mt-8 shadow-lg shadow-deep-blue/10 dark:shadow-accent/10"
          >
            {loading ? "Speichern..." : "Zum Dashboard →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
