import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, onSnapshot, addDoc, where, getDocs, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { Clock, Plus, Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import Holidays from "date-holidays";

export function FreeSlots() {
  const { businessId } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'time' | 'capacity'>(() => (localStorage.getItem("freeSlots_sortBy") as any) || 'time');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem("freeSlots_currentMonth");
    return saved ? new Date(saved) : new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem("freeSlots_selectedDate");
    return saved ? new Date(saved) : new Date();
  });

  useEffect(() => {
    localStorage.setItem("freeSlots_currentMonth", currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    localStorage.setItem("freeSlots_selectedDate", selectedDate.toISOString());
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem("freeSlots_sortBy", sortBy);
  }, [sortBy]);

  // Modal State
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotService, setNewSlotService] = useState("");
  const [matchingClientsCount, setMatchingClientsCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'ai' | 'manual'>('ai');
  const [allClients, setAllClients] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [notificationResult, setNotificationResult] = useState<{ success: boolean, notified: number } | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
        if (data.serviceTypes?.length > 0 && !newSlotService) {
          setNewSlotService(data.serviceTypes[0]);
        }
      }
    });

    const q = query(
      collection(db, `businesses/${businessId}/slots`)
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort in memory
      slotsData.sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date); // ascending date for open slots
      });
      setSlots(slotsData);
    });

    const unsubClients = onSnapshot(collection(db, `businesses/${businessId}/clients`), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllClients(clientsData.filter((c: any) => c.active !== false));
    });

    return () => {
      unsubBusiness();
      unsubSlots();
      unsubClients();
    };
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !newSlotService || !isModalOpen) return;

    const fetchMatchingClients = async () => {
      const q = query(
        collection(db, `businesses/${businessId}/clients`),
        where("serviceTypes", "array-contains", newSlotService)
      );
      const snapshot = await getDocs(q);
      
      const now = new Date();
      const localNowString = `${format(now, 'yyyy-MM-dd')}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const futureBookedClients = slots
        .filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString)
        .map(s => s.bookedBy);

      const eligibleClients = snapshot.docs.filter(doc => {
        const client = doc.data();
        return client.active !== false && !futureBookedClients.includes(client.name);
      });

      setMatchingClientsCount(eligibleClients.length);
    };

    fetchMatchingClients();
  }, [businessId, newSlotService, isModalOpen]);

  const handleCreateSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime || !newSlotService) return;
    setIsSubmitting(true);

    try {
      const docRef = await addDoc(collection(db, `businesses/${businessId}/slots`), {
        date: newSlotDate,
        time: newSlotTime,
        serviceType: newSlotService,
        status: "open",
        notifiedClients: [],
        bookedBy: null,
        bookedAt: null,
        createdAt: new Date().toISOString()
      });

      // Trigger SMS Notification via Cloudflare Worker
      try {
        const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            slotId: docRef.id,
            date: newSlotDate,
            time: newSlotTime,
            serviceType: newSlotService,
            manualClients: selectionMode === 'manual' ? selectedClients : undefined
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          setNotificationResult(result);
          // Auto-close success message after 5 seconds
          setTimeout(() => setNotificationResult(null), 5000);
        }
      } catch (workerErr) {
        console.error("Error calling worker", workerErr);
        setWorkerError("Der Termin wurde gemeldet, aber die Benachrichtigungen konnten nicht gesendet werden (Netzwerkfehler).");
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    setNewSlotDate(format(selectedDate, 'yyyy-MM-dd'));
    setSelectionMode('ai');
    setSelectedClients([]);
    setIsModalOpen(true);
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
    import("firebase/firestore").then(async ({ deleteDoc, doc }) => {
      if (!businessId || !slotToDelete) return;
      try {
        await deleteDoc(doc(db, `businesses/${businessId}/slots`, slotToDelete.id));
        setIsDeleteModalOpen(false);
        setSlotToDelete(null);
      } catch (error) {
        console.error("Error deleting slot", error);
      }
    });
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

  const selectedDateString = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const todayString = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isToday = selectedDateString === todayString;
  const isPastDay = selectedDateString < todayString;

  const filteredSlots = useMemo(() => slots.filter(slot => slot.date === selectedDateString), [slots, selectedDateString]);

  const availableEmployees = useMemo(() => business?.employees?.filter((emp: any) => {
    const isAbsent = business?.absences?.some((abs: any) => 
      abs.employeeId === emp.id && 
      abs.startDate <= selectedDateString && 
      abs.endDate >= selectedDateString
    );
    return !isAbsent;
  }) || [], [business?.employees, business?.absences, selectedDateString]);

  const totalCapacity = business?.employees?.length > 0 ? availableEmployees.length : 1;

  const generateTimeSlots = useCallback(() => {
    if (totalCapacity === 0) return [];
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[selectedDate.getDay()];
    const hours = business?.openingHours?.[dayName] || { open: business?.openTime || "08:00", close: business?.closeTime || "18:00", closed: false };
    
    if (hours.closed) return [];

    const start = hours.open;
    const end = hours.close;
    const generatedSlots = [];
    let [h, m] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    while (h < endH || (h === endH && m <= endM)) {
      generatedSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      m += 30;
      if (m >= 60) {
        h += 1;
        m -= 60;
      }
    }
    
    if (generatedSlots.length > 0 && generatedSlots[generatedSlots.length - 1] === end) {
      generatedSlots.pop();
    }
    return generatedSlots;
  }, [selectedDate, totalCapacity, business?.openingHours, business?.openTime, business?.closeTime]);

  const timeSlots = useMemo(() => {
    let slots = generateTimeSlots();
    if (isPastDay) {
      return [];
    } else if (isToday) {
      const now = new Date();
      const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      slots = slots.filter(time => time >= currentTimeString);
    }
    return slots;
  }, [generateTimeSlots, isPastDay, isToday]);

  const availableTimeSlots = useMemo(() => {
    return timeSlots.filter(time => {
      const bookedCount = filteredSlots.filter(s => s.status === 'booked' && s.time === time).length;
      return bookedCount < totalCapacity;
    });
  }, [timeSlots, filteredSlots, totalCapacity]);

  const sortedTimeSlots = useMemo(() => {
    return [...availableTimeSlots].sort((a, b) => {
      if (sortBy === 'capacity') {
        const bookedA = filteredSlots.filter(s => s.status === 'booked' && s.time === a).length;
        const bookedB = filteredSlots.filter(s => s.status === 'booked' && s.time === b).length;
        const remainingA = totalCapacity - bookedA;
        const remainingB = totalCapacity - bookedB;
        
        if (remainingA !== remainingB) {
          return remainingB - remainingA;
        }
      }
      return a.localeCompare(b);
    });
  }, [availableTimeSlots, sortBy, filteredSlots, totalCapacity]);

  const freeSlotsCount = useMemo(() => sortedTimeSlots.length, [sortedTimeSlots]);

  const holidayName = useMemo(() => {
    const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
    const holiday = (hd ? hd.isHoliday(selectedDate) : null) as any;
    return holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;
  }, [business?.federalState, selectedDate]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1">Warteliste aktivieren</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Freie Plätze</h1>
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

        <Button 
          onClick={handleOpenModal} 
          className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
        >
          <Plus className="mr-2 h-5 w-5" /> Freien Platz melden
        </Button>
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
                Freie Plätze am {format(selectedDate, 'dd.MM.yyyy')}
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-gray-200 dark:border-slate-700">
                  <button 
                    onClick={() => setSortBy('time')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${sortBy === 'time' ? 'bg-deep-blue dark:bg-accent text-white dark:text-deep-blue shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  >
                    Uhrzeit
                  </button>
                  <button 
                    onClick={() => setSortBy('capacity')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${sortBy === 'capacity' ? 'bg-deep-blue dark:bg-accent text-white dark:text-deep-blue shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  >
                    Verfügbarkeit
                  </button>
                </div>
                {totalCapacity === 0 && (
                  <span className="text-xs font-bold tracking-widest text-red-500 uppercase">Keine Mitarbeiter verfügbar</span>
                )}
                <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">{freeSlotsCount} Plätze</span>
              </div>
            </div>
            <div className="border-t border-gray-100 lg:max-h-[600px] lg:overflow-y-auto">
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
              ) : sortedTimeSlots.map((time, idx) => {
                const openSlot = filteredSlots.find(s => s.status === 'open' && s.time === time);
                const bookedCount = filteredSlots.filter(s => s.status === 'booked' && s.time === time).length;
                const remainingCapacity = totalCapacity - bookedCount;

                if (bookedCount >= totalCapacity) {
                  return null;
                }

                if (openSlot) {
                  return (
                    <div key={time} className={`flex border-b border-gray-100 dark:border-slate-800 min-h-[70px] ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-slate-900/10' : ''}`}>
                      <div className={`w-24 py-4 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-slate-800 text-right ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-slate-800/20' : 'bg-gray-100/50 dark:bg-slate-800/40'}`}>
                        {time}
                      </div>
                      <div className="flex-1 p-2">
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 flex justify-between items-center h-full shadow-sm">
                          <div>
                            <div className="font-bold text-indigo-900 dark:text-indigo-300">Warteliste benachrichtigt</div>
                            <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">{openSlot.serviceType}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                              {openSlot.notifiedClients?.length || 0} benachrichtigt
                            </span>
                            <button 
                              onClick={() => confirmDelete(openSlot)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Meldung zurückziehen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={time} className={`flex border-b border-gray-100 dark:border-slate-800 min-h-[70px] group ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-slate-900/10' : ''}`}>
                    <div className={`w-24 py-4 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-slate-800 text-right ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-slate-800/20' : 'bg-gray-100/50 dark:bg-slate-800/40'}`}>
                      {time}
                    </div>
                    <div className="flex-1 p-2">
                      <div 
                        className="h-full w-full flex items-center justify-between px-4 bg-white dark:bg-slate-900 hover:bg-accent/5 cursor-pointer rounded-lg transition-colors border border-dashed border-gray-200 dark:border-slate-700 hover:border-accent"
                        onClick={() => {
                          setNewSlotTime(time);
                          handleOpenModal();
                        }}
                      >
                        <span className="text-sm font-bold text-accent">Freier Platz</span>
                        <div className="flex items-center gap-3">
                          {remainingCapacity > 1 && (
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              {remainingCapacity} Plätze
                            </span>
                          )}
                          <span className="text-sm font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                            <Users className="w-4 h-4 mr-1" /> Warteliste benachrichtigen
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Neuer freier Slot">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Melden Sie einen Ausfall, um sofort passende Kunden zu benachrichtigen.</p>
        
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
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Benachrichtigungs-Modus</label>
            <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
              <button 
                onClick={() => setSelectionMode('ai')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${selectionMode === 'ai' ? 'bg-white dark:bg-slate-700 text-deep-blue dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                KI Auswahl
              </button>
              <button 
                onClick={() => setSelectionMode('manual')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${selectionMode === 'manual' ? 'bg-white dark:bg-slate-700 text-deep-blue dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Manuelle Auswahl
              </button>
            </div>
          </div>

          {selectionMode === 'ai' ? (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 flex items-center gap-4 border border-indigo-100 dark:border-indigo-800/30">
              <div className="bg-deep-blue dark:bg-slate-800 rounded-lg p-3 text-accent">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-deep-blue dark:text-white">{matchingClientsCount} passende Kunden</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">werden automatisch per KI ausgewählt</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input 
                placeholder="Kunden suchen..." 
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Kunden auswählen ({selectedClients.length})</label>
                <button 
                  onClick={() => {
                    const available = allClients
                      .filter(c => !newSlotService || c.serviceTypes?.includes(newSlotService))
                      .filter(c => 
                        c.name.toLowerCase().startsWith(clientSearch.toLowerCase()) || 
                        c.phone?.toLowerCase().startsWith(clientSearch.toLowerCase())
                      );
                    setSelectedClients(selectedClients.length === available.length ? [] : available.map(c => c.id));
                  }}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
                >
                  {selectedClients.length > 0 ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
                {allClients
                  .filter(c => !newSlotService || c.serviceTypes?.includes(newSlotService))
                  .filter(c => 
                    c.name.toLowerCase().startsWith(clientSearch.toLowerCase()) || 
                    c.phone?.toLowerCase().startsWith(clientSearch.toLowerCase())
                  )
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
                    <div className="flex gap-1">
                      {client.serviceTypes?.slice(0, 1).map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-[8px] font-bold uppercase rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold" 
              onClick={handleCreateSlot}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wird gesendet..." : "Jetzt benachrichtigen"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Meldung zurückziehen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diese Meldung wirklich zurückziehen?</p>
              <p className="text-sm opacity-90">
                Der freie Platz am {slotToDelete?.date} um {slotToDelete?.time} Uhr wird entfernt.
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold" 
              onClick={handleDeleteSlot}
            >
              Zurückziehen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
