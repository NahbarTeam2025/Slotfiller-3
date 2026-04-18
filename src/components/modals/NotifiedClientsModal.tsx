import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { Users, Calendar as CalendarIcon, Clock, Plus } from "lucide-react";
import { useState } from "react";

interface NotifiedClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slots: any[];
  clients: any[];
  onNotifyMore: (slot: any) => void;
}

export function NotifiedClientsModal({ isOpen, onClose, slots, clients, onNotifyMore }: NotifiedClientsModalProps) {
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  const filteredSlots = slots
    .filter(s => s.status === 'open' && s.notifiedClients && s.notifiedClients.length > 0)
    .filter(s => !filterEmployee || s.employeeName?.toLowerCase().includes(filterEmployee.toLowerCase()))
    .filter(s => !filterClient || s.notifiedClients.some((clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client?.name.toLowerCase().includes(filterClient.toLowerCase());
    }))
    .filter(s => !filterDate || s.date === filterDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Gemeldete Termine"
      headerClassName="bg-orange-500 text-white"
      footer={selectedSlot ? (
        <Button 
          className="w-full bg-accent text-white hover:bg-accent-hover font-bold"
          onClick={() => {
            onNotifyMore(selectedSlot);
            onClose();
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Weitere Kunden benachrichtigen
        </Button>
      ) : null}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Users className="h-4 w-4" />
            </span>
            <Input 
              placeholder="Mitarbeiter..." 
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="h-10 text-sm pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Users className="h-4 w-4" />
            </span>
            <Input 
              placeholder="Kunde..." 
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="h-10 text-sm pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          <div>
            <Input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-10 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
          {filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
              <p className="font-bold text-gray-900 dark:text-white mb-1">Keine gemeldeten Termine</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Passe deine Filter an oder melde neue freie Slots.</p>
            </div>
          ) : (
            filteredSlots.map((slot) => (
              <div 
                key={slot.id} 
                onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
                className={`group relative bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                  selectedSlot?.id === slot.id 
                    ? 'border-orange-500 ring-1 ring-orange-500' 
                    : 'border-gray-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-900/50'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-3 items-start">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-deep-blue dark:text-white leading-tight mb-0.5">
                        {slot.serviceType}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {format(new Date(slot.date), 'dd.MM.yyyy')}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {slot.time} Uhr
                        </span>
                        {slot.employeeName && (
                          <span className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {slot.employeeName}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5 flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          Benachrichtigte Kunden ({slot.notifiedClients?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {slot.notifiedClients?.map((clientId: string) => {
                            const client = clients.find(c => c.id === clientId);
                            return (
                              <span key={clientId} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                                {client ? client.name : clientId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>

  );
}
