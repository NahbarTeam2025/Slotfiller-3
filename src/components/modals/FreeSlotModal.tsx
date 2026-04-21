import { useState, useEffect } from "react";
import { doc, collection, query, where, getDocs, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { CustomServicesList } from "../CustomServicesList";
import { Clock } from "lucide-react";

interface FreeSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: any;
  slots: any[];
  clients: any[];
  businessId: string;
  defaultTime?: string;
  defaultDate?: string;
  onSuccess: (result: any) => void;
  getCapacityForTime: (time: string, date: string) => number;
  timeSlots: string[];
}

export function FreeSlotModal({
  isOpen,
  onClose,
  business,
  slots,
  clients,
  businessId,
  defaultTime,
  defaultDate,
  onSuccess,
  getCapacityForTime,
  timeSlots
}: FreeSlotModalProps) {
  const [newSlotDate, setNewSlotDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState(defaultTime || "");
  const [newSlotEmployee, setNewSlotEmployee] = useState("");
  const [newSlotServices, setNewSlotServices] = useState<string[]>([]);
  const [isCustomService, setIsCustomService] = useState(false);
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [slotServiceSearch, setSlotServiceSearch] = useState("");
  const [slotEmployeeSearch, setSlotEmployeeSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSmartStaggered, setIsSmartStaggered] = useState(false);
  const [staggerTime, setStaggerTime] = useState("30");

  useEffect(() => {
    if (isOpen) {
      setNewSlotDate(defaultDate || new Date().toISOString().split('T')[0]);
      setNewSlotTime(defaultTime || "");
      setNewSlotEmployee("");
      setNewSlotServices([]);
      setIsCustomService(false);
      setCustomServices([]);
      setSelectedClients([]);
      setClientSearch("");
      setError(null);
      setIsSmartStaggered(false);
    }
  }, [isOpen, defaultDate, defaultTime]);

  useEffect(() => {
    if (isOpen && newSlotTime) {
      setTimeout(() => {
        const element = document.getElementById(`free-time-slot-${newSlotTime.replace(':', '-')}`);
        if (element) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isOpen, newSlotTime]);

  const handleCreateFreeSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime) return;
    setIsSubmitting(true);
    setError(null);

    const finalServices = [...newSlotServices, ...customServices].filter(Boolean);
    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    
    let serviceTypeString = finalServices.join(", ");
    if (employee) {
      serviceTypeString += serviceTypeString ? ` bei ${employee.name}` : `Bei ${employee.name}`;
    }
    if (!serviceTypeString) {
      serviceTypeString = "Freier Termin";
    }

    try {
      let resultSlotId = "";
      await runTransaction(db, async (transaction) => {
        const slotsQuery = query(
          collection(db, `businesses/${businessId}/slots`),
          where("date", "==", newSlotDate),
          where("time", "==", newSlotTime)
        );
        const snapshot = await getDocs(slotsQuery);
        const existingSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        if (newSlotEmployee) {
          const employeeConflict = existingSlots.find((s: any) => s.employeeId === newSlotEmployee);
          if (employeeConflict) {
            throw new Error("Dieser Mitarbeiter hat zu der gewählten Zeit bereits einen Eintrag.");
          }
        }

        const newSlotRef = doc(collection(db, `businesses/${businessId}/slots`));
        resultSlotId = newSlotRef.id;
        transaction.set(newSlotRef, {
          date: newSlotDate,
          time: newSlotTime,
          serviceType: serviceTypeString,
          employeeId: newSlotEmployee || null,
          employeeName: employee?.name || "",
          status: "open",
          notifiedClients: selectedClients,
          bookedBy: null,
          bookedAt: null,
          createdAt: new Date().toISOString()
        });
      });

      // Call worker
      try {
        const primaryClients = isSmartStaggered 
          ? matchingClients.filter(c => selectedClients.includes(c.id) && c.isPriority).map(c => c.id)
          : selectedClients;
        
        const secondaryClients = isSmartStaggered 
          ? matchingClients.filter(c => selectedClients.includes(c.id) && !c.isPriority).map(c => c.id)
          : [];

        await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            slotId: resultSlotId,
            date: newSlotDate,
            time: newSlotTime,
            serviceType: serviceTypeString,
            manualClients: primaryClients,
            secondaryClients: secondaryClients,
            staggerMinutes: parseInt(staggerTime),
            isStaggered: isSmartStaggered
          })
        });
      } catch (workerErr) {
        console.warn("Worker error", workerErr);
      }

      onSuccess({ id: resultSlotId, notified: selectedClients.length });
      onClose();
    } catch (err: any) {
      setError(err.message || "Fehler beim Erstellen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const now = new Date();
  const localToday = now.toISOString().split('T')[0];
  const localTime = format(now, 'HH:mm');
  const localNowString = `${localToday}T${localTime}`;
  const futureAppointments = slots.filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString);

  const matchingClients = clients.filter(c => {
    return c.active !== false;
  }).map(c => {
    const hasFutureAppointment = futureAppointments.some(s => s.bookedBy === c.name);
    const clientAppts = futureAppointments.filter(s => s.bookedBy === c.name);
    const isPriority = hasFutureAppointment && clientAppts.some(appt => {
      const apptDate = new Date(appt.date);
      const slotDate = new Date(newSlotDate);
      const diffDays = Math.ceil(Math.abs(apptDate.getTime() - slotDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
    
    // Check if services match
    const hasMatchingService = newSlotServices.length === 0 || 
                               (c.serviceTypes && Array.isArray(c.serviceTypes) && newSlotServices.some(s => c.serviceTypes.includes(s)));
    
    return { ...c, isPriority, hasFutureAppointment, hasMatchingService };
  }).filter(c => c.hasFutureAppointment).sort((a, b) => {
    // Priority: matching service first, then priority status, then name
    if (a.hasMatchingService !== b.hasMatchingService) return a.hasMatchingService ? -1 : 1;
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    if (a.hasFutureAppointment !== b.hasFutureAppointment) return a.hasFutureAppointment ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const displayedClients = matchingClients.filter(c => {
    const searchMatch = !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase());
    // Only filter by service if explicitly searching/filtering? 
    // Actually, let's show all matching clients and let the user see why they are prioritized.
    return searchMatch;
  });

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Termin melden"
      headerClassName="bg-deep-blue"
      footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={onClose}>Abbrechen</Button>
          <Button 
            className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
            onClick={handleCreateFreeSlot}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Wird gesendet..." : "Jetzt benachrichtigen"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
        
        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Datum</label>
          <Input type="date" value={newSlotDate} onChange={(e) => setNewSlotDate(e.target.value)} className="dark:bg-slate-800 dark:text-white" />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Uhrzeit</label>
          <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[150px] p-1 scrollbar-thin">
            {timeSlots.map(time => (
              <button
                key={time}
                id={`free-time-slot-${time.replace(':', '-')}`}
                onClick={() => setNewSlotTime(time)}
                className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${newSlotTime === time ? 'bg-accent/20 text-deep-blue dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
          <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <Input placeholder="Mitarbeiter suchen..." value={slotEmployeeSearch} onChange={(e) => setSlotEmployeeSearch(e.target.value)} className="h-8 text-xs dark:bg-slate-900" />
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[150px]">
              <button onClick={() => setNewSlotEmployee("")} className={`px-3 py-2 rounded-md text-sm font-medium text-left ${newSlotEmployee === "" ? 'bg-accent/20' : ''}`}>Kein Mitarbeiter</button>
              {business?.employees?.filter((e:any) => e.name.toLowerCase().includes(slotEmployeeSearch.toLowerCase())).map((emp:any) => (
                <button key={emp.id} onClick={() => setNewSlotEmployee(emp.id)} className={`px-3 py-2 rounded-md text-sm font-medium text-left ${newSlotEmployee === emp.id ? 'bg-accent/20' : ''}`}>{emp.name}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistung</label>
          <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
               <Input placeholder="Dienstleistung suchen..." value={slotServiceSearch} onChange={(e) => setSlotServiceSearch(e.target.value)} className="h-8 text-xs dark:bg-slate-900" />
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[150px]">
              {business?.serviceTypes?.filter((s:string) => s.toLowerCase().includes(slotServiceSearch.toLowerCase())).map((service:string) => (
                <label key={service} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" checked={newSlotServices.includes(service)} onChange={() => setNewSlotServices(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service])} className="accent-accent" />
                  <span className="text-sm dark:text-white">{service}</span>
                </label>
              ))}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-slate-700">
              <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isCustomService} onChange={() => setIsCustomService(!isCustomService)} className="accent-accent" />
                <span className="text-sm dark:text-white">Individuell...</span>
              </label>
            </div>
          </div>
          {isCustomService && (
            <CustomServicesList 
              list={customServices} 
              onAdd={s => setCustomServices([...customServices, s])} 
              onRemove={i => setCustomServices(customServices.filter((_, idx) => idx !== i))} 
              onEdit={(i, v) => { const n = [...customServices]; n[i] = v; setCustomServices(n); }} 
            />
          )}
        </div>

        <div className="space-y-4">
          <div id="staggered-notification-config" className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <div className="flex-1">
              <label htmlFor="staggered-toggle" className="text-sm font-bold text-deep-blue dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" /> Zweistufig melden
              </label>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                Zuerst Kunden mit nahen Terminen (+/- 7 Tage) benachrichtigen. Wenn nach der Wartezeit noch frei, werden alle anderen kontaktiert.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isSmartStaggered && (
                <select 
                  id="stagger-time-select"
                  value={staggerTime}
                  onChange={(e) => setStaggerTime(e.target.value)}
                  className="text-[10px] font-bold h-7 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-deep-blue dark:text-white p-0 px-2"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                </select>
              )}
              <div 
                id="staggered-toggle"
                onClick={() => setIsSmartStaggered(!isSmartStaggered)}
                className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${isSmartStaggered ? 'bg-accent' : 'bg-gray-200 dark:bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isSmartStaggered ? 'translate-x-4' : ''}`} />
              </div>
            </div>
          </div>

          <Input id="slot-client-search" placeholder="Kunden suchen..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="block text-[10px] font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Kunden ({displayedClients.length})</label>
              <button 
                id="select-appointment-clients-btn"
                onClick={() => {
                  const withAppointments = matchingClients.filter(c => c.hasFutureAppointment).map(c => c.id);
                  setSelectedClients(withAppointments);
                }}
                className="text-[9px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-bold uppercase transition-colors hover:bg-indigo-200"
              >
                Termin-Kunden
              </button>
            </div>
            <button id="select-all-clients-btn" onClick={() => setSelectedClients(selectedClients.length === displayedClients.length ? [] : displayedClients.map(c => c.id))} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">Alle wählen</button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
            {displayedClients.map(client => (
              <div key={client.id} onClick={() => setSelectedClients(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${selectedClients.includes(client.id) ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedClients.includes(client.id) ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                  {selectedClients.includes(client.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold dark:text-white flex items-center gap-2">
                    {client.name} 
                    {client.isPriority && <span className="text-[8px] bg-accent text-white px-1 rounded">Naher Termin</span>}
                    {client.hasFutureAppointment && !client.isPriority && <span className="text-[8px] bg-gray-100 dark:bg-slate-800 text-gray-400 px-1 rounded border dark:border-slate-700">Termin</span>}
                  </div>
                  <div className="text-[10px] text-gray-500">{client.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function format(date: Date, pattern: string) {
  if (pattern === 'HH:mm') {
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  }
  return '';
}
