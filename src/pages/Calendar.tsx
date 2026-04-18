import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, onSnapshot, addDoc, where, getDocs, doc, deleteDoc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { CheckCircle, ChevronLeft, ChevronRight, Clock, Trash2, AlertTriangle, Users, ChevronDown, Edit2, X, XCircle, Filter, LayoutDashboard, Search, Calendar as CalendarIcon, Plus } from "lucide-react";
import Holidays from "date-holidays";
import { BookingModal } from "../components/modals/BookingModal";
import { FreeSlotModal } from "../components/modals/FreeSlotModal";
import { NotifiedClientsModal } from "../components/modals/NotifiedClientsModal";
import { NotificationManagerModal } from "../components/modals/NotificationManagerModal";
import { CancelModal } from "../components/modals/CancelModal";
import { cn } from "../lib/utils";

export function Calendar() {
  const { businessId } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFreeSlotModalOpen, setIsFreeSlotModalOpen] = useState(false);
  const [isNotifiedClientsModalOpen, setIsNotifiedClientsModalOpen] = useState(false);
  const [isNotifyMoreModalOpen, setIsNotifyMoreModalOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [selectedOpenSlot, setSelectedOpenSlot] = useState<any>(null);
  const [notificationResult, setNotificationResult] = useState<{ success: boolean, notified: number } | null>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clients, setClients] = useState<any[]>([]);

  // Modal State (Common)
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [slotToCancel, setSlotToCancel] = useState<any>(null);

  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");

  const dashboardEmployeeFocus = business?.dashboardEmployeeFocus || "all";
  
  const effectiveSlots = useMemo(() => 
    dashboardEmployeeFocus === "all" 
      ? slots 
      : slots.filter(s => s.employeeId === dashboardEmployeeFocus),
    [slots, dashboardEmployeeFocus]
  );

  useEffect(() => {
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/clients`);
    });

    return () => {
      unsubBusiness();
      unsubSlots();
      unsubClients();
    };
  }, [businessId]);

  const handleOpenBookingModal = (date?: Date, time?: string, slot?: any) => {
    setSelectedSlot(slot || null);
    setNewSlotDate(date ? format(date, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'));
    setNewSlotTime(time || "10:00");
    setIsModalOpen(true);
  };

  const handleOpenFreeSlotModal = (date?: Date, time?: string) => {
    setNewSlotDate(date ? format(date, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'));
    setNewSlotTime(time || "10:00");
    setIsFreeSlotModalOpen(true);
  };

  const handleDeleteSlot = async () => {
    if (!businessId || !slotToDelete) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/slots`, slotToDelete.id));
      setIsDeleteModalOpen(false);
      setSlotToDelete(null);
    } catch (error) {
      console.error("Error deleting slot", error);
      setWorkerError("Fehler beim Löschen des Termins.");
    }
  };

  const openEditModal = (slot: any) => {
    setSelectedSlot(slot);
    setNewSlotDate(slot.date);
    setNewSlotTime(slot.time);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (isModalOpen && newSlotTime) {
      setTimeout(() => {
        const element = document.getElementById(`calendar-time-slot-${newSlotTime.replace(':', '-')}`);
        if (element) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isModalOpen, newSlotTime]);

  useEffect(() => {
    if (isFreeSlotModalOpen && newSlotTime) {
      setTimeout(() => {
        const element = document.getElementById(`calendar-free-time-slot-${newSlotTime.replace(':', '-')}`);
        if (element) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isFreeSlotModalOpen, newSlotTime]);

  const confirmDelete = (slot: any) => {
    setSlotToDelete(slot);
    setIsDeleteModalOpen(true);
  };

  const confirmCancel = (slot: any) => {
    setSlotToCancel(slot);
    setIsCancelModalOpen(true);
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
        const hasSlots = effectiveSlots.some(s => s.date === dateString);
        const holiday = (hd ? hd.isHoliday(cloneDay) : null) as any;

        days.push(
          <div
            className={`p-2 border cursor-pointer flex flex-col items-center justify-center h-10 transition-all rounded-lg
              ${!isSameMonth(day, monthStart) 
                ? "text-gray-300 bg-gray-50/50 border-transparent" 
                : isSameDay(day, new Date())
                  ? "bg-success-green text-white shadow-md z-10 border-success-green"
                  : holiday
                    ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    : isSameDay(day, selectedDate)
                      ? "bg-indigo-50 dark:bg-slate-800 text-deep-blue dark:text-white"
                      : "text-gray-700 dark:text-gray-300 border-gray-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-800"}
            `}
            key={day.toString()}
            onClick={() => onDateClick(cloneDay)}
          >
            <span className="text-sm font-bold">{formattedDate}</span>
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
  
  const filteredSlots = useMemo(() => effectiveSlots.filter(slot => slot.date === selectedDateString), [effectiveSlots, selectedDateString]);
  
  const slotsGroupedByTime = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredSlots.forEach(slot => {
      if (!grouped[slot.time]) grouped[slot.time] = [];
      grouped[slot.time].push(slot);
    });
    return grouped;
  }, [filteredSlots]);

  const bookedSlots = useMemo(() => filteredSlots.filter(s => s.status === 'booked'), [filteredSlots]);
  const openSlots = useMemo(() => filteredSlots.filter(s => s.status === 'open'), [filteredSlots]);

  const availableEmployees = useMemo(() => business?.employees?.filter((emp: any) => {
    if (dashboardEmployeeFocus !== "all" && emp.id !== dashboardEmployeeFocus) return false;
    const isAbsent = business?.absences?.some((abs: any) => 
      abs.employeeId === emp.id && 
      abs.startDate <= selectedDateString && 
      abs.endDate >= selectedDateString
    );
    return !isAbsent;
  }) || [], [business?.employees, business?.absences, dashboardEmployeeFocus, selectedDateString]);

  const totalCapacity = business?.employees?.length > 0 ? availableEmployees.length : 1;

  const generateTimeSlots = useCallback(() => {
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
  }, [selectedDate, business?.openingHours, business?.openTime, business?.closeTime, business?.slotInterval]);

  const getCapacityForTime = useCallback((time: string, date: string) => {
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
  }, [availableEmployees, business?.openingHours, business?.employees]);

  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);

  const holidayName = useMemo(() => {
    const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
    const holiday = (hd ? hd.isHoliday(selectedDate) : null) as any;
    return holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;
  }, [business?.federalState, selectedDate]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white flex flex-wrap items-center gap-3">
            Kalender
            {dashboardEmployeeFocus !== "all" && (
              <span className="text-sm font-medium px-3 py-1 bg-accent/10 text-accent rounded-full align-middle whitespace-nowrap">
                Fokus: {business?.employees?.find((e: any) => e.id === dashboardEmployeeFocus)?.name}
              </span>
            )}
          </h1>
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
          <Button onClick={() => handleOpenBookingModal()} className="bg-deep-blue dark:bg-slate-800 text-white hover:bg-gray-800 dark:hover:bg-slate-700 font-bold px-6 shadow-lg shadow-deep-blue/20">
            <Plus className="mr-2 h-5 w-5" /> Termin eintragen
          </Button>
          <Button onClick={() => handleOpenFreeSlotModal()} className="bg-accent text-white hover:bg-accent-hover font-bold px-6 shadow-lg shadow-accent/20 border-none">
            <Clock className="mr-2 h-5 w-5" /> Termin melden
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Calendar View */}
        <div className="w-full">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6">
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
        <div className="w-full">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 dark:bg-slate-800/50">
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
              ) : timeSlots.map((time, idx) => {
                const timeSlotsData = slotsGroupedByTime[time] || [];
                const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
                const capacity = getCapacityForTime(time, selectedDateString);
                const remainingCapacity = capacity - bookedCount;
                const hasOpenSlot = timeSlotsData.some(s => s.status === 'open');
                
                return (
                  <div key={time} className={`flex border-b border-gray-100 dark:border-slate-800 min-h-[70px] ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-slate-900/10' : ''}`}>
                    <div className={`w-16 sm:w-24 shrink-0 py-4 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-slate-800 text-right ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-slate-800/20' : 'bg-gray-100/50 dark:bg-slate-800/40'} flex flex-col justify-center`}>
                      <div className="font-bold">{time}</div>
                      <div className={`text-[10px] mt-1 font-bold ${remainingCapacity > 0 ? 'text-accent' : 'text-red-500'}`}>
                        {remainingCapacity}/{capacity}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 p-2 space-y-2">
                      {timeSlotsData.map(slot => (
                        <div 
                          key={slot.id} 
                          className={`border rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-floating group/card cursor-pointer transition-colors ${
                            slot.status === 'booked' 
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/20' 
                              : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30'
                          }`}
                          onClick={() => slot.status === 'booked' && openEditModal(slot)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-deep-blue dark:text-white text-sm sm:text-base truncate">{slot.status === 'booked' ? slot.bookedBy : 'Kunden benachrichtigt'}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{slot.serviceType} {slot.employeeName ? `• ${slot.employeeName}` : ''}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            {slot.status === 'booked' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" /> Gebucht
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                className="bg-accent text-deep-blue hover:bg-accent-hover font-bold text-xs flex-1 sm:flex-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBookingModal(undefined, slot.time, slot);
                                }}
                              >
                                Manuell vergeben
                              </Button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmCancel(slot);
                              }}
                              className="text-gray-400 hover:text-orange-500 transition-opacity p-1"
                              title="Termin absagen"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(slot);
                              }}
                              className="text-gray-400 hover:text-red-500 transition-opacity p-1"
                              title={slot.status === 'booked' ? "Termin löschen" : "Meldung zurückziehen"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {remainingCapacity > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div 
                            className="flex-1 flex items-center px-4 py-2 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors border border-dashed border-gray-200 dark:border-slate-700 group"
                            onClick={() => {
                              handleOpenBookingModal(undefined, time);
                            }}
                          >
                            <span className="text-sm font-medium flex items-center text-deep-blue dark:text-white">
                              <Plus className="w-4 h-4 mr-1" /> Termin eintragen
                            </span>
                          </div>
                          <div 
                            className="flex-1 flex items-center px-4 py-2 text-accent hover:bg-accent/5 cursor-pointer rounded-lg transition-colors border border-dashed border-accent/30 hover:border-accent group"
                            onClick={() => {
                              handleOpenFreeSlotModal(undefined, time);
                            }}
                          >
                            <span className="text-sm font-medium flex items-center">
                              <Clock className="w-4 h-4 mr-1" /> Termin melden
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

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSlot(null);
        }}
        business={business}
        slots={slots}
        clients={clients}
        businessId={businessId}
        editingSlot={selectedSlot}
        defaultDate={newSlotDate}
        defaultTime={newSlotTime}
        onSuccess={() => {
          setIsModalOpen(false);
          setSelectedSlot(null);
        }}
        getCapacityForTime={getCapacityForTime}
        timeSlots={timeSlots}
      />

      <FreeSlotModal
        isOpen={isFreeSlotModalOpen}
        onClose={() => setIsFreeSlotModalOpen(false)}
        business={business}
        slots={slots}
        clients={clients}
        businessId={businessId || ""}
        defaultDate={newSlotDate}
        defaultTime={newSlotTime}
        onSuccess={(result) => {
          setIsFreeSlotModalOpen(false);
          setNotificationResult(result);
          setTimeout(() => setNotificationResult(null), 5000);
        }}
        getCapacityForTime={getCapacityForTime}
        timeSlots={timeSlots}
      />

      <NotifiedClientsModal
        isOpen={isNotifiedClientsModalOpen}
        onClose={() => setIsNotifiedClientsModalOpen(false)}
        slots={slots}
        clients={clients}
        onNotifyMore={(slot) => {
          setSelectedOpenSlot(slot);
          setIsNotifiedClientsModalOpen(false);
          setIsNotifyMoreModalOpen(true);
        }}
      />

      <NotificationManagerModal
        isOpen={isNotifyMoreModalOpen}
        onClose={() => setIsNotifyMoreModalOpen(false)}
        business={business}
        slots={slots}
        clients={clients}
        businessId={businessId || ""}
        selectedSlot={selectedOpenSlot}
        onSuccess={(result) => {
          setIsNotifyMoreModalOpen(false);
          setNotificationResult(result);
          setTimeout(() => setNotificationResult(null), 5000);
        }}
      />

      <CancelModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setSlotToCancel(null);
        }}
        slot={slotToCancel}
        businessId={businessId}
        onSuccess={() => {
          setIsCancelModalOpen(false);
          setSlotToCancel(null);
        }}
      />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={slotToDelete?.status === 'booked' ? "Termin löschen" : "Meldung zurückziehen"}
        footer={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={handleDeleteSlot}
            >
              {slotToDelete?.status === 'booked' ? "Endgültig löschen" : "Zurückziehen"}
            </Button>
          </div>
        }
      >
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
        </div>
      </Modal>
    </div>
  );
}
