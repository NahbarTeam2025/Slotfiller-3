import { useState, useEffect, FormEvent } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus, X, MessageSquare, Save, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

export function Settings() {
  const { businessId } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  const DAYS = [
    { id: 'monday', label: 'Montag' },
    { id: 'tuesday', label: 'Dienstag' },
    { id: 'wednesday', label: 'Mittwoch' },
    { id: 'thursday', label: 'Donnerstag' },
    { id: 'friday', label: 'Freitag' },
    { id: 'saturday', label: 'Samstag' },
    { id: 'sunday', label: 'Sonntag' }
  ];

  const updateBusiness = async (updates: any) => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "businesses", businessId), updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating business", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    await updateBusiness({ name, openingHours });
  };

  // Form State
  const [name, setName] = useState("");
  const [openingHours, setOpeningHours] = useState<any>({
    monday: { open: "08:00", close: "18:00", closed: false },
    tuesday: { open: "08:00", close: "18:00", closed: false },
    wednesday: { open: "08:00", close: "18:00", closed: false },
    thursday: { open: "08:00", close: "18:00", closed: false },
    friday: { open: "08:00", close: "18:00", closed: false },
    saturday: { open: "08:00", close: "14:00", closed: false },
    sunday: { open: "08:00", close: "18:00", closed: true },
  });
  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [absences, setAbsences] = useState<any[]>([]);
  const [newAbsence, setNewAbsence] = useState({ employeeId: "", type: "Urlaub", startDate: "", endDate: "" });
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");

  const [federalState, setFederalState] = useState("");

  const [isInitialized, setIsInitialized] = useState(false);
  const [twilioPasswordInput, setTwilioPasswordInput] = useState("");
  const [isTwilioUnlocked, setIsTwilioUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    const unsub = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
        
        // Only set form state on initial load to prevent overwriting unsaved changes
        if (!isInitialized) {
          setName(data.name || "");
          if (data.openingHours) {
            setOpeningHours(data.openingHours);
          } else if (data.openTime && data.closeTime) {
            // Migration for old data
            const migrated: any = {};
            DAYS.forEach(day => {
              migrated[day.id] = { open: data.openTime, close: data.closeTime, closed: false };
            });
            setOpeningHours(migrated);
          }
          setServices(data.serviceTypes || []);
          setEmployees(data.employees || []);
          setAbsences(data.absences || []);
          setTwilioSid(data.twilioSid || "");
          setTwilioToken(data.twilioToken || "");
          setTwilioPhone(data.twilioPhone || "");
          setFederalState(data.federalState || "");
          setIsInitialized(true);
        } else {
          // Keep services in sync since they can be added/removed directly
          setServices(data.serviceTypes || []);
          setEmployees(data.employees || []);
          setAbsences(data.absences || []);
        }
      }
    });

    return () => unsub();
  }, [businessId, isInitialized]);

  const handleAddService = async () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      const updatedServices = [...services, newService.trim()];
      setServices(updatedServices);
      setNewService("");
      
      if (businessId) {
        await updateDoc(doc(db, "businesses", businessId), {
          serviceTypes: updatedServices
        });
      }
    }
  };

  const handleRemoveService = async (service: string) => {
    const updatedServices = services.filter((s) => s !== service);
    setServices(updatedServices);
    
    if (businessId) {
      await updateDoc(doc(db, "businesses", businessId), {
        serviceTypes: updatedServices
      });
    }
  };

  const handleAddEmployee = async () => {
    if (newEmployeeName.trim()) {
      const newEmployee = { id: Date.now().toString(), name: newEmployeeName.trim() };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      setNewEmployeeName("");
      if (businessId) {
        await updateDoc(doc(db, "businesses", businessId), { employees: updatedEmployees });
      }
    }
  };

  const handleRemoveEmployee = async (id: string) => {
    const updatedEmployees = employees.filter((e) => e.id !== id);
    setEmployees(updatedEmployees);
    if (businessId) {
      await updateDoc(doc(db, "businesses", businessId), { employees: updatedEmployees });
    }
  };

  const handleAddAbsence = async () => {
    if (newAbsence.employeeId && newAbsence.startDate && newAbsence.endDate) {
      const absence = { id: Date.now().toString(), ...newAbsence };
      const updatedAbsences = [...absences, absence];
      setAbsences(updatedAbsences);
      setNewAbsence({ employeeId: "", type: "Urlaub", startDate: "", endDate: "" });
      if (businessId) {
        await updateDoc(doc(db, "businesses", businessId), { absences: updatedAbsences });
      }
    }
  };

  const handleRemoveAbsence = async (id: string) => {
    const updatedAbsences = absences.filter((a) => a.id !== id);
    setAbsences(updatedAbsences);
    if (businessId) {
      await updateDoc(doc(db, "businesses", businessId), { absences: updatedAbsences });
    }
  };

  const handleUnlockTwilio = (e: FormEvent) => {
    e.preventDefault();
    if (twilioPasswordInput === "Twilio") {
      setIsTwilioUnlocked(true);
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setTwilioPasswordInput("");
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setIsSaving(true);

    try {
      await updateDoc(doc(db, "businesses", businessId), {
        name,
        openingHours,
        serviceTypes: services,
        twilioSid,
        twilioToken,
        twilioPhone
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!business) return <div className="p-8 dark:text-white">Lade Einstellungen...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Einstellungen & SMS</h1>
        <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mt-2">Systemeinstellungen & Anbieter-Anbindung</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Unternehmensprofil */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Unternehmensprofil</h3>
              {isSaving && <span className="text-[10px] font-bold text-accent animate-pulse uppercase tracking-widest">Speichert...</span>}
              {saveSuccess && <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Gespeichert</span>}
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name des Unternehmens</label>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => updateBusiness({ name })}
                  className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Öffnungszeiten</label>
                {DAYS.map((day) => (
                  <div key={day.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                    <div className="w-24 shrink-0">
                      <span className="text-sm font-bold text-deep-blue dark:text-white">{day.label}</span>
                    </div>
                    
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center gap-2">
                        <Input 
                          type="time"
                          disabled={openingHours[day.id]?.closed}
                          value={openingHours[day.id]?.open || "08:00"} 
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], open: e.target.value}};
                            setOpeningHours(newHours);
                          }}
                          onBlur={() => updateBusiness({ openingHours })}
                          className="h-8 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                        <span className="text-gray-400">-</span>
                        <Input 
                          type="time"
                          disabled={openingHours[day.id]?.closed}
                          value={openingHours[day.id]?.close || "18:00"} 
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], close: e.target.value}};
                            setOpeningHours(newHours);
                          }}
                          onBlur={() => updateBusiness({ openingHours })}
                          className="h-8 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={openingHours[day.id]?.closed}
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], closed: e.target.checked}};
                            setOpeningHours(newHours);
                            updateBusiness({ openingHours: newHours });
                          }}
                          className="rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Geschlossen</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-800">
                <span className="text-sm text-gray-500 dark:text-gray-400">Betriebsstatus</span>
                <span className="px-3 py-1 bg-accent/20 text-accent-hover text-xs font-bold uppercase tracking-wider rounded">Aktiv</span>
              </div>
            </div>
          </div>

          {/* Feiertage (Bundesland Auswahl) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">Feiertage</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Wählen Sie Ihr Bundesland aus, um Feiertage automatisch im Kalender anzuzeigen.</p>
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              value={federalState}
              onChange={(e) => {
                setFederalState(e.target.value);
                updateBusiness({ federalState: e.target.value });
              }}
            >
              <option value="">Bundesland auswählen...</option>
              <option value="BW">Baden-Württemberg</option>
              <option value="BY">Bayern</option>
              <option value="BE">Berlin</option>
              <option value="BB">Brandenburg</option>
              <option value="HB">Bremen</option>
              <option value="HH">Hamburg</option>
              <option value="HE">Hessen</option>
              <option value="MV">Mecklenburg-Vorpommern</option>
              <option value="NI">Niedersachsen</option>
              <option value="NW">Nordrhein-Westfalen</option>
              <option value="RP">Rheinland-Pfalz</option>
              <option value="SL">Saarland</option>
              <option value="SN">Sachsen</option>
              <option value="ST">Sachsen-Anhalt</option>
              <option value="SH">Schleswig-Holstein</option>
              <option value="TH">Thüringen</option>
            </select>
          </div>

          {/* Mitarbeiter Verwalten */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">Mitarbeiter</h3>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700">
                  <span className="font-medium text-deep-blue dark:text-white">{emp.name}</span>
                  <button onClick={() => handleRemoveEmployee(emp.id)} className="text-gray-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
                placeholder="Mitarbeiter Name..."
                className="border-dashed border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <Button onClick={handleAddEmployee} variant="outline" className="border-dashed border-2 border-gray-200 dark:border-slate-700 text-accent hover:text-accent-hover hover:border-accent">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Abwesenheiten (Urlaub, Krankheit, Feiertage) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">Abwesenheiten (Urlaub, Krankheit)</h3>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {absences.map((abs) => {
                const emp = employees.find(e => e.id === abs.employeeId);
                return (
                  <div key={abs.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700">
                    <div>
                      <span className="font-medium text-deep-blue dark:text-white block">{emp?.name || 'Unbekannt'} - {abs.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{abs.startDate} bis {abs.endDate}</span>
                    </div>
                    <button onClick={() => handleRemoveAbsence(abs.id)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="space-y-3 border-t border-gray-100 dark:border-slate-800 pt-4">
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newAbsence.employeeId}
                onChange={(e) => setNewAbsence({...newAbsence, employeeId: e.target.value})}
              >
                <option value="">Mitarbeiter auswählen...</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newAbsence.type}
                onChange={(e) => setNewAbsence({...newAbsence, type: e.target.value})}
              >
                <option value="Urlaub">Urlaub</option>
                <option value="Krankheit">Krankheit</option>
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Von</label>
                  <Input type="date" value={newAbsence.startDate} onChange={(e) => setNewAbsence({...newAbsence, startDate: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Bis</label>
                  <Input type="date" value={newAbsence.endDate} onChange={(e) => setNewAbsence({...newAbsence, endDate: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
              </div>
              <Button onClick={handleAddAbsence} className="w-full bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold">
                Abwesenheit eintragen
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Services Verwalten */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Services Verwalten</h3>
            </div>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {services.map((service) => (
                <div key={service} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700">
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
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Twilio Verbindung */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-full border border-red-100 dark:border-red-900/30">
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">SMS-Anbieter (Twilio)</h3>
                <p className="font-bold text-deep-blue dark:text-white">Twilio Verbindung</p>
              </div>
            </div>

            {!isTwilioUnlocked ? (
              <form onSubmit={handleUnlockTwilio} className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Diese Einstellungen sind passwortgeschützt.</p>
                <div className="space-y-2">
                  <Input 
                    type="password"
                    value={twilioPasswordInput}
                    onChange={(e) => setTwilioPasswordInput(e.target.value)}
                    placeholder="Passwort eingeben..."
                    className={cn(
                      "bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white",
                      unlockError && "border-red-500 focus:ring-red-500"
                    )}
                  />
                  {unlockError && <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Falsches Passwort</p>}
                </div>
                <Button type="submit" className="w-full bg-deep-blue dark:bg-slate-800 text-white font-bold">
                  Freischalten
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Account SID</label>
                  <Input 
                    type="password"
                    value={twilioSid} 
                    onChange={(e) => setTwilioSid(e.target.value)}
                    onBlur={() => updateBusiness({ twilioSid })}
                    className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="AC..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Passwort (Auth Token)</label>
                  <Input 
                    type="password"
                    value={twilioToken} 
                    onChange={(e) => setTwilioToken(e.target.value)}
                    onBlur={() => updateBusiness({ twilioToken })}
                    className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="••••••••••••••••"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Absendernummer</label>
                    <Input 
                      value={twilioPhone} 
                      onChange={(e) => setTwilioPhone(e.target.value)}
                      onBlur={() => updateBusiness({ twilioPhone })}
                      className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="+49 (0) 000 00000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Standardregion</label>
                    <select className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent">
                      <option>Europa (West1)</option>
                      <option>US (East)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center pt-4 border-t border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    Verbindung sicher
                  </div>
                  <button className="text-xs font-bold tracking-widest text-deep-blue dark:text-accent uppercase hover:text-accent transition-colors">
                    Verbindung Testen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
