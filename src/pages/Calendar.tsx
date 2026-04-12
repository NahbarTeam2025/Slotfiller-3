import { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, where, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { Calendar as CalendarIcon, Plus, CheckCircle, ChevronLeft, ChevronRight, Clock, Trash2, AlertTriangle, Users } from "lucide-react";
import Holidays from "date-holidays";

export function Calendar() {
  const { businessId } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFreeSlotModalOpen, setIsFreeSlotModalOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem("calendar_currentMonth");
    return saved ? new Date(saved) : new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem("calendar_selectedDate");
    return saved ? new Date(saved) : new Date();
  });

  useEffect(() => {
    localStorage.setItem("calendar_currentMonth", currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    localStorage.setItem("calendar_selectedDate", selectedDate.toISOString());
  }, [selectedDate]);

  // Modal State (Booked Slot)
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotService, setNewSlotService] = useState("");
  const [newSlotEmployee, setNewSlotEmployee] = useState("");
  const [clientName, setClientName] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State (Free Slot)
  const [matchingClients, setMatchingClients] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [notificationResult, setNotificationResult] = useState<{ success: boolean, notified: number } | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [newSlotServices, setNewSlotServices] = useState<string[]>([]);

  const [isNotifiedClientsModalOpen, setIsNotifiedClientsModalOpen] = useState(false);
  const [selectedOpenSlot, setSelectedOpenSlot] = useState<any>(null);
  const [isNotifyMoreModalOpen, setIsNotifyMoreModalOpen] = useState(false);
  const [additionalClients, setAdditionalClients] = useState<string[]>([]);
  const [additionalServiceType, setAdditionalServiceType] = useState<string>("");
  const [additionalEmployeeId, setAdditionalEmployeeId] = useState<string>("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);
  const [isManualBooking, setIsManualBooking] = useState(false);
  const [slotToManuallyBook, setSlotToManuallyBook] = useState<any>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
        if (data.serviceTypes?.length > 0 && !newSlotService) {
          setNewSlotService(data.serviceTypes[0]);
        }
        if (data.employees?.length > 0 && !newSlotEmployee) {
          setNewSlotEmployee(data.employees[0].id);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `businesses/${businessId}`);
    });

    const q = query(
      collection(db, `businesses/${businessId}/slots`)
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      slotsData.sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date); // ascending date
      });
      setSlots(slotsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/slots`);
    });

    const unsubClients = onSnapshot(collection(db, `businesses/${businessId}/clients`), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
      setAllClients(clientsData.filter((c: any) => c.active));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/clients`);
    });

    return () => {
      unsubBusiness();
      unsubSlots();
      unsubClients();
    };
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !isFreeSlotModalOpen) return;

    const fetchMatchingClients = async () => {
      import("firebase/firestore").then(async ({ getDocs }) => {
        let q = query(
          collection(db, `businesses/${businessId}/clients`),
          where("active", "==", true)
        );
        
        const snapshot = await getDocs(q);
        const allActiveClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = new Date();
        const localNowString = `${format(now, 'yyyy-MM-dd')}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const futureBookedClients = slots
          .filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString)
          .map(s => s.bookedBy);

        const filteredClients = allActiveClients.filter((client: any) => {
          const matchesService = newSlotServices.length === 0 || 
            client.serviceTypes?.some((s: string) => newSlotServices.includes(s));
          const isNotBooked = !futureBookedClients.includes(client.name);
          return matchesService && isNotBooked;
        });

        setMatchingClients(filteredClients);
      });
    };

    fetchMatchingClients();
  }, [businessId, newSlotServices, isFreeSlotModalOpen, slots]);

  const handleCreateBookedSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime || !newSlotService || !clientName) return;
    setIsSubmitting(true);

    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;

    try {
      if (isManualBooking && slotToManuallyBook) {
        // Update existing slot
        await updateDoc(doc(db, `businesses/${businessId}/slots`, slotToManuallyBook.id), {
          status: "booked",
          bookedBy: clientName,
          bookedAt: new Date().toISOString()
        });

        // Send SMS to notified clients
        try {
          await fetch("https://slotfiller-sms.nahbar.workers.dev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              notifiedClients: slotToManuallyBook.notifiedClients || [],
              businessName: business?.name || "Ihr Unternehmen"
            })
          });
        } catch (workerErr) {
          console.error("Error calling SMS worker", workerErr);
          setWorkerError("Fehler beim Senden der SMS. Bitte prüfen Sie die Worker-Konfiguration.");
        }
      } else {
        // Create new booked slot
        await addDoc(collection(db, `businesses/${businessId}/slots`), {
          date: newSlotDate,
          time: newSlotTime,
          serviceType: newSlotService,
          employeeId: newSlotEmployee || null,
          employeeName: employee?.name || "",
          status: "booked",
          notifiedClients: [],
          bookedBy: clientName,
          bookedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // Delete old future appointments for this client
      const nowString = format(new Date(), 'yyyy-MM-dd');
      const existingAppointments = slots.filter(s => 
        s.status === 'booked' && 
        s.bookedBy === clientName && 
        s.date >= nowString &&
        !(s.date === newSlotDate && s.time === newSlotTime)
      );

      for (const oldSlot of existingAppointments) {
        await deleteDoc(doc(db, `businesses/${businessId}/slots`, oldSlot.id));
      }

      setIsModalOpen(false);
      setClientName("");
      setIsManualBooking(false);
      setSlotToManuallyBook(null);
    } catch (error) {
      console.error("Error creating booked slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFreeSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime || newSlotServices.length === 0) return;
    setIsSubmitting(true);

    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    
    let serviceTypeString = "";
    if (newSlotServices && newSlotServices.length > 0) {
      serviceTypeString = newSlotServices.join(", ");
    }
    if (employee) {
      serviceTypeString += serviceTypeString ? ` bei ${employee.name}` : `Bei ${employee.name}`;
    }

    try {
      const docRef = await addDoc(collection(db, `businesses/${businessId}/slots`), {
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

      // Trigger SMS Notification via Cloudflare Worker
      try {
        const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            slotId: docRef.id,
            date: newSlotDate,
            time: newSlotTime,
            serviceType: serviceTypeString,
            manualClients: selectedClients
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          setNotificationResult(result);
          setTimeout(() => setNotificationResult(null), 5000);
        }
      } catch (workerErr) {
        console.error("Error calling worker", workerErr);
        setWorkerError("Fehler beim Benachrichtigen der Kunden. Bitte prüfen Sie die Worker-Konfiguration.");
      }

      setIsFreeSlotModalOpen(false);
    } catch (error) {
      console.error("Error creating free slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifyMoreClients = async () => {
    if (!businessId || !selectedOpenSlot || additionalClients.length === 0) return;
    setIsSubmitting(true);

    const employee = additionalEmployeeId ? business?.employees?.find((e: any) => e.id === additionalEmployeeId) : null;
    
    let serviceTypeString = "";
    if (additionalServiceType) {
      serviceTypeString = additionalServiceType;
    }
    if (employee) {
      serviceTypeString += serviceTypeString ? ` bei ${employee.name}` : `Bei ${employee.name}`;
    }

    try {
      const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          slotId: selectedOpenSlot.id,
          date: selectedOpenSlot.date,
          time: selectedOpenSlot.time,
          serviceType: serviceTypeString,
          manualClients: additionalClients
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setNotificationResult(result);
        setTimeout(() => setNotificationResult(null), 5000);
        
        const updatedNotifiedClients = [...(selectedOpenSlot.notifiedClients || []), ...additionalClients];
        await updateDoc(doc(db, `businesses/${businessId}/slots`, selectedOpenSlot.id), {
          notifiedClients: updatedNotifiedClients,
          serviceType: serviceTypeString,
          employeeId: additionalEmployeeId || null,
          employeeName: employee?.name || ""
        });
      }
    } catch (workerErr) {
      console.error("Error calling worker", workerErr);
      setWorkerError("Fehler beim Benachrichtigen der Kunden. Bitte prüfen Sie die Worker-Konfiguration.");
    } finally {
      setIsSubmitting(false);
      setIsNotifyMoreModalOpen(false);
    }
  };

  const handleOpenModal = () => {
    setNewSlotDate(format(selectedDate, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleOpenFreeSlotModal = () => {
    setNewSlotDate(format(selectedDate, 'yyyy-MM-dd'));
    setNewSlotServices([]);
    setSelectedClients([]);
    setIsFreeSlotModalOpen(true);
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const confirmDelete = (slot: any) => {
    setSlotToDelete(slot);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSlot = async () => {
    if (!businessId || !slotToDelete) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/slots`, slotToDelete.id));
      setIsDeleteModalOpen(false);
      setSlotToDelete(null);
    } catch (error) {
      console.error("Error deleting slot", error);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onDateClick = (day: Date) => setSelectedDate(day);

  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const monthName = monthNames[currentMonth.getMonth()];
  const year = currentMonth.getFullYear();

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        const dateString = format(cloneDay, 'yyyy-MM-dd');
        const hasSlots = slots.some(s => s.date === dateString);
        const holiday = (hd ? hd.isHoliday(cloneDay) : null) as any;

        days.push(
          <div
            className={`p-2 border cursor-pointer flex flex-col items-center justify-center h-16 transition-all rounded-lg
              ${!isSameMonth(day, monthStart) 
                ? "text-gray-300 bg-gray-50/50 border-transparent" 
                : isSameDay(day, new Date())
                  ? "bg-success-green text-white shadow-md z-10 border-success-green"
                  : holiday
                    ? "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200"
                    : isSameDay(day, selectedDate)
                      ? "bg-indigo-50 dark:bg-slate-800 text-deep-blue dark:text-white"
                      : "text-gray-700 dark:text-gray-300 border-gray-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-800"}
            `}
            key={day.toString()}
            onClick={() => onDateClick(cloneDay)}
          >
            <span className="text-sm font-bold">{formattedDate}</span>
            {holiday && (
              <span className="text-[8px] font-bold uppercase truncate w-full text-center mt-1">
                {Array.isArray(holiday) ? holiday[0].name : holiday.name}
              </span>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7 gap-1" key={day.toString()}>{days}</div>);
      days = [];
    }
    return rows;
  };

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const filteredSlots = slots.filter(slot => slot.date === selectedDateString);
  const bookedSlots = filteredSlots.filter(s => s.status === 'booked');
  const openSlots = filteredSlots.filter(s => s.status === 'open');

  const availableEmployees = business?.employees?.filter((emp: any) => {
    const isAbsent = business?.absences?.some((abs: any) => 
      abs.employeeId === emp.id && 
      abs.startDate <= selectedDateString && 
      abs.endDate >= selectedDateString
    );
    return !isAbsent;
  }) || [];

  const totalCapacity = business?.employees?.length > 0 ? availableEmployees.length : 1;

  const generateTimeSlots = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[selectedDate.getDay()];
    const hours = business?.openingHours?.[dayName] || { open: business?.openTime || "08:00", close: business?.closeTime || "18:00", closed: false };
    
    if (hours.closed) return [];

    const start = hours.open;
    const end = hours.close;
    const generatedSlots = [];
    let [h, m] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const interval = parseInt(business?.slotInterval || "30", 10);
    
    while (h < endH || (h === endH && m <= endM)) {
      generatedSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      m += interval;
      if (m >= 60) {
        h += Math.floor(m / 60);
        m = m % 60;
      }
    }
    
    if (generatedSlots.length > 0 && generatedSlots[generatedSlots.length - 1] === end) {
      generatedSlots.pop();
    }
    return generatedSlots;
  };

  const getCapacityForTime = (time: string, date: string) => {
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(date).getDay()];
    let capacity = 0;
    
    availableEmployees.forEach((emp: any) => {
      const empHours = emp.workingHours?.[dayName];
      if (empHours && !empHours.closed && time >= empHours.open && time < empHours.close) {
        capacity += 1;
      } else if (!emp.workingHours) {
        const bizHours = business?.openingHours?.[dayName];
        if (bizHours && !bizHours.closed && time >= bizHours.open && time < bizHours.close) {
          capacity += 1;
        }
      }
    });
    
    return capacity > 0 ? capacity : (business?.employees?.length > 0 ? 0 : 1);
  };

  const timeSlots = generateTimeSlots();

  const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
  const holiday = (hd ? hd.isHoliday(selectedDate) : null) as any;
  const holidayName = holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Kalender</h1>
        </div>
        
        {workerError && (
          <div className="flex-1 max-w-md bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div className="text-sm font-medium text-red-800 dark:text-red-300">
              {workerError}
            </div>
            <button onClick={() => setWorkerError(null)} className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200">
              <Plus className="h-4 w-4 rotate-45" />
            </button>
          </div>
        )}
        {notificationResult && (
          <div className="flex-1 max-w-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div className="text-sm font-medium text-green-800 dark:text-green-300">
              Erfolg! <span className="font-bold">{notificationResult.notified}</span> Kunden wurden benachrichtigt.
            </div>
            <button onClick={() => setNotificationResult(null)} className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200">
              <Plus className="h-4 w-4 rotate-45" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button onClick={handleOpenModal} className="bg-deep-blue dark:bg-slate-800 text-white hover:bg-gray-800 dark:hover:bg-slate-700 font-bold px-6 shadow-lg shadow-deep-blue/20">
            <Plus className="mr-2 h-5 w-5" /> Termin eintragen
          </Button>
          <Button onClick={handleOpenFreeSlotModal} className="bg-accent text-white hover:bg-accent-hover font-bold px-6 shadow-lg shadow-accent/20 border-none">
            <Clock className="mr-2 h-5 w-5" /> Freien Platz melden
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar View */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-deep-blue dark:text-white">{monthName} {year}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(day => (
                <div key={day} className="text-center text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {renderCalendarDays()}
            </div>
          </div>
        </div>

        {/* Slots List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-deep-blue dark:text-white">
                Termine am {format(selectedDate, 'dd.MM.yyyy')}
              </h3>
              <div className="flex items-center gap-4">
                {totalCapacity === 0 && (
                  <span className="text-xs font-bold tracking-widest text-red-500 uppercase">Keine Mitarbeiter verfügbar</span>
                )}
                <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">{bookedSlots.length} Gebucht • {openSlots.length} Offen</span>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-slate-800 lg:max-h-[600px] lg:overflow-y-auto">
              {holidayName ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                    <CalendarIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-deep-blue dark:text-white">{holidayName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Heute ist ein gesetzlicher Feiertag.</p>
                  </div>
                </div>
              ) : timeSlots.map(time => {
                const timeSlotsData = filteredSlots.filter(s => s.time === time);
                const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
                const capacity = getCapacityForTime(time, selectedDateString);
                const remainingCapacity = capacity - bookedCount;
                const hasOpenSlot = timeSlotsData.some(s => s.status === 'open');
                
                return (
                  <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[70px]">
                    <div className="w-24 py-4 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                      {time}
                    </div>
                    <div className="flex-1 p-2 space-y-2">
                      {timeSlotsData.map(slot => (
                        <div key={slot.id} className={`border rounded-lg p-3 flex justify-between items-center shadow-sm group/card ${slot.status === 'booked' ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20' : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30'}`}>
                          <div>
                            <div className="font-bold text-deep-blue dark:text-white">{slot.status === 'booked' ? slot.bookedBy : 'Kunden benachrichtigt'}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{slot.serviceType} {slot.employeeName ? `• ${slot.employeeName}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {slot.status === 'booked' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" /> Gebucht
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                                onClick={() => {
                                  setSelectedOpenSlot(slot);
                                  setIsNotifiedClientsModalOpen(true);
                                }}
                              >
                                <Clock className="w-3 h-3 mr-1" /> Offen ({slot.notifiedClients?.length || 0})
                              </span>
                            )}
                            {slot.status === 'open' && (
                              <Button 
                                size="sm" 
                                className="bg-accent text-deep-blue hover:bg-accent-hover font-bold text-xs"
                                onClick={() => {
                                  setSlotToManuallyBook(slot);
                                  setIsManualBooking(true);
                                  setNewSlotDate(slot.date);
                                  setNewSlotTime(slot.time);
                                  setNewSlotService(slot.serviceType);
                                  setIsModalOpen(true);
                                }}
                              >
                                Manuell vergeben
                              </Button>
                            )}
                            <button 
                              onClick={() => confirmDelete(slot)}
                              className="text-gray-400 hover:text-red-500 transition-opacity p-1"
                              title={slot.status === 'booked' ? "Termin löschen" : "Meldung zurückziehen"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {remainingCapacity > 0 && (
                        <div className="flex gap-2">
                          <div 
                            className="flex-1 flex items-center px-4 py-2 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors border border-dashed border-gray-200 dark:border-slate-700 group"
                            onClick={() => {
                              setNewSlotTime(time);
                              handleOpenModal();
                            }}
                          >
                            <span className="text-sm font-medium flex items-center text-deep-blue dark:text-white">
                              <Plus className="w-4 h-4 mr-1" /> Termin eintragen
                            </span>
                          </div>
                          <div 
                            className="flex-1 flex items-center px-4 py-2 text-accent hover:bg-accent/5 cursor-pointer rounded-lg transition-colors border border-dashed border-accent/30 hover:border-accent group"
                            onClick={() => {
                              setNewSlotTime(time);
                              handleOpenFreeSlotModal();
                            }}
                          >
                            <span className="text-sm font-medium flex items-center">
                              <Clock className="w-4 h-4 mr-1" /> Freien Platz melden
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gebuchten Termin eintragen">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Tragen Sie hier einen Termin ein, der bereits fest vergeben ist.</p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Datum</label>
            <Input 
              type="date" 
              value={newSlotDate} 
              onChange={(e) => setNewSlotDate(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Uhrzeit</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
              >
                {generateTimeSlots().map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newSlotEmployee}
                onChange={(e) => setNewSlotEmployee(e.target.value)}
              >
                <option value="">Kein Mitarbeiter ausgewählt</option>
                {business?.employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Service-Typ</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newSlotService}
                onChange={(e) => setNewSlotService(e.target.value)}
              >
                {business?.serviceTypes?.map((service: string) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Name des Kunden</label>
              <Input 
                value={clientName} 
                onChange={(e) => {
                  setClientName(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                placeholder="z.B. Anna Schmidt"
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              {showClientDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {clients
                    .filter(c => c.name.toLowerCase().includes(clientName.toLowerCase()))
                    .map(client => (
                    <div 
                      key={client.id} 
                      className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer text-sm text-deep-blue dark:text-white flex justify-between items-center"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur from firing before click
                        setClientName(client.name);
                        setShowClientDropdown(false);
                      }}
                    >
                      <span>{client.name}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{client.phone}</span>
                    </div>
                  ))}
                  {clients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase())).length === 0 && (
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Keine passenden Kunden gefunden</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
              onClick={handleCreateBookedSlot}
              disabled={isSubmitting || !clientName}
            >
              {isSubmitting ? "Wird gespeichert..." : "Termin speichern"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={slotToDelete?.status === 'booked' ? "Termin löschen" : "Meldung zurückziehen"}>
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du dies wirklich {slotToDelete?.status === 'booked' ? "löschen" : "zurückziehen"}?</p>
              <p className="text-sm opacity-90">
                {slotToDelete?.status === 'booked' 
                  ? `Der Termin am ${slotToDelete?.date} um ${slotToDelete?.time} Uhr für ${slotToDelete?.bookedBy} wird unwiderruflich entfernt.`
                  : `Der freie Platz am ${slotToDelete?.date} um ${slotToDelete?.time} Uhr wird entfernt.`
                }
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={handleDeleteSlot}
            >
              {slotToDelete?.status === 'booked' ? "Endgültig löschen" : "Zurückziehen"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isFreeSlotModalOpen} onClose={() => setIsFreeSlotModalOpen(false)} title="Neuer freier Slot">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Melden Sie einen freien Slot, um sofort passende Kunden zu benachrichtigen.</p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Datum</label>
            <Input 
              type="date" 
              value={newSlotDate} 
              onChange={(e) => setNewSlotDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Uhrzeit</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
              >
                {generateTimeSlots().map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Service-Typen</label>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                {business?.serviceTypes?.map((service: string) => (
                  <label key={service} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={newSlotServices.includes(service)}
                      onChange={() => setNewSlotServices(prev => 
                        prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
                      )}
                      className="accent-accent shrink-0"
                    />
                    <span className="truncate">{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              value={newSlotEmployee}
              onChange={(e) => setNewSlotEmployee(e.target.value)}
            >
              <option value="">Kein Mitarbeiter ausgewählt</option>
              {business?.employees?.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <Input 
              placeholder="Kunden suchen..." 
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Passende Kunden ({matchingClients.length})</label>
              <button 
                onClick={() => setSelectedClients(selectedClients.length === matchingClients.length ? [] : matchingClients.map(c => c.id))}
                className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                {selectedClients.length === matchingClients.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {matchingClients
                .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                .map(client => (
                <div 
                  key={client.id}
                  onClick={() => toggleClientSelection(client.id)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${selectedClients.includes(client.id) ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedClients.includes(client.id) ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                    {selectedClients.includes(client.id) && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsFreeSlotModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
              onClick={handleCreateFreeSlot}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wird gesendet..." : "Jetzt benachrichtigen"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isNotifiedClientsModalOpen} onClose={() => setIsNotifiedClientsModalOpen(false)} title="Benachrichtigte Kunden">
        <div className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {!selectedOpenSlot?.notifiedClients || selectedOpenSlot.notifiedClients.length === 0 ? (
              <p className="text-sm text-gray-500">Bisher wurden keine Kunden benachrichtigt.</p>
            ) : (
              selectedOpenSlot.notifiedClients.map((clientId: string, index: number) => {
                const client = clients.find(c => c.id === clientId);
                return (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <p className="font-bold text-deep-blue dark:text-white">{client ? client.name : clientId}</p>
                      {client && <p className="text-xs text-gray-500">{client.phone}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
            <Button 
              className="w-full bg-accent text-white hover:bg-accent-hover font-bold"
              onClick={() => {
                setIsNotifiedClientsModalOpen(false);
                setAdditionalClients([]);
                setClientSearch("");
                setIsNotifyMoreModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Weitere Kunden benachrichtigen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isNotifyMoreModalOpen} onClose={() => setIsNotifyMoreModalOpen(false)} title="Weitere Kunden benachrichtigen">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Dienstleistungen</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                {business?.serviceTypes?.map((service: string) => (
                  <label key={service} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={additionalServiceType.includes(service)}
                      onChange={() => {
                        const services = additionalServiceType ? additionalServiceType.split(', ') : [];
                        if (services.includes(service)) {
                          setAdditionalServiceType(services.filter(s => s !== service).join(', '));
                        } else {
                          setAdditionalServiceType([...services, service].join(', '));
                        }
                      }}
                      className="accent-accent shrink-0"
                    />
                    <span className="truncate">{service}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={additionalEmployeeId}
                onChange={(e) => setAdditionalEmployeeId(e.target.value)}
              >
                <option value="">Kein Mitarbeiter ausgewählt</option>
                {business?.employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <Input 
              placeholder="Kunden suchen..." 
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                Verfügbare Kunden ({allClients
                  .filter(c => !(selectedOpenSlot?.notifiedClients || []).includes(c.id))
                  .filter(c => {
                    if (!additionalServiceType) return true;
                    const selectedServices = additionalServiceType.split(', ').filter(Boolean);
                    if (selectedServices.length === 0) return true;
                    return selectedServices.some(s => c.serviceTypes?.includes(s));
                  }).length})
              </label>
              <button 
                onClick={() => {
                  const available = allClients
                    .filter(c => !(selectedOpenSlot?.notifiedClients || []).includes(c.id))
                    .filter(c => {
                      if (!additionalServiceType) return true;
                      const selectedServices = additionalServiceType.split(', ').filter(Boolean);
                      if (selectedServices.length === 0) return true;
                      return selectedServices.some(s => c.serviceTypes?.includes(s));
                    });
                  setAdditionalClients(additionalClients.length === available.length ? [] : available.map(c => c.id));
                }}
                className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                {additionalClients.length > 0 ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {allClients
                .filter(c => !(selectedOpenSlot?.notifiedClients || []).includes(c.id))
                .filter(c => {
                  if (!additionalServiceType) return true;
                  const selectedServices = additionalServiceType.split(', ').filter(Boolean);
                  if (selectedServices.length === 0) return true;
                  return selectedServices.some(s => c.serviceTypes?.includes(s));
                })
                .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                .map(client => (
                <div 
                  key={client.id}
                  onClick={() => setAdditionalClients(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${additionalClients.includes(client.id) ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${additionalClients.includes(client.id) ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                    {additionalClients.includes(client.id) && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsNotifyMoreModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
              onClick={handleNotifyMoreClients}
              disabled={isSubmitting || additionalClients.length === 0}
            >
              {isSubmitting ? "Wird gesendet..." : "Jetzt benachrichtigen"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Termin löschen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diesen Termin wirklich löschen?</p>
              <p className="text-sm opacity-90">
                Der Termin am {slotToDelete?.date} um {slotToDelete?.time} Uhr für {slotToDelete?.bookedBy} wird unwiderruflich entfernt.
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={handleDeleteSlot}
            >
              Endgültig löschen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
