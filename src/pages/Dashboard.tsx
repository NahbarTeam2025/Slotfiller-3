import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, addDoc, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { StatCard } from "../components/ui/stat-card";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, CheckCircle, Users, Plus, MoreVertical, Edit2, Trash2, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import Holidays from "date-holidays";

export function Dashboard() {
  const { businessId } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);

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

    // Fetch Business
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

    // Fetch Slots
    const q = query(
      collection(db, `businesses/${businessId}/slots`)
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSlots(slotsData);
    });

    // Fetch Clients
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

  const todayString = format(new Date(), 'yyyy-MM-dd');
  const slotsToday = slots.filter(s => s.date === todayString);
  const bookedSlotsToday = slotsToday.filter(s => s.status === 'booked');
  
  const availableEmployees = business?.employees?.filter((emp: any) => {
    const isAbsent = business?.absences?.some((abs: any) => 
      abs.employeeId === emp.id && 
      abs.startDate <= todayString && 
      abs.endDate >= todayString
    );
    return !isAbsent;
  }) || [];

  const totalCapacity = business?.employees?.length > 0 ? availableEmployees.length : 1;

  const generateTimeSlots = () => {
    if (totalCapacity === 0) return [];
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[new Date().getDay()];
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
  
  const now = new Date();
  const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentHourString = `${now.getHours().toString().padStart(2, '0')}:00`;
  const localNowString = `${todayString}T${currentTimeString}`;
  
  const futureTimeSlots = timeSlots.filter(time => time >= currentTimeString);
  const futureBookedSlotsToday = bookedSlotsToday.filter(s => s.time >= currentTimeString);
  
  let openSlotsCount = 0;
  futureTimeSlots.forEach(time => {
    const bookedCount = futureBookedSlotsToday.filter(s => s.time === time).length;
    if (bookedCount < totalCapacity) {
      openSlotsCount += 1;
    }
  });

  const timelineSlots = timeSlots.filter(time => time >= currentHourString);
  
  const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
  const holiday = (hd ? hd.isHoliday(new Date()) : null) as any;
  const holidayName = holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;

  const futureBookedClients = slots
    .filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString)
    .map(s => s.bookedBy);

  const activeWaitlistClientsCount = clients.filter(c => c.active && !futureBookedClients.includes(c.name)).length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto lg:h-full lg:flex lg:flex-col lg:overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Dashboard</h1>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
        >
          <Plus className="mr-2 h-5 w-5" /> Neuer Termin
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 shrink-0">
        <div onClick={() => navigate('/free-slots')} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
          <StatCard 
            title="Freie Plätze heute" 
            value={openSlotsCount.toString().padStart(2, '0')} 
            icon={<Calendar className="h-5 w-5" />}
            className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 h-full"
            valueClassName="text-indigo-900 dark:text-indigo-300 leading-none"
          />
        </div>
        <div onClick={() => navigate('/calendar')} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
          <StatCard 
            title="Gebuchte Termine heute" 
            value={bookedSlotsToday.length.toString().padStart(2, '0')} 
            icon={<CheckCircle className="h-5 w-5 text-accent" />}
            className="bg-white dark:bg-slate-900 border-accent/20 h-full"
            valueClassName="text-deep-blue dark:text-white leading-none"
          />
        </div>
        <div className="h-full">
          <StatCard 
            title="Personen auf Warteliste" 
            value={activeWaitlistClientsCount.toString().padStart(2, '0')} 
            icon={<Users className="h-5 w-5 text-orange-500" />}
            className="bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20 h-full"
            valueClassName="text-orange-900 dark:text-orange-300 leading-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="text-lg font-bold text-deep-blue dark:text-white">Heutiger Zeitplan</h3>
          <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">{format(new Date(), 'dd.MM.yyyy')}</span>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto">
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
          ) : timelineSlots.map(time => {
            const timeSlotsData = slotsToday.filter(s => s.time === time);
            const bookedSlots = timeSlotsData.filter(s => s.status === 'booked');
            const openSlots = timeSlotsData.filter(s => s.status === 'open');
            const remainingCapacity = totalCapacity - bookedSlots.length;
            
            return (
              <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[60px]">
                <div className="w-20 py-3 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                  {time}
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {bookedSlots.map(slot => (
                    <div key={slot.id} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg p-3 flex justify-between items-center shadow-sm group/card">
                      <div>
                        <div className="font-bold text-deep-blue dark:text-white text-sm">{slot.bookedBy}</div>
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

                  {openSlots.map(slot => (
                    <div key={slot.id} className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 flex justify-between items-center shadow-sm">
                      <div className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">Warteliste aktiv</div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-full">{slot.notifiedClients?.length || 0} benachrichtigt</span>
                    </div>
                  ))}

                  {remainingCapacity > 0 && (
                    <div 
                      className="h-full w-full flex items-center px-3 py-2 text-gray-400 dark:text-gray-500 hover:bg-accent/10 cursor-pointer rounded-lg transition-colors border border-transparent hover:border-accent/30 group"
                      onClick={() => {
                        setNewSlotTime(time);
                        setIsModalOpen(true);
                      }}
                    >
                      <span className="text-xs font-bold text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                        <Plus className="w-3 h-3 mr-1" /> Termin eintragen
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                {timeSlots.map((time) => (
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
                        e.preventDefault();
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
