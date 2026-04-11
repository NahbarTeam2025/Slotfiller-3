import { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, where, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { Calendar as CalendarIcon, Plus, CheckCircle, ChevronLeft, ChevronRight, Clock, Trash2, AlertTriangle } from "lucide-react";
import Holidays from "date-holidays";

export function Calendar() {
  const { businessId } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Modal State
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotService, setNewSlotService] = useState("");
  const [newSlotEmployee, setNewSlotEmployee] = useState("");
  const [clientName, setClientName] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);

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
    });

    const q = query(
      collection(db, `businesses/${businessId}/slots`),
      where("status", "==", "booked")
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      slotsData.sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date); // ascending date
      });
      setSlots(slotsData);
    });

    const unsubClients = onSnapshot(collection(db, `businesses/${businessId}/clients`), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubBusiness();
      unsubSlots();
      unsubClients();
    };
  }, [businessId]);

  const handleCreateBookedSlot = async () => {
    if (!businessId || !newSlotDate || !newSlotTime || !newSlotService || !clientName || !newSlotEmployee) return;
    setIsSubmitting(true);

    const employee = business?.employees?.find((e: any) => e.id === newSlotEmployee);

    try {
      await addDoc(collection(db, `businesses/${businessId}/slots`), {
        date: newSlotDate,
        time: newSlotTime,
        serviceType: newSlotService,
        employeeId: newSlotEmployee,
        employeeName: employee?.name || "Unbekannt",
        status: "booked",
        notifiedClients: [],
        bookedBy: clientName,
        bookedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setClientName("");
    } catch (error) {
      console.error("Error creating booked slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    setNewSlotDate(format(selectedDate, 'yyyy-MM-dd'));
    setIsModalOpen(true);
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
  };

  const timeSlots = generateTimeSlots();

  const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
  const holiday = (hd ? hd.isHoliday(selectedDate) : null) as any;
  const holidayName = holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1">Ihre gebuchten Termine</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Kalender</h1>
        </div>
        <Button onClick={handleOpenModal} className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6">
          <Plus className="mr-2 h-5 w-5" /> Termin eintragen
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
                Termine am {format(selectedDate, 'dd.MM.yyyy')}
              </h3>
              <div className="flex items-center gap-4">
                {totalCapacity === 0 && (
                  <span className="text-xs font-bold tracking-widest text-red-500 uppercase">Keine Mitarbeiter verfügbar</span>
                )}
                <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">{filteredSlots.length} Termine</span>
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
                const remainingCapacity = totalCapacity - timeSlotsData.length;
                
                return (
                  <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[70px]">
                    <div className="w-24 py-4 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                      {time}
                    </div>
                    <div className="flex-1 p-2 space-y-2">
                      {timeSlotsData.map(slot => (
                        <div key={slot.id} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg p-3 flex justify-between items-center shadow-sm group/card">
                          <div>
                            <div className="font-bold text-deep-blue dark:text-white">{slot.bookedBy}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{slot.serviceType} {slot.employeeName ? `• ${slot.employeeName}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" /> Gebucht
                            </span>
                            <button 
                              onClick={() => confirmDelete(slot)}
                              className="text-gray-400 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity p-1"
                              title="Termin löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {remainingCapacity > 0 && (
                        <div 
                          className="h-full w-full flex items-center px-4 py-2 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700 group"
                          onClick={() => {
                            setNewSlotTime(time);
                            handleOpenModal();
                          }}
                        >
                          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-deep-blue dark:text-white">
                            <Plus className="w-4 h-4 mr-1" /> Termin eintragen
                          </span>
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
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={newSlotEmployee}
                onChange={(e) => setNewSlotEmployee(e.target.value)}
              >
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
