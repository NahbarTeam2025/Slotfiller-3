import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, orderBy, limit, onSnapshot, addDoc, where, getDocs, doc, deleteDoc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { StatCard } from "../components/ui/stat-card";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, CheckCircle, Users, Plus, MoreVertical, Edit2, Trash2, AlertTriangle, Calendar as CalendarIcon, Clock, ChevronDown, X, XCircle } from "lucide-react";
import Holidays from "date-holidays";

import { Skeleton } from "../components/ui/skeleton";
import { BookingModal } from "../components/modals/BookingModal";
import { NotifiedClientsModal } from "../components/modals/NotifiedClientsModal";
import { CancelModal } from "../components/modals/CancelModal";
import { NotificationManagerModal } from "../components/modals/NotificationManagerModal";
import { FreeSlotModal } from "../components/modals/FreeSlotModal";

export function Dashboard() {
  const { businessId } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);

  // Modal State
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);
  const [slotToCancel, setSlotToCancel] = useState<any>(null);
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");

  const [isNotifiedClientsModalOpen, setIsNotifiedClientsModalOpen] = useState(false);
  const [selectedOpenSlot, setSelectedOpenSlot] = useState<any>(null);
  const [isNotifyMoreModalOpen, setIsNotifyMoreModalOpen] = useState(false);
  const [notificationResult, setNotificationResult] = useState<{ success: boolean, notified: number } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCreateFreeSlotModalOpen, setIsCreateFreeSlotModalOpen] = useState(false);
  const [isFreeSlotsModalOpen, setIsFreeSlotsModalOpen] = useState(false);
  const [isBookedSlotsModalOpen, setIsBookedSlotsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [notifiedFilterEmployee, setNotifiedFilterEmployee] = useState("");
  const [notifiedFilterClient, setNotifiedFilterClient] = useState("");
  const [notifiedFilterDate, setNotifiedFilterDate] = useState("");
  const [slotToManuallyBook, setSlotToManuallyBook] = useState<any>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        setBusiness(docSnap.data());
      }
      setIsLoading(false);
    });

    const q = query(
      collection(db, `businesses/${businessId}/slots`),
      orderBy("time", "asc")
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSlots(slotsData);
    });

    const unsubClients = onSnapshot(collection(db, `businesses/${businessId}/clients`), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
    });

    return () => {
      unsubBusiness();
      unsubSlots();
      unsubClients();
    };
  }, [businessId]);

  const openEditModal = (slot: any) => {
    setEditingSlotId(slot.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const confirmDelete = (slot: any) => {
    setSlotToDelete(slot);
    setIsDeleteModalOpen(true);
  };

  const confirmCancel = (slot: any) => {
    setSlotToCancel(slot);
    setIsCancelModalOpen(true);
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

  const dashboardEmployeeFocus = business?.dashboardEmployeeFocus || "all";
  
  const todayString = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  
  const effectiveSlots = useMemo(() => 
    dashboardEmployeeFocus === "all" 
      ? slots 
      : slots.filter(s => s.employeeId === dashboardEmployeeFocus),
    [slots, dashboardEmployeeFocus]
  );

  const slotsToday = useMemo(() => effectiveSlots.filter(s => s.date === todayString), [effectiveSlots, todayString]);
  const bookedSlotsToday = useMemo(() => slotsToday.filter(s => s.status === 'booked'), [slotsToday]);
  
  // Group slots by time for faster lookups in the timeline
  const slotsGroupedByTime = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    slotsToday.forEach(slot => {
      if (!grouped[slot.time]) grouped[slot.time] = [];
      grouped[slot.time].push(slot);
    });
    return grouped;
  }, [slotsToday]);

  const availableEmployees = useMemo(() => business?.employees?.filter((emp: any) => {
    if (dashboardEmployeeFocus !== "all" && emp.id !== dashboardEmployeeFocus) return false;
    const isAbsent = business?.absences?.some((abs: any) => 
      abs.employeeId === emp.id && 
      abs.startDate <= todayString && 
      abs.endDate >= todayString
    );
    return !isAbsent;
  }) || [], [business?.employees, business?.absences, dashboardEmployeeFocus, todayString]);

  const totalCapacity = business?.employees?.length > 0 ? availableEmployees.length : 1;

  const generateTimeSlots = useCallback(() => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[new Date().getDay()];
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
  }, [business?.openingHours, business?.openTime, business?.closeTime, business?.slotInterval]);

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
  
  const now = new Date();
  const currentTimeString = useMemo(() => {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
  }, []);

  const currentHourString = useMemo(() => {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, '0')}:00`;
  }, []);

  const futureTimeSlots = useMemo(() => timeSlots.filter(time => time >= currentTimeString), [timeSlots, currentTimeString]);
  const futureBookedSlotsToday = useMemo(() => bookedSlotsToday.filter(s => s.time >= currentTimeString), [bookedSlotsToday, currentTimeString]);
  
  const openSlotsCount = useMemo(() => {
    let count = 0;
    futureTimeSlots.forEach(time => {
      const bookedCount = futureBookedSlotsToday.filter(s => s.time === time).length;
      const capacity = getCapacityForTime(time, todayString);
      if (bookedCount < capacity) {
        count += (capacity - bookedCount);
      }
    });
    return count;
  }, [futureTimeSlots, futureBookedSlotsToday, getCapacityForTime, todayString]);

  const timelineSlots = useMemo(() => timeSlots.filter(time => time >= currentHourString), [timeSlots, currentHourString]);
  
  const holidayName = useMemo(() => {
    const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
    const holiday = (hd ? hd.isHoliday(new Date()) : null) as any;
    return holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;
  }, [business?.federalState]);

  const reportedSlots = useMemo(() => effectiveSlots.filter(s => s.status === 'open' && s.notifiedClients?.length > 0), [effectiveSlots]);

  const filteredReportedSlots = useMemo(() => {
    return reportedSlots.filter(s => {
      const matchesEmployee = !notifiedFilterEmployee || s.employeeName?.toLowerCase().includes(notifiedFilterEmployee.toLowerCase());
      const matchesClient = !notifiedFilterClient || s.notifiedClients?.some((clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        return client?.name.toLowerCase().includes(notifiedFilterClient.toLowerCase());
      });
      const matchesDate = !notifiedFilterDate || s.date === notifiedFilterDate;
      return matchesEmployee && matchesClient && matchesDate;
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, [reportedSlots, notifiedFilterEmployee, notifiedFilterClient, notifiedFilterDate, clients]);

  const totalReportedSlotsCount = useMemo(() => reportedSlots.length, [reportedSlots]);

  const reportedSlotsToday = useMemo(() => slotsToday.filter(s => s.status === 'open' && s.notifiedClients?.length > 0), [slotsToday]);

  const openNotifiedClientsModalForSlot = (slot: any) => {
    setSelectedOpenSlot(slot);
    setIsNotifiedClientsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto lg:h-full lg:flex lg:flex-col lg:overflow-hidden overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white flex items-center gap-3">
            Übersicht
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
          </div>
        )}
        <Button 
          onClick={() => {
            setIsModalOpen(true);
          }} 
          className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
        >
          <Plus className="mr-2 h-5 w-5" /> Termin eintragen
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 shrink-0">
        {isLoading ? (
          <>
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
          </>
        ) : (
          <>
            <div onClick={() => setIsFreeSlotsModalOpen(true)} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
              <StatCard 
                title="Freie Plätze heute" 
                value={openSlotsCount.toString().padStart(2, '0')} 
                icon={<Calendar className="h-5 w-5" />}
                className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 h-full"
                valueClassName="text-indigo-900 dark:text-indigo-300 leading-none"
              />
            </div>
            <div onClick={() => setIsBookedSlotsModalOpen(true)} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
              <StatCard 
                title="Termine heute" 
                value={futureBookedSlotsToday.length.toString().padStart(2, '0')} 
                icon={<CheckCircle className="h-5 w-5 text-accent" />}
                className="bg-white dark:bg-slate-900 border-accent/20 h-full"
                valueClassName="text-deep-blue dark:text-white leading-none"
              />
            </div>
            <div className="cursor-pointer transition-transform hover:scale-[1.02] h-full" onClick={() => {
              setNotifiedFilterEmployee("");
              setNotifiedFilterClient("");
              setNotifiedFilterDate("");
              setIsNotifiedClientsModalOpen(true);
            }}>
              <StatCard 
                title="Gemeldete Termine" 
                value={totalReportedSlotsCount.toString().padStart(2, '0')} 
                icon={<Clock className="h-5 w-5 text-orange-500" />}
                className="bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20 h-full"
                valueClassName="text-orange-900 dark:text-orange-300 leading-none"
              />
            </div>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="text-lg font-bold text-deep-blue dark:text-white">Heutiger Zeitplan</h3>
          <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase whitespace-nowrap">{format(new Date(), 'dd.MM.yyyy')}</span>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : holidayName ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <CalendarIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-deep-blue dark:text-white">{holidayName}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Heute ist ein gesetzlicher Feiertag.</p>
              </div>
            </div>
          ) : timelineSlots.map((time, idx) => {
            const timeSlotsData = slotsGroupedByTime[time] || [];
            const bookedSlots = timeSlotsData.filter(s => s.status === 'booked');
            const openSlots = timeSlotsData.filter(s => s.status === 'open');
            const capacity = getCapacityForTime(time, todayString);
            const remainingCapacity = capacity - bookedSlots.length;
            
            return (
              <div key={time} className={`flex border-b border-gray-100 dark:border-slate-800 min-h-[60px] ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-slate-900/10' : ''}`}>
                <div className={`w-20 py-3 px-4 flex flex-col items-end border-r border-gray-100 dark:border-slate-800 ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-slate-800/20' : 'bg-gray-100/50 dark:bg-slate-800/40'}`}>
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{time}</span>
                  <span className={`text-[10px] font-bold mt-1 ${remainingCapacity > 0 ? 'text-accent' : 'text-red-500'}`}>
                    {remainingCapacity}/{capacity}
                  </span>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {bookedSlots.map(slot => (
                    <div 
                      key={slot.id} 
                      className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm group/card cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
                      onClick={() => openEditModal(slot)}
                    >
                      <div>
                        <div className="font-bold text-deep-blue dark:text-white text-sm">{slot.bookedBy}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{slot.serviceType} {slot.employeeName ? `• ${slot.employeeName}` : ''}</div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" /> Gebucht
                        </span>
                        <div className="flex items-center gap-1 sm:opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(slot);
                            }}
                            className="text-gray-400 hover:text-accent p-1"
                            title="Termin bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmCancel(slot);
                            }}
                            className="text-gray-400 hover:text-orange-500 p-1"
                            title="Termin absagen"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(slot);
                            }}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Termin löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {openSlots.map(slot => (
                    <div key={slot.id} className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-sm group/card">
                      <div className="cursor-pointer flex-1" onClick={() => openNotifiedClientsModalForSlot(slot)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">Kunden benachrichtigt</div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400">
                            <Clock className="w-3 h-3 mr-1" /> Offen ({slot.notifiedClients?.length || 0})
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">{slot.serviceType}</div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                        <Button 
                          size="sm" 
                          className="bg-accent text-deep-blue hover:bg-accent-hover font-bold text-xs flex-1 sm:flex-none"
                          onClick={() => {
                            setSlotToManuallyBook(slot);
                            setNewSlotDate(slot.date);
                            setNewSlotTime(slot.time);
                            setIsModalOpen(true);
                          }}
                        >
                          Manuell vergeben
                        </Button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(slot);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-opacity p-1"
                          title="Meldung zurückziehen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {remainingCapacity > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                      <div 
                        className="flex-1 flex items-center px-3 py-2 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors border border-dashed border-gray-200 dark:border-slate-700"
                        onClick={() => {
                          setNewSlotTime(time);
                          setIsModalOpen(true);
                        }}
                      >
                        <span className="text-xs font-bold flex items-center text-deep-blue dark:text-white">
                          <Plus className="w-3 h-3 mr-1" /> Termin eintragen
                        </span>
                      </div>
                      <div 
                        className="flex-1 flex items-center px-3 py-2 text-accent hover:bg-accent/5 cursor-pointer rounded-lg transition-colors border border-dashed border-accent/30 hover:border-accent"
                        onClick={() => {
                          setNewSlotTime(time);
                          setIsCreateFreeSlotModalOpen(true);
                        }}
                      >
                        <span className="text-xs font-bold flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> Termin melden
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

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setIsEditMode(false);
          setEditingSlotId(null);
        }}
        business={business}
        slots={slots}
        clients={clients}
        businessId={businessId}
        editingSlot={isEditMode ? slots.find(s => s.id === editingSlotId) : null}
        defaultDate={newSlotDate}
        defaultTime={newSlotTime}
        onSuccess={() => {}}
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
      <FreeSlotModal 
        isOpen={isCreateFreeSlotModalOpen}
        onClose={() => setIsCreateFreeSlotModalOpen(false)}
        business={business}
        slots={slots}
        clients={clients}
        businessId={businessId}
        defaultTime={newSlotTime}
        defaultDate={newSlotDate}
        getCapacityForTime={getCapacityForTime}
        timeSlots={timeSlots}
        onSuccess={(res) => {
          setNotificationResult(res);
          setTimeout(() => setNotificationResult(null), 5000);
        }}
      />

      <Modal 
        isOpen={isFreeSlotsModalOpen} 
        onClose={() => setIsFreeSlotsModalOpen(false)} 
        title="Freie Plätze heute"
        headerClassName="bg-accent"
      >
        <div className="space-y-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
            {reportedSlotsToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">Keine freien Plätze heute</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Melde neue freie Slots, um Kunden zu benachrichtigen.</p>
              </div>
            ) : (
              reportedSlotsToday.map((slot) => (
                <div key={slot.id} className="group relative bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
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
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isBookedSlotsModalOpen} 
        onClose={() => setIsBookedSlotsModalOpen(false)} 
        title="Termine heute"
        headerClassName="bg-accent"
      >
        <div className="space-y-4">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin">
            {futureTimeSlots.map(time => {
              const bookedSlots = slotsToday.filter(s => s.time === time && s.status === 'booked');
              if (bookedSlots.length === 0) return null;

              return (
                <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[60px]">
                  <div className="w-20 py-3 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                    {time}
                  </div>
                  <div className="flex-1 p-2 space-y-2">
                    {bookedSlots.map(slot => (
                      <div key={slot.id} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm">
                        <div>
                          <div className="font-bold text-deep-blue dark:text-white text-sm">{slot.bookedBy}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{slot.serviceType} {slot.employeeName ? `• ${slot.employeeName}` : ''}</div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" /> Gebucht
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <CancelModal 
        isOpen={isCancelModalOpen} 
        onClose={() => setIsCancelModalOpen(false)}
        slot={slotToCancel}
        businessId={businessId}
        onSuccess={() => {}}
      />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Termin löschen" footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
          <Button 
            className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
            onClick={handleDeleteSlot}
          >
            Endgültig löschen
          </Button>
        </div>
      }>
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diesen Termin wirklich löschen?</p>
              <p className="text-sm opacity-90">
                Der Termin am {slotToDelete?.date ? format(new Date(slotToDelete.date), 'dd.MM.yyyy') : ''} um {slotToDelete?.time} Uhr für {slotToDelete?.bookedBy} wird unwiderruflich entfernt.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
