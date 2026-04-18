import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { CustomServicesList } from "../CustomServicesList";

interface NotificationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: any;
  slots: any[];
  clients: any[];
  businessId: string;
  selectedSlot: any;
  onSuccess: (result: any) => void;
}

export function NotificationManagerModal({
  isOpen,
  onClose,
  business,
  slots,
  clients,
  businessId,
  selectedSlot,
  onSuccess,
}: NotificationManagerModalProps) {
  const [additionalServiceType, setAdditionalServiceType] = useState<string>("");
  const [isCustomNotifyService, setIsCustomNotifyService] = useState(false);
  const [customNotifyServices, setCustomNotifyServices] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [additionalClients, setAdditionalClients] = useState<string[]>([]);
  const [slotServiceSearch, setSlotServiceSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAdditionalClients([]);
      setClientSearch("");
      setAdditionalServiceType("");
      setIsCustomNotifyService(false);
      setCustomNotifyServices([]);
      setError(null);
    }
  }, [isOpen]);

  const handleNotifyAction = async () => {
    if (!businessId || !selectedSlot || additionalClients.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    const finalServices = [
      ...additionalServiceType.split(', ').filter(Boolean),
      ...customNotifyServices
    ].filter(Boolean).join(", ");

    const employee = selectedSlot.employeeId ? business?.employees?.find((e: any) => e.id === selectedSlot.employeeId) : null;
    let serviceTypeString = finalServices;
    if (employee) {
      serviceTypeString += serviceTypeString ? ` bei ${employee.name}` : `Bei ${employee.name}`;
    }

    try {
      const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          slotId: selectedSlot.id,
          date: selectedSlot.date,
          time: selectedSlot.time,
          serviceType: serviceTypeString,
          manualClients: additionalClients
        })
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess(result);
      } else {
        throw new Error("Fehler beim Senden der Benachrichtigungen.");
      }
    } catch (err: any) {
      console.error("Error notifying clients", err);
      setError(err.message || "Benachrichtigung konnte nicht gesendet werden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const now = new Date();
  const localNowString = `${format(now, 'yyyy-MM-dd')}T${format(now, 'HH:mm')}`;
  const futureAppointments = slots.filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString);
  const selectedServices = additionalServiceType ? additionalServiceType.split(', ').filter(Boolean) : [];
  
  const availableClients = clients.filter(c => {
    return c.active !== false && !(selectedSlot?.notifiedClients || []).includes(c.id);
  });

  const clientsWithPriority = availableClients.map(c => {
    const hasFutureAppointment = futureAppointments.some(s => s.bookedBy === c.name);
    const clientAppts = futureAppointments.filter(s => s.bookedBy === c.name);
    let isPriority = false;
    if (selectedSlot?.date) {
      const slotDate = new Date(selectedSlot.date);
      isPriority = hasFutureAppointment && clientAppts.some(appt => {
        const apptDate = new Date(appt.date);
        const diffTime = Math.abs(apptDate.getTime() - slotDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      });
    }

    const hasMatchingService = selectedServices.length === 0 || 
                               (c.serviceTypes && Array.isArray(c.serviceTypes) && selectedServices.some(s => c.serviceTypes.includes(s)));

    return { ...c, isPriority, hasFutureAppointment, hasMatchingService };
  });

  const filtered = clientsWithPriority
    .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                c.phone?.toLowerCase().includes(clientSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.hasMatchingService !== b.hasMatchingService) return a.hasMatchingService ? -1 : 1;
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      if (a.hasFutureAppointment !== b.hasFutureAppointment) return a.hasFutureAppointment ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const availableServices = (business?.employees?.find((e: any) => e.id === selectedSlot?.employeeId)?.serviceTypes || business?.serviceTypes || []);
  const filteredServices = availableServices
    .filter((s: string) => s.toLowerCase().startsWith(slotServiceSearch.toLowerCase()))
    .sort();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Weitere Kunden benachrichtigen"
      headerClassName="bg-accent"
      footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={onClose}>
            Abbrechen
          </Button>
          <Button 
            className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
            onClick={handleNotifyAction}
            disabled={isSubmitting || additionalClients.length === 0}
          >
            {isSubmitting ? "Wird gesendet..." : "Jetzt benachrichtigen"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg text-sm font-medium border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}
        <div className="mb-6">
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium text-deep-blue dark:text-white">
            {selectedSlot?.employeeName || "Kein Mitarbeiter ausgewählt"}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistungen</label>
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
                    checked={additionalServiceType.split(', ').includes(service)}
                    onChange={() => {
                      const services = additionalServiceType ? additionalServiceType.split(', ').filter(Boolean) : [];
                      if (services.includes(service)) {
                        setAdditionalServiceType(services.filter(s => s !== service).join(', '));
                      } else {
                        setAdditionalServiceType([...services, service].join(', '));
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
                    checked={isCustomNotifyService}
                    onChange={() => setIsCustomNotifyService(!isCustomNotifyService)}
                    className="accent-accent"
                  />
                  <span>Individuell...</span>
                </label>
            </div>
          </div>
          {isCustomNotifyService && (
            <CustomServicesList 
              list={customNotifyServices}
              onAdd={(s) => setCustomNotifyServices([...customNotifyServices, s])}
              onRemove={(i) => setCustomNotifyServices(customNotifyServices.filter((_, idx) => idx !== i))}
              onEdit={(i, v) => {
                const newList = [...customNotifyServices];
                newList[i] = v;
                setCustomNotifyServices(newList);
              }}
            />
          )}
        </div>

        <div className="space-y-3">
          <Input 
            placeholder="Kunden suchen..." 
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">
              Verfügbare Kunden ({availableClients.length})
            </label>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const priorityIds = clientsWithPriority.filter(c => c.isPriority).map(c => c.id);
                  setAdditionalClients(prev => {
                    const allSelected = priorityIds.every(id => prev.includes(id));
                    if (allSelected) return prev.filter(id => !priorityIds.includes(id));
                    return Array.from(new Set([...prev, ...priorityIds]));
                  });
                }}
                className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                Priorisierte wählen
              </button>
              <button 
                onClick={() => {
                  setAdditionalClients(additionalClients.length === availableClients.length ? [] : availableClients.map(c => c.id));
                }}
                className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline border-l border-gray-200 dark:border-slate-700 pl-2"
              >
                {additionalClients.length === availableClients.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
            {filtered.map(client => (
              <div 
                key={client.id}
                onClick={() => setAdditionalClients(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${additionalClients.includes(client.id) ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${additionalClients.includes(client.id) ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                  {additionalClients.includes(client.id) && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                    {client.isPriority && (
                      <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-bold uppercase tracking-tight">Priorität</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
