import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, addDoc, where, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { StatCard } from "../components/ui/stat-card";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, CheckCircle, Users, Plus, MoreVertical, Edit2, Trash2, AlertTriangle, Calendar as CalendarIcon, Clock, ChevronDown } from "lucide-react";
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

  const [isNotifiedClientsModalOpen, setIsNotifiedClientsModalOpen] = useState(false);
  const [notifiedClientsDetails, setNotifiedClientsDetails] = useState<any[]>([]);
  const [selectedOpenSlot, setSelectedOpenSlot] = useState<any>(null);
  const [isNotifyMoreModalOpen, setIsNotifyMoreModalOpen] = useState(false);
  const [additionalClients, setAdditionalClients] = useState<string[]>([]);
  const [additionalServiceType, setAdditionalServiceType] = useState<string>("");
  const [additionalEmployeeId, setAdditionalEmployeeId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [notificationResult, setNotificationResult] = useState<{ success: boolean, notified: number } | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isCustomService, setIsCustomService] = useState(false);
  const [customService, setCustomService] = useState("");
  const [isCustomFreeService, setIsCustomFreeService] = useState(false);
  const [customFreeService, setCustomFreeService] = useState("");
  const [isCustomNotifyService, setIsCustomNotifyService] = useState(false);
  const [customNotifyService, setCustomNotifyService] = useState("");

  const [notifiedFilterEmployee, setNotifiedFilterEmployee] = useState("");
  const [notifiedFilterClient, setNotifiedFilterClient] = useState("");
  const [notifiedFilterDate, setNotifiedFilterDate] = useState("");

  const [isFreeSlotsModalOpen, setIsFreeSlotsModalOpen] = useState(false);
  const [isBookedSlotsModalOpen, setIsBookedSlotsModalOpen] = useState(false);
  const [bookedFilterEmployee, setBookedFilterEmployee] = useState("");
  const [bookedFilterService, setBookedFilterService] = useState("");
  const [isCreateFreeSlotModalOpen, setIsCreateFreeSlotModalOpen] = useState(false);
  const [newSlotServices, setNewSlotServices] = useState<string[]>([]);
  const [matchingClients, setMatchingClients] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isSlotServiceDropdownOpen, setIsSlotServiceDropdownOpen] = useState(false);
  const [slotServiceSearch, setSlotServiceSearch] = useState("");
  const [isSlotEmployeeDropdownOpen, setIsSlotEmployeeDropdownOpen] = useState(false);
  const [slotEmployeeSearch, setSlotEmployeeSearch] = useState("");

  useEffect(() => {
    if (!businessId || !isCreateFreeSlotModalOpen) return;

    const fetchMatchingClients = async () => {
      import("firebase/firestore").then(async ({ getDocs }) => {
        let q = query(
          collection(db, `businesses/${businessId}/clients`),
          where("active", "==", true)
        );
        
        const snapshot = await getDocs(q);
        const allActiveClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = new Date();
        
        const filteredClients = allActiveClients.filter((client: any) => {
          const matchesService = newSlotServices.length === 0 || 
            !client.serviceTypes || client.serviceTypes.length === 0 ||
            client.serviceTypes?.some((s: string) => newSlotServices.includes(s));
          return matchesService;
        });

        setMatchingClients(filteredClients);
      });
    };

    fetchMatchingClients();
  }, [businessId, newSlotServices, isCreateFreeSlotModalOpen, slots]);

  useEffect(() => {
    setSelectedClients([]);
  }, [matchingClients]);

  useEffect(() => {
    if (!businessId) return;

    // Fetch Business
    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `businesses/${businessId}`);
    });

    // Fetch Slots
    const q = query(
      collection(db, `businesses/${businessId}/slots`)
    );
    const unsubSlots = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSlots(slotsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/slots`);
    });

    // Fetch Clients
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

  // Auto-expiry for open slots
  useEffect(() => {
    if (!businessId) return;
    
    const interval = setInterval(async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const time = format(now, 'HH:mm');
      
      const expiredSlots = slots.filter(s => 
        s.status === 'open' && 
        s.notifiedClients?.length > 0 &&
        (s.date < today || (s.date === today && s.time <= time))
      );

      for (const slot of expiredSlots) {
        try {
          // 1. Try to notify worker about expiry (optional/best-effort)
          // We wrap this in its own try-catch so a network error doesn't block the DB reset
          try {
            await fetch("https://slotfiller-notifier.nahbar.workers.dev", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                businessId,
                slotId: slot.id,
                date: slot.date,
                time: slot.time,
                serviceType: slot.serviceType,
                manualClients: slot.notifiedClients,
                isExpired: true
              })
            });
          } catch (fetchErr) {
            // Log as warning, but don't throw - we still want to reset the slot
            console.warn("Could not notify worker about expired slot (likely CORS or network):", fetchErr);
          }

          // 2. Reset notified clients so they don't get notified again and slot appears "open" again
          // This is the critical part to stop the loop
          await updateDoc(doc(db, `businesses/${businessId}/slots`, slot.id), {
            notifiedClients: [],
            status: "open"
          });
        } catch (err) {
          console.error("Error handling expired slot reset:", err);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [businessId, slots]);

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleCreateFreeSlot = async () => {
    const finalServices = isCustomFreeService && customFreeService.trim() 
      ? [...newSlotServices, customFreeService.trim()]
      : newSlotServices;

    if (!businessId || !newSlotDate || !newSlotTime || finalServices.length === 0) return;
    setIsSubmitting(true);

    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    
    let serviceTypeString = "";
    if (finalServices && finalServices.length > 0) {
      serviceTypeString = finalServices.join(", ");
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

      setIsCreateFreeSlotModalOpen(false);
      setNewSlotServices([]);
      setIsCustomFreeService(false);
      setCustomFreeService("");
    } catch (error) {
      console.error("Error creating free slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBookedSlot = async () => {
    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    const finalService = isCustomService && customService.trim() ? customService.trim() : newSlotService;

    if (!businessId || !newSlotDate || !newSlotTime || !finalService || !clientName) return;
    setIsSubmitting(true);

    try {
      if (isEditMode && editingSlotId) {
        // Update existing slot
        await updateDoc(doc(db, `businesses/${businessId}/slots`, editingSlotId), {
          date: newSlotDate,
          time: newSlotTime,
          serviceType: finalService,
          employeeId: newSlotEmployee || null,
          employeeName: employee?.name || "",
          bookedBy: clientName,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Check if there is an existing open slot at this time
        const existingOpenSlot = slotsToday.find(s => s.date === newSlotDate && s.time === newSlotTime && s.status === 'open');

        if (existingOpenSlot) {
          // Update existing open slot to booked
          await updateDoc(doc(db, `businesses/${businessId}/slots`, existingOpenSlot.id), {
            status: "booked",
            bookedBy: clientName,
            bookedAt: new Date().toISOString(),
            serviceType: finalService,
            employeeId: newSlotEmployee || null,
            employeeName: employee?.name || null
          });
        } else {
          // Create new booked slot
          await addDoc(collection(db, `businesses/${businessId}/slots`), {
            date: newSlotDate,
            time: newSlotTime,
            serviceType: finalService,
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

      // Delete old future appointments for this client (only if not editing or if date/time changed)
      if (!isEditMode) {
        const nowString = format(new Date(), 'yyyy-MM-dd');
        const existingAppointments = slotsToday.filter(s => 
          s.status === 'booked' && 
          s.bookedBy === clientName && 
          s.date >= nowString &&
          !(s.date === newSlotDate && s.time === newSlotTime)
        );

        for (const oldSlot of existingAppointments) {
          await deleteDoc(doc(db, `businesses/${businessId}/slots`, oldSlot.id));
        }
      }

      setIsModalOpen(false);
      setIsEditMode(false);
      setEditingSlotId(null);
      setClientName("");
      setIsCustomService(false);
      setCustomService("");
    } catch (error) {
      console.error("Error saving booked slot", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (slot: any) => {
    setEditingSlotId(slot.id);
    setIsEditMode(true);
    setNewSlotDate(slot.date);
    setNewSlotTime(slot.time);
    setNewSlotService(slot.serviceType);
    setNewSlotEmployee(slot.employeeId || "");
    setClientName(slot.bookedBy);
    setIsModalOpen(true);
  };

  const handleNotifyMoreClients = async () => {
    const finalServices = isCustomNotifyService && customNotifyService.trim() 
      ? (additionalServiceType ? additionalServiceType.split(', ') : []).concat(customNotifyService.trim()).join(', ')
      : additionalServiceType;

    if (!businessId || !selectedOpenSlot || additionalClients.length === 0) return;
    setIsSubmitting(true);

    const employee = additionalEmployeeId ? business?.employees?.find((e: any) => e.id === additionalEmployeeId) : null;
    
    let serviceTypeString = "";
    if (finalServices) {
      serviceTypeString = finalServices;
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
        import("firebase/firestore").then(async ({ updateDoc }) => {
          await updateDoc(doc(db, `businesses/${businessId}/slots`, selectedOpenSlot.id), {
            notifiedClients: updatedNotifiedClients,
            serviceType: serviceTypeString,
            employeeId: additionalEmployeeId,
            employeeName: employee?.name || "Unbekannt"
          });
        });
      }

      setIsNotifyMoreModalOpen(false);
      setIsCustomNotifyService(false);
      setCustomNotifyService("");
    } catch (workerErr) {
      console.error("Error calling worker", workerErr);
      setWorkerError("Fehler beim Benachrichtigen der Kunden. Bitte prüfen Sie die Worker-Konfiguration.");
    } finally {
      setIsSubmitting(false);
      setIsNotifyMoreModalOpen(false);
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
  
  const now = new Date();
  const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentHourString = `${now.getHours().toString().padStart(2, '0')}:00`;
  const localNowString = `${todayString}T${currentTimeString}`;
  
  const futureTimeSlots = timeSlots.filter(time => time >= currentTimeString);
  const futureBookedSlotsToday = bookedSlotsToday.filter(s => s.time >= currentTimeString);
  
  let openSlotsCount = 0;
  futureTimeSlots.forEach(time => {
    const bookedCount = futureBookedSlotsToday.filter(s => s.time === time).length;
    const capacity = getCapacityForTime(time, todayString);
    if (bookedCount < capacity) {
      openSlotsCount += 1;
    }
  });

  const timelineSlots = timeSlots.filter(time => time >= currentHourString);
  
  const hd = business?.federalState ? new Holidays('DE', business.federalState) : null;
  const holiday = (hd ? hd.isHoliday(new Date()) : null) as any;
  const holidayName = holiday ? (Array.isArray(holiday) ? holiday[0].name : holiday.name) : null;

  const notifiedClients = slots
    .filter(s => s.status === 'open' && s.notifiedClients?.length > 0)
    .flatMap(s => s.notifiedClients.map((clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return { 
        clientName: client ? client.name : clientId, 
        slot: s 
      };
    }));
  
  const uniqueNotifiedClients = Array.from(new Set(notifiedClients.map(n => n.clientName)));

  const openNotifiedClientsModalForSlot = (slot: any) => {
    setSelectedOpenSlot(slot);
    setNotifiedClientsDetails(slot.notifiedClients?.map((clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return { 
        clientName: client ? client.name : clientId, 
        phone: client ? client.phone : "",
        slot: slot 
      };
    }) || []);
    setNotifiedFilterEmployee("");
    setNotifiedFilterClient("");
    setNotifiedFilterDate("");
    setIsNotifiedClientsModalOpen(true);
  };

  const filteredNotifiedClients = notifiedClientsDetails.filter(item => {
    const matchesEmployee = !notifiedFilterEmployee || item.slot.employeeName?.toLowerCase().includes(notifiedFilterEmployee.toLowerCase());
    const matchesClient = !notifiedFilterClient || item.clientName.toLowerCase().includes(notifiedFilterClient.toLowerCase());
    const matchesDate = !notifiedFilterDate || item.slot.date === notifiedFilterDate;
    return matchesEmployee && matchesClient && matchesDate;
  });

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
        <div onClick={() => {
          setIsFreeSlotsModalOpen(true);
        }} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
          <StatCard 
            title="Freie Plätze heute" 
            value={openSlotsCount.toString().padStart(2, '0')} 
            icon={<Calendar className="h-5 w-5" />}
            className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 h-full"
            valueClassName="text-indigo-900 dark:text-indigo-300 leading-none"
          />
        </div>
        <div onClick={() => {
          setIsBookedSlotsModalOpen(true);
        }} className="cursor-pointer transition-transform hover:scale-[1.02] h-full">
          <StatCard 
            title="Termine heute" 
            value={futureBookedSlotsToday.length.toString().padStart(2, '0')} 
            icon={<CheckCircle className="h-5 w-5 text-accent" />}
            className="bg-white dark:bg-card-dark border-accent/20 h-full"
            valueClassName="text-deep-blue dark:text-white leading-none"
          />
        </div>
        <div className="cursor-pointer transition-transform hover:scale-[1.02] h-full" onClick={() => {
          setNotifiedClientsDetails(notifiedClients);
          setIsNotifiedClientsModalOpen(true);
        }}>
          <StatCard 
            title="Benachrichtigte Kunden" 
            value={notifiedClients.length.toString().padStart(2, '0')} 
            icon={<Users className="h-5 w-5 text-orange-500" />}
            className="bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20 h-full"
            valueClassName="text-orange-900 dark:text-orange-300 leading-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="text-lg font-bold text-deep-blue dark:text-white">Heutiger Zeitplan</h3>
          <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase whitespace-nowrap">{format(new Date(), 'dd.MM.yyyy')}</span>
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
            const capacity = getCapacityForTime(time, todayString);
            const remainingCapacity = capacity - bookedSlots.length;
            
            return (
              <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[60px]">
                <div className="w-20 py-3 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                  {time}
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
                    <div key={slot.id} className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-lg p-3 flex justify-between items-center shadow-sm group/card">
                      <div className="cursor-pointer flex-1" onClick={() => openNotifiedClientsModalForSlot(slot)}>
                        <div className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">Kunden benachrichtigt</div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-full">{slot.notifiedClients?.length || 0} benachrichtigt</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(slot);
                        }}
                        className="text-gray-400 hover:text-red-500 sm:opacity-0 group-hover/card:opacity-100 transition-opacity p-1 ml-2"
                        title="Meldung zurückziehen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {remainingCapacity > 0 && (
                    <div className="flex gap-2 mt-1">
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
                          <Clock className="w-3 h-3 mr-1" /> Freien Platz melden
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

      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setIsEditMode(false);
        setEditingSlotId(null);
        setIsCustomService(false);
        setCustomService("");
      }} title={isEditMode ? "Termin bearbeiten" : "Gebuchten Termin eintragen"}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {isEditMode 
            ? "Passen Sie die Details des gebuchten Termins an." 
            : "Tragen Sie hier einen Termin ein, der bereits fest vergeben ist."}
        </p>
        
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
                <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Uhrzeit</label>
              <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[200px] p-1 scrollbar-thin">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setNewSlotTime(time)}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                      newSlotTime === time 
                        ? 'bg-accent/20 text-deep-blue dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Service-Typ</label>
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
                  {[...business?.serviceTypes || []]
                    .filter(s => s.toLowerCase().includes(slotServiceSearch.toLowerCase()))
                    .sort((a, b) => a.localeCompare(b))
                    .map((service: string) => (
                    <button
                      key={service}
                      onClick={() => {
                        setIsCustomService(false);
                        setNewSlotService(service);
                        setSlotServiceSearch("");
                      }}
                      className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                        !isCustomService && newSlotService === service 
                          ? 'bg-accent/20 text-deep-blue dark:text-white' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => {
                        setIsCustomService(true);
                        setSlotServiceSearch("");
                      }}
                      className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                        isCustomService 
                          ? 'bg-accent/20 text-deep-blue dark:text-white' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      Individuell...
                    </button>
                </div>
              </div>
              {isCustomService && (
                <Input 
                  placeholder="Eigene Dienstleistung..." 
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  className="mt-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              )}
            </div>  </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
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
                {[...business?.employees || []]
                  .filter(e => e.name.toLowerCase().includes(slotEmployeeSearch.toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b))
                  .map((emp: any) => (
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

          {/* Add extra space if dropdown is open to prevent cutting off */}
          {showClientDropdown && <div className="h-32" />}

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
        </Modal>

      <Modal isOpen={isNotifiedClientsModalOpen} onClose={() => setIsNotifiedClientsModalOpen(false)} title="Benachrichtigte Kunden">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input 
              placeholder="Mitarbeiter..." 
              value={notifiedFilterEmployee}
              onChange={(e) => setNotifiedFilterEmployee(e.target.value)}
              className="h-9 text-sm"
            />
            <Input 
              placeholder="Kunde..." 
              value={notifiedFilterClient}
              onChange={(e) => setNotifiedFilterClient(e.target.value)}
              className="h-9 text-sm"
            />
            <Input 
              type="date"
              value={notifiedFilterDate}
              onChange={(e) => setNotifiedFilterDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {filteredNotifiedClients.length === 0 ? (
              <p className="text-sm text-gray-500">Keine Kunden gefunden.</p>
            ) : (
              filteredNotifiedClients.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-bold text-deep-blue">{item.clientName}</p>
                    <p className="text-xs text-gray-500">
                      {item.slot.serviceType} am {format(new Date(item.slot.date), 'dd.MM.yyyy')} um {item.slot.time}
                      {item.slot.employeeName && ` bei ${item.slot.employeeName}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {selectedOpenSlot && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button 
                className="w-full bg-accent text-white hover:bg-accent-hover font-bold"
                onClick={() => {
                  setIsNotifiedClientsModalOpen(false);
                  setAdditionalClients([]);
                  setClientSearch("");
                  setAdditionalServiceType(business?.serviceTypes?.[0] || "");
                  setAdditionalEmployeeId(business?.employees?.[0]?.id || "");
                  setIsNotifyMoreModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Weitere Kunden benachrichtigen
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isNotifyMoreModalOpen} onClose={() => {
        setIsNotifyMoreModalOpen(false);
        setIsCustomNotifyService(false);
        setCustomNotifyService("");
      }} title="Weitere Kunden benachrichtigen">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Dienstleistungen</label>
              <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin mb-2">
                {[...business?.serviceTypes || []].sort((a, b) => a.localeCompare(b)).map((service: string) => (
                  <label key={service} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
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
              <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={isCustomNotifyService}
                  onChange={() => setIsCustomNotifyService(!isCustomNotifyService)}
                  className="accent-accent shrink-0"
                />
                <span className="truncate">Individuell...</span>
              </label>
              {isCustomNotifyService && (
                <Input 
                  placeholder="Eigene Dienstleistung..." 
                  value={customNotifyService}
                  onChange={(e) => setCustomNotifyService(e.target.value)}
                  className="mt-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin">
                <button
                  onClick={() => setAdditionalEmployeeId("")}
                  className={`p-3 rounded-lg text-sm font-medium text-left transition-colors border-2 ${
                    additionalEmployeeId === "" 
                      ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Kein Mitarbeiter ausgewählt
                </button>
                {[...business?.employees || []].sort((a, b) => a.name.localeCompare(b)).map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => setAdditionalEmployeeId(emp.id)}
                    className={`p-3 rounded-lg text-sm font-medium text-left transition-colors border-2 ${
                      additionalEmployeeId === emp.id 
                        ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {emp.name}
                  </button>
                ))}
              </div>
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
                Verfügbare Kunden ({clients.filter(c => 
                  c.active && 
                  !(selectedOpenSlot?.notifiedClients || []).includes(c.id) &&
                  (!additionalServiceType || c.serviceTypes?.includes(additionalServiceType))
                ).length})
              </label>
              <button 
                onClick={() => {
                  const available = clients.filter(c => 
                    c.active && 
                    !(selectedOpenSlot?.notifiedClients || []).includes(c.id) &&
                    (!additionalServiceType || c.serviceTypes?.includes(additionalServiceType)) &&
                    (c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                     c.phone?.toLowerCase().includes(clientSearch.toLowerCase()))
                  );
                  setAdditionalClients(additionalClients.length === available.length ? [] : available.map(c => c.id));
                }}
                className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                {additionalClients.length > 0 ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {clients
                .filter(c => 
                  c.active && 
                  !(selectedOpenSlot?.notifiedClients || []).includes(c.id) &&
                  (!additionalServiceType || c.serviceTypes?.includes(additionalServiceType))
                )
                .filter(c => 
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                  c.phone?.toLowerCase().includes(clientSearch.toLowerCase())
                )
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
                  <div className="flex gap-1">
                    {client.serviceTypes?.slice(0, 1).map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-[8px] font-bold uppercase rounded">{s}</span>
                    ))}
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

      <Modal isOpen={isFreeSlotsModalOpen} onClose={() => setIsFreeSlotsModalOpen(false)} title="Freie Plätze heute">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {futureTimeSlots.map(time => {
            const timeSlotsData = slotsToday.filter(s => s.time === time);
            const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
            const capacity = getCapacityForTime(time, todayString);
            const remainingCapacity = capacity - bookedCount;

            if (remainingCapacity <= 0) return null;

            return (
              <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[60px]">
                <div className="w-20 py-3 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                  {time}
                </div>
                <div className="flex-1 p-2 flex items-center gap-2">
                  <div 
                    className="flex-1 flex items-center px-3 py-2 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors border border-dashed border-gray-200 dark:border-slate-700"
                    onClick={() => {
                      setNewSlotTime(time);
                      setIsFreeSlotsModalOpen(false);
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
                      setIsFreeSlotsModalOpen(false);
                      setIsCreateFreeSlotModalOpen(true);
                    }}
                  >
                    <span className="text-xs font-bold flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> Freien Platz melden
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {futureTimeSlots.length === 0 && (
            <div className="py-12 text-center">
              <Clock className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Für heute sind keine weiteren Termine mehr möglich.</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isCreateFreeSlotModalOpen} onClose={() => {
        setIsCreateFreeSlotModalOpen(false);
        setIsCustomFreeService(false);
        setCustomFreeService("");
      }} title="Neuer freier Slot">
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
          <div className="mb-6">
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Uhrzeit</label>
            <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[200px] p-1 scrollbar-thin">
              {generateTimeSlots().map((time) => (
                <button
                  key={time}
                  onClick={() => setNewSlotTime(time)}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                    newSlotTime === time 
                      ? 'bg-accent/20 text-deep-blue dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Service-Typ</label>
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
                {[...business?.serviceTypes || []]
                  .filter(s => s.toLowerCase().includes(slotServiceSearch.toLowerCase()))
                  .sort((a, b) => a.localeCompare(b))
                  .map((service: string) => (
                  <button
                    key={service}
                    onClick={() => {
                      setIsCustomFreeService(false);
                      setNewSlotServices([service]);
                      setSlotServiceSearch("");
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                      !isCustomFreeService && newSlotServices.includes(service) 
                        ? 'bg-accent/20 text-deep-blue dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => {
                      setIsCustomFreeService(true);
                      setSlotServiceSearch("");
                    }}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                      isCustomFreeService 
                        ? 'bg-accent/20 text-deep-blue dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Individuell...
                  </button>
              </div>
            </div>
            {isCustomFreeService && (
              <Input 
                placeholder="Eigene Dienstleistung..." 
                value={customFreeService}
                onChange={(e) => setCustomFreeService(e.target.value)}
                className="mt-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            )}
          </div>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter (Optional)</label>
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
                {[...business?.employees || []]
                  .filter(e => e.name.toLowerCase().includes(slotEmployeeSearch.toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b))
                  .map((emp: any) => (
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
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsCreateFreeSlotModalOpen(false)}>Abbrechen</Button>
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

      <Modal isOpen={isBookedSlotsModalOpen} onClose={() => setIsBookedSlotsModalOpen(false)} title="Termine heute">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1.5">Mitarbeiter Filter</label>
              <select 
                className="flex h-9 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={bookedFilterEmployee}
                onChange={(e) => setBookedFilterEmployee(e.target.value)}
              >
                <option value="">Alle Mitarbeiter</option>
                {business?.employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1.5">Dienstleistung Filter</label>
              <select 
                className="flex h-9 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                value={bookedFilterService}
                onChange={(e) => setBookedFilterService(e.target.value)}
              >
                <option value="">Alle Dienstleistungen</option>
                {[...business?.serviceTypes || []].sort((a, b) => a.localeCompare(b)).map((service: string) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
            {futureTimeSlots.map(time => {
              const timeSlotsData = slotsToday.filter(s => s.time === time);
              const bookedSlots = timeSlotsData.filter(s => {
                const isBooked = s.status === 'booked';
                const matchesEmployee = !bookedFilterEmployee || s.employeeId === bookedFilterEmployee;
                const matchesService = !bookedFilterService || s.serviceType === bookedFilterService;
                return isBooked && matchesEmployee && matchesService;
              });

              if (bookedSlots.length === 0) return null;

              return (
                <div key={time} className="flex border-b border-gray-100 dark:border-slate-800 min-h-[60px]">
                  <div className="w-20 py-3 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-slate-800 text-right bg-gray-50/50 dark:bg-slate-800/20">
                    {time}
                  </div>
                  <div className="flex-1 p-2 space-y-2">
                    {bookedSlots.map(slot => (
                      <div key={slot.id} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm group/card">
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
                              onClick={() => {
                                setIsBookedSlotsModalOpen(false);
                                openEditModal(slot);
                              }}
                              className="text-gray-400 hover:text-accent p-1"
                              title="Termin bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => confirmDelete(slot)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Termin löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {futureTimeSlots.every(time => {
              const timeSlotsData = slotsToday.filter(s => s.time === time);
              const bookedSlots = timeSlotsData.filter(s => {
                const isBooked = s.status === 'booked';
                const matchesEmployee = !bookedFilterEmployee || s.employeeId === bookedFilterEmployee;
                const matchesService = !bookedFilterService || s.serviceType === bookedFilterService;
                return isBooked && matchesEmployee && matchesService;
              });
              return bookedSlots.length === 0;
            }) && (
              <div className="py-12 text-center">
                <Calendar className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Keine Termine für die gewählten Filter gefunden.</p>
              </div>
            )}
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
                Der Termin am {slotToDelete?.date ? format(new Date(slotToDelete.date), 'dd.MM.yyyy') : ''} um {slotToDelete?.time} Uhr für {slotToDelete?.bookedBy} wird unwiderruflich entfernt.
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
