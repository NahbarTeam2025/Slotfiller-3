import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, doc, deleteDoc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { format } from "date-fns";
import { Users, Calendar as CalendarIcon, Clock } from "lucide-react";
import { CustomServicesList } from "../CustomServicesList";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: any;
  slots: any[];
  clients: any[];
  businessId: string | null;
  editingSlot?: any;
  defaultDate?: string;
  defaultTime?: string;
  onSuccess: () => void;
  getCapacityForTime: (time: string, date: string) => number;
  timeSlots: string[];
}

export function BookingModal({
  isOpen,
  onClose,
  business,
  slots,
  clients,
  businessId,
  editingSlot,
  defaultDate,
  defaultTime,
  onSuccess,
  getCapacityForTime,
  timeSlots
}: BookingModalProps) {
  const isEditMode = !!editingSlot;
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotEmployee, setNewSlotEmployee] = useState("");
  const [newSlotServices, setNewSlotServices] = useState<string[]>([]);
  const [clientName, setClientName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slotEmployeeSearch, setSlotEmployeeSearch] = useState("");
  const [slotServiceSearch, setSlotServiceSearch] = useState("");
  const [isCustomService, setIsCustomService] = useState(false);
  const [customServices, setCustomServices] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingSlot) {
        setNewSlotDate(editingSlot.date);
        setNewSlotTime(editingSlot.time);
        setNewSlotEmployee(editingSlot.employeeId || "");
        setClientName(editingSlot.bookedBy || "");
        const services = editingSlot.serviceType ? editingSlot.serviceType.split(", ") : [];
        setNewSlotServices(services);
        setCustomServices([]);
      } else {
        setNewSlotDate(defaultDate || format(new Date(), 'yyyy-MM-dd'));
        setNewSlotTime(defaultTime || "10:00");
        setNewSlotEmployee("");
        setNewSlotServices([]);
        setClientName("");
        setIsCustomService(false);
        setCustomServices([]);
      }
    }
  }, [isOpen, editingSlot, defaultDate, defaultTime]);

  const handleCreateBookedSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime || !clientName) return;
    
    setIsSubmitting(true);
    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    const finalServices = [...newSlotServices, ...customServices].filter(Boolean).join(", ");

    try {
      await runTransaction(db, async (transaction) => {
        const slotsQuery = query(
          collection(db, `businesses/${businessId}/slots`),
          where("date", "==", newSlotDate),
          where("time", "==", newSlotTime),
          where("status", "==", "booked")
        );
        const snapshot = await getDocs(slotsQuery);
        const bookedSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        if (newSlotEmployee) {
          const employeeConflict = bookedSlots.find((s: any) => s.employeeId === newSlotEmployee && s.id !== editingSlot?.id);
          if (employeeConflict) {
            throw new Error("Dieser Mitarbeiter hat zu der gewählten Zeit bereits einen Termin.");
          }
        }

        const capacity = getCapacityForTime(newSlotTime, newSlotDate);
        if (bookedSlots.length >= capacity && !editingSlot?.id) {
          throw new Error("Zu dieser Zeit ist die maximale Kapazität bereits erreicht.");
        }

        if (isEditMode && editingSlot?.id) {
          transaction.update(doc(db, `businesses/${businessId}/slots`, editingSlot.id), {
            date: newSlotDate,
            time: newSlotTime,
            serviceType: finalServices,
            employeeId: newSlotEmployee || null,
            employeeName: employee?.name || "",
            bookedBy: clientName,
            updatedAt: new Date().toISOString()
          });
        } else {
          const openSlotsQuery = query(
            collection(db, `businesses/${businessId}/slots`),
            where("date", "==", newSlotDate),
            where("time", "==", newSlotTime),
            where("status", "==", "open")
          );
          const openSnapshot = await getDocs(openSlotsQuery);
          const existingOpenSlot = openSnapshot.docs.find(d => {
            const data = d.data();
            return !newSlotEmployee || data.employeeId === newSlotEmployee || !data.employeeId;
          });

          if (existingOpenSlot) {
            transaction.update(existingOpenSlot.ref, {
              status: "booked",
              bookedBy: clientName,
              bookedAt: new Date().toISOString(),
              serviceType: finalServices,
              employeeId: newSlotEmployee || null,
              employeeName: employee?.name || null
            });
          } else {
            const newSlotRef = doc(collection(db, `businesses/${businessId}/slots`));
            transaction.set(newSlotRef, {
              date: newSlotDate,
              time: newSlotTime,
              serviceType: finalServices,
              employeeId: newSlotEmployee || null,
              employeeName: employee?.name || "",
              status: "booked",
              notifiedClients: [],
              bookedBy: clientName,
              bookedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      if (!isEditMode) {
        const todayString = format(new Date(), 'yyyy-MM-dd');
        const existingAppointments = slots.filter(s => 
          s.status === 'booked' && 
          s.bookedBy === clientName && 
          s.date >= todayString &&
          !(s.date === newSlotDate && s.time === newSlotTime)
        );

        for (const oldSlot of existingAppointments) {
          await deleteDoc(doc(db, `businesses/${businessId}/slots`, oldSlot.id));
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error saving booked slot", error);
      alert(error.message || "Fehler beim Speichern des Termins.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const employee = business?.employees?.find((e: any) => e.id === newSlotEmployee);
  const availableServices = employee?.serviceTypes || business?.serviceTypes || [];
  
  const filteredEmployees = [...(business?.employees || [])]
    .filter(e => e.name.toLowerCase().startsWith(slotEmployeeSearch.toLowerCase()))
    .filter(e => {
      const isBooked = slots.some(s => 
        s.date === newSlotDate && 
        s.time === newSlotTime && 
        s.status === 'booked' && 
        s.employeeId === e.id &&
        s.id !== editingSlot?.id
      );
      return !isBooked;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredServices = [...availableServices]
    .filter(s => s.toLowerCase().startsWith(slotServiceSearch.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const filteredClients = clients
    .filter(c => c.name.toLowerCase().startsWith(clientName.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const footer = (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={onClose} disabled={isSubmitting}>
        Abbrechen
      </Button>
      <Button 
        className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
        onClick={handleCreateBookedSlot}
        disabled={isSubmitting || !clientName}
      >
        {isSubmitting ? "Wird gespeichert..." : "Termin speichern"}
      </Button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditMode ? "Termin bearbeiten" : "Termin eintragen"}
      headerClassName="bg-deep-blue"
      footer={footer}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Datum</label>
          <Input 
            type="date" 
            value={newSlotDate} 
            onChange={(e) => setNewSlotDate(e.target.value)}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Uhrzeit</label>
          <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[200px] p-1 scrollbar-thin">
            {timeSlots.map((time) => {
              const timeSlotsData = slots.filter(s => s.date === newSlotDate && s.time === time);
              const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
              const capacity = getCapacityForTime(time, newSlotDate);
              const remainingCapacity = capacity - bookedCount;
              
              return (
                <button
                  key={time}
                  onClick={() => setNewSlotTime(time)}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                    newSlotTime === time 
                      ? 'bg-accent/20 text-deep-blue dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span>{time}</span>
                    <span className={`text-[10px] font-bold ${remainingCapacity > 0 ? 'text-accent' : 'text-red-500'}`}>
                      {remainingCapacity}/{capacity}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
          <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <Input
                placeholder="Mitarbeiter suchen..."
                value={slotEmployeeSearch}
                onChange={(e) => setSlotEmployeeSearch(e.target.value)}
                className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[200px]">
              <button
                onClick={() => { setNewSlotEmployee(""); setSlotEmployeeSearch(""); }}
                className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                  newSlotEmployee === "" 
                    ? 'bg-accent/20 text-deep-blue dark:text-white' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                Kein Mitarbeiter ausgewählt
              </button>
              {filteredEmployees.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => { setNewSlotEmployee(emp.id); setSlotEmployeeSearch(""); }}
                  className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                    newSlotEmployee === emp.id 
                      ? 'bg-accent/20 text-deep-blue dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistung</label>
          <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <Input
                placeholder="Dienstleistung suchen..."
                value={slotServiceSearch}
                onChange={(e) => setSlotServiceSearch(e.target.value)}
                className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[200px]">
              {filteredServices.map((service: string) => (
                <label
                  key={service}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={newSlotServices.includes(service)}
                    onChange={() => {
                      if (newSlotServices.includes(service)) {
                        setNewSlotServices(newSlotServices.filter(s => s !== service));
                      } else {
                        setNewSlotServices([...newSlotServices, service]);
                      }
                    }}
                    className="accent-accent"
                  />
                  <span>{service}</span>
                </label>
              ))}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                <label className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCustomService}
                    onChange={() => setIsCustomService(!isCustomService)}
                    className="accent-accent"
                  />
                  <span>Individuell...</span>
                </label>
            </div>
          </div>
          {isCustomService && (
            <CustomServicesList 
              list={customServices}
              onAdd={(s) => setCustomServices([...customServices, s])}
              onRemove={(i) => setCustomServices(customServices.filter((_, idx) => idx !== i))}
              onEdit={(i, v) => {
                const newList = [...customServices];
                newList[i] = v;
                setCustomServices(newList);
              }}
            />
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Name des Kunden</label>
          <Input 
            placeholder="Kunde suchen oder Name eingeben..." 
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
            {filteredClients.map((client: any) => (
              <div 
                key={client.id}
                onClick={() => setClientName(client.name)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${clientName === client.name ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${clientName === client.name ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                  {clientName === client.name && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
              <div className="px-3 py-4 text-sm text-center text-gray-400">Kein Kunde gefunden</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
