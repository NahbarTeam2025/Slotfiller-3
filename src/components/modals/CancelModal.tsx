import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { AlertTriangle, Clock, Users, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any;
  businessId: string | null;
  onSuccess: () => void;
}

export function CancelModal({ isOpen, onClose, slot, businessId, onSuccess }: CancelModalProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!businessId || !slot) return;
    setIsCancelling(true);

    try {
      const slotRef = doc(db, `businesses/${businessId}/slots`, slot.id);
      await updateDoc(slotRef, {
        status: 'open',
        bookedBy: null,
        bookedAt: null,
        serviceType: slot.serviceType || "Allgemein",
        updatedAt: new Date().toISOString()
      });

      // Notify customer if phone exists
      const clientPhone = slot.clientPhone; // This might need to be passed or fetched
      if (clientPhone) {
        try {
          // Trigger SMS (Logic from Dashboard)
          const message = `Hallo! Dein Termin am ${format(new Date(slot.date), 'dd.MM.yyyy')} um ${slot.time} Uhr wurde abgesagt. Viele Grüße, ${slot.businessName || 'dein Team'}.`;
          
          await fetch('https://slotfiller-sms.nahbar.workers.dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: clientPhone,
              message,
              businessId: businessId
            })
          });
        } catch (smsError) {
          console.error("Error sending cancellation SMS", smsError);
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error cancelling appointment", error);
      alert("Fehler beim Absagen des Termins.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (!slot) return null;

  const footer = (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={onClose} disabled={isCancelling}>
        Zurück
      </Button>
      <Button 
        className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold" 
        onClick={handleCancel}
        disabled={isCancelling}
      >
        {isCancelling ? "Wird abgesagt..." : "Termin jetzt absagen"}
      </Button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Termin absagen"
      headerClassName="bg-red-600 text-white"
      footer={footer}
    >
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Bist du dir sicher?</p>
            <p className="text-sm opacity-90">
              Der Termin wird abgesagt und wieder als "Offen" für andere Kunden markiert. Der Kunde wird automatisch per SMS benachrichtigt (falls eine Nummer vorhanden ist).
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
           <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-deep-blue dark:text-white">{slot.serviceType}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Termin Details</p>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Datum & Zeit</p>
                <div className="flex items-center gap-2 text-sm font-medium text-deep-blue dark:text-white">
                  <CalendarIcon className="h-3.5 w-3.5 text-accent" />
                  {format(new Date(slot.date), 'dd.MM.yyyy')} - {slot.time} Uhr
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Kunde</p>
                <div className="flex items-center gap-2 text-sm font-medium text-deep-blue dark:text-white">
                  <Users className="h-3.5 w-3.5 text-accent" />
                  {slot.bookedBy}
                </div>
              </div>
           </div>
        </div>
      </div>
    </Modal>
  );
}
