import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { format } from "date-fns";
import { Plus, Trash2, Edit2, Clock, AlertTriangle, Search, Filter, ChevronDown, CheckCircle, X } from "lucide-react";

export function Clients() {
  const { businessId } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem("clients_searchQuery") || "");
  const [filterService, setFilterService] = useState(() => localStorage.getItem("clients_filterService") || "all");
  const [filterAppointment, setFilterAppointment] = useState(() => localStorage.getItem("clients_filterAppointment") || "all");
  const [filterTime, setFilterTime] = useState(() => localStorage.getItem("clients_filterTime") || "all");

  useEffect(() => {
    localStorage.setItem("clients_searchQuery", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem("clients_filterService", filterService);
  }, [filterService]);

  useEffect(() => {
    localStorage.setItem("clients_filterAppointment", filterAppointment);
  }, [filterAppointment]);

  useEffect(() => {
    localStorage.setItem("clients_filterTime", filterTime);
  }, [filterTime]);

  // Modal State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedClientAppointments, setSelectedClientAppointments] = useState<any[]>([]);
  const [selectedClientNotifiedSlots, setSelectedClientNotifiedSlots] = useState<any[]>([]);
  const [isDeleteAppointmentModalOpen, setIsDeleteAppointmentModalOpen] = useState(false);
  const [appointmentToDeleteId, setAppointmentToDeleteId] = useState<string | null>(null);
  const [isEditSlotModalOpen, setIsEditSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [newSlotService, setNewSlotService] = useState("");
  const [newSlotEmployee, setNewSlotEmployee] = useState("");
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [isCustomService, setIsCustomService] = useState(false);
  const [customService, setCustomService] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [editingCustomIndex, setEditingCustomIndex] = useState<number | null>(null);
  const [editingCustomValue, setEditingCustomValue] = useState("");

  const [confirmDeleteCustomIndex, setConfirmDeleteCustomIndex] = useState<number | null>(null);

  const renderCustomServicesList = () => {
    const addService = () => {
      if (customService.trim()) {
        setCustomServices([...customServices, customService.trim()]);
        setCustomService("");
      }
    };

    const removeService = (index: number) => {
      setCustomServices(customServices.filter((_, i) => i !== index));
      setConfirmDeleteCustomIndex(null);
    };

    const startEdit = (index: number) => {
      setEditingCustomIndex(index);
      setEditingCustomValue(customServices[index]);
      setConfirmDeleteCustomIndex(null);
    };

    const saveEdit = () => {
      if (editingCustomIndex !== null && editingCustomValue.trim()) {
        const newList = [...customServices];
        newList[editingCustomIndex] = editingCustomValue.trim();
        setCustomServices(newList);
        setEditingCustomIndex(null);
        setEditingCustomValue("");
      }
    };

    return (
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <Input 
            placeholder="Eigene Dienstleistung..." 
            value={customService}
            onChange={(e) => setCustomService(e.target.value)}
            className="flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addService();
              }
            }}
          />
          <Button onClick={addService} size="sm" className="bg-accent hover:bg-accent-hover text-white h-10">
            Hinzufügen
          </Button>
        </div>
        
        {customServices.length > 0 && (
          <div className="space-y-1 mt-2">
            {customServices.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {editingCustomIndex === index ? (
                  <div className="flex gap-2 w-full items-center">
                    <Input 
                      value={editingCustomValue}
                      onChange={(e) => setEditingCustomValue(e.target.value)}
                      className="h-8 text-xs flex-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          setEditingCustomIndex(null);
                        }
                      }}
                    />
                    <button onClick={saveEdit} className="p-1 text-green-600 hover:text-green-700 transition-colors">
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingCustomIndex(null)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : confirmDeleteCustomIndex === index ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-red-500">Wirklich löschen?</span>
                    <div className="flex gap-2">
                      <button onClick={() => removeService(index)} className="text-xs font-bold text-red-600 hover:text-red-700">Ja</button>
                      <button onClick={() => setConfirmDeleteCustomIndex(null)} className="text-xs font-bold text-gray-500 hover:text-gray-700">Nein</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{service}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(index)} className="p-1 text-gray-400 hover:text-accent transition-colors">
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setConfirmDeleteCustomIndex(index)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const [isCustomSlotService, setIsCustomSlotService] = useState(false);
  const [customSlotService, setCustomSlotService] = useState("");
  const [isSlotServiceDropdownOpen, setIsSlotServiceDropdownOpen] = useState(false);
  const [isSlotEmployeeDropdownOpen, setIsSlotEmployeeDropdownOpen] = useState(false);

  useEffect(() => {
    console.log("Business ID:", businessId);
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        setBusiness(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `businesses/${businessId}`);
    });

    const q = query(
      collection(db, `businesses/${businessId}/clients`)
    );
    const unsubClients = onSnapshot(q, (snapshot) => {
      console.log("Snapshot size:", snapshot.size);
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
      console.log("Clients Data:", clientsData);
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/clients`);
    });

    const qSlots = query(
      collection(db, `businesses/${businessId}/slots`)
    );
    const unsubSlots = onSnapshot(qSlots, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSlots(slotsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/slots`);
    });

    return () => {
      unsubBusiness();
      unsubClients();
      unsubSlots();
    };
  }, [businessId]);

  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => 
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const handleEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setNewSlotDate(slot.date);
    setNewSlotTime(slot.time);
    setNewSlotService(slot.serviceType);
    setNewSlotEmployee(slot.employeeId || "");
    setIsCustomSlotService(false);
    setCustomSlotService("");
    setIsEditSlotModalOpen(true);
  };

  const handleSaveSlot = async () => {
    const finalService = isCustomSlotService && customSlotService.trim() ? customSlotService.trim() : newSlotService;
    if (!businessId || !editingSlot || !newSlotDate || !newSlotTime || !finalService) return;
    setIsSavingSlot(true);

    try {
      const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
      
      await updateDoc(doc(db, `businesses/${businessId}/slots`, editingSlot.id), {
        date: newSlotDate,
        time: newSlotTime,
        serviceType: finalService,
        employeeId: newSlotEmployee || null,
        employeeName: employee?.name || "",
        updatedAt: new Date().toISOString()
      });

      setIsEditSlotModalOpen(false);
      setEditingSlot(null);
      setIsCustomSlotService(false);
      setCustomSlotService("");
    } catch (error) {
      console.error("Error updating slot", error);
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setAppointmentToDeleteId(slotId);
    setIsDeleteAppointmentModalOpen(true);
  };

  const confirmDeleteSlot = async () => {
    if (!businessId || !appointmentToDeleteId) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/slots`, appointmentToDeleteId));
      setIsDeleteAppointmentModalOpen(false);
      setAppointmentToDeleteId(null);
      // The list will update automatically via onSnapshot
      setSelectedClientAppointments(prev => prev.filter(s => s.id !== appointmentToDeleteId));
    } catch (error) {
      console.error("Error deleting slot", error);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingClientId(null);
    setName("");
    setPhone("");
    setSelectedServices([]);
    setSelectedTimes([]);
    setConsentGiven(false);
    setIsCustomService(false);
    setCustomService("");
    setServiceSearch("");
    setCustomServices([]);
    setIsModalOpen(true);
  };

  const openEditModal = (client: any) => {
    setIsEditMode(true);
    setEditingClientId(client.id);
    setName(client.name);
    setPhone(client.phone);
    
    // Separate standard services from custom services
    const standardServices = business?.serviceTypes || [];
    const clientServices = client.serviceTypes || [];
    
    const standard = clientServices.filter((s: string) => standardServices.includes(s));
    const custom = clientServices.filter((s: string) => !standardServices.includes(s));
    
    setSelectedServices(standard);
    setCustomServices(custom);
    setIsCustomService(custom.length > 0);
    
    setSelectedTimes(client.preferredTimes || []);
    setConsentGiven(client.consentGiven || false);
    setCustomService("");
    setServiceSearch("");
    setIsModalOpen(true);
  };

  const handleSaveClient = async () => {
    if (!businessId || !name || !phone || !consentGiven) return;
    setIsSubmitting(true);

    const allServices = [...selectedServices];
    if (isCustomService && customService.trim()) {
      allServices.push(customService.trim());
    }
    const finalServices = [...allServices, ...customServices].filter(Boolean);

    // Normalize phone number: replace leading 0 with +49
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+49' + normalizedPhone.substring(1);
    }

    try {
      if (isEditMode && editingClientId) {
        await updateDoc(doc(db, `businesses/${businessId}/clients`, editingClientId), {
          name,
          phone: normalizedPhone,
          serviceTypes: finalServices,
          preferredTimes: selectedTimes,
          consentGiven
        });
      } else {
        await addDoc(collection(db, `businesses/${businessId}/clients`), {
          name,
          phone: normalizedPhone,
          serviceTypes: finalServices,
          preferredTimes: selectedTimes,
          consentGiven,
          consentTimestamp: serverTimestamp(),
          active: true,
          createdAt: serverTimestamp()
        });
      }
      
      setIsModalOpen(false);
      setIsCustomService(false);
      setCustomService("");
      setServiceSearch("");
      setCustomServices([]);
    } catch (error) {
      console.error("Error saving client", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (client: any) => {
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!businessId || !clientToDelete) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/clients`, clientToDelete.id));
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error("Error deleting client", error);
    }
  };

  const filteredClients = useMemo(() => {
    const now = new Date();
    const delayMinutes = parseInt(business?.appointmentStatusDelay || "0");
    const effectiveNow = new Date(now.getTime() - delayMinutes * 60000);
    const nowString = format(effectiveNow, 'yyyy-MM-dd');
    const nowTime = format(effectiveNow, 'HH:mm');

    // Create a map of clients with future appointments for O(1) lookup
    const futureAppointmentClientNames = new Set();
    slots.forEach(s => {
      if (s.bookedBy && (s.date > nowString || (s.date === nowString && s.time >= nowTime))) {
        futureAppointmentClientNames.add(s.bookedBy);
      }
    });

    return clients
      .filter(client => {
        const nameStr = client.name || "";
        const phoneStr = client.phone || "";
        const matchesSearch = nameStr.toLowerCase().startsWith(searchQuery.toLowerCase()) || 
                              phoneStr.startsWith(searchQuery);
        const matchesService = filterService === "all" || (client.serviceTypes && client.serviceTypes.includes(filterService));
        
        const hasAppointment = futureAppointmentClientNames.has(nameStr);
        const matchesAppointment = filterAppointment === "all" || 
                                   (filterAppointment === "yes" && hasAppointment) || 
                                   (filterAppointment === "no" && !hasAppointment);
        const matchesTime = filterTime === "all" || (client.preferredTimes && client.preferredTimes.includes(filterTime));
        
        return matchesSearch && matchesService && matchesAppointment && matchesTime;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [clients, slots, searchQuery, filterService, filterAppointment, filterTime, business?.appointmentStatusDelay]);
  
  console.log("Clients:", clients);
  console.log("Filtered Clients:", filteredClients);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Kundenliste</h1>
          <span className="bg-deep-blue/10 dark:bg-accent/10 text-deep-blue dark:text-accent px-3 py-1 rounded-full text-sm font-bold">{clients.length}</span>
        </div>
        <Button onClick={openAddModal} className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20">
          <Plus className="mr-2 h-5 w-5" /> Kunde hinzufügen
        </Button>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Kunde suchen..." 
              className="pl-10 bg-white dark:bg-card-dark dark:border-slate-800 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setIsSlotServiceDropdownOpen(!isSlotServiceDropdownOpen)}
              className="h-10 w-full flex items-center justify-between rounded-md border border-gray-300 dark:border-slate-800 bg-white dark:bg-card-dark px-3 py-2 text-sm dark:text-white"
            >
              <span>{filterService === "all" ? "Alle Dienstleistungen" : filterService}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {isSlotServiceDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-md shadow-lg max-h-[200px] overflow-y-auto scrollbar-thin">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800"
                  onClick={() => { setFilterService("all"); setIsSlotServiceDropdownOpen(false); }}
                >
                  Alle Dienstleistungen
                </button>
                {business?.serviceTypes?.map((service: string) => (
                  <button
                    key={service}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800"
                    onClick={() => { setFilterService(service); setIsSlotServiceDropdownOpen(false); }}
                  >
                    {service}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select 
            className="h-10 rounded-md border border-gray-300 dark:border-slate-800 bg-white dark:bg-card-dark px-3 py-2 text-sm dark:text-white"
            value={filterTime}
            onChange={(e) => setFilterTime(e.target.value)}
          >
            <option value="all">Bevorzugte Zeit</option>
            <option value="Vormittag">Vormittag</option>
            <option value="Nachmittag">Nachmittag</option>
            <option value="Abend">Abend</option>
          </select>
          <select 
            className="h-10 rounded-md border border-gray-300 dark:border-slate-800 bg-white dark:bg-card-dark px-3 py-2 text-sm dark:text-white"
            value={filterAppointment}
            onChange={(e) => setFilterAppointment(e.target.value)}
          >
            <option value="all">Terminstatus</option>
            <option value="yes">Termin vorhanden</option>
            <option value="no">Kein Termin</option>
          </select>
        </div>

      <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-indigo-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium w-1/4">Kundenidentität</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell w-1/5">Dienstleistungen</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell w-1/6">Bevorzugte Zeit</th>
                <th className="px-6 py-4 font-medium w-1/8">Status</th>
                <th className="px-6 py-4 font-medium w-1/8">Termin</th>
                <th className="px-6 py-4 font-medium text-right w-1/6">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredClients.map((client) => {
                const now = new Date();
                const delayMinutes = parseInt(business?.appointmentStatusDelay || "0");
                const effectiveNow = new Date(now.getTime() - delayMinutes * 60000);
                
                const nowString = format(effectiveNow, 'yyyy-MM-dd');
                const nowTime = format(effectiveNow, 'HH:mm');
                const clientAppointments = slots.filter(s => 
                  s.status === 'booked' &&
                  s.bookedBy === client.name && 
                  (s.date > nowString || (s.date === nowString && s.time >= nowTime))
                );
                const hasAppointment = clientAppointments.length > 0;
                
                const notifiedSlots = slots.filter(s => 
                  s.status === 'open' && 
                  s.notifiedClients?.includes(client.id)
                );
                const isNotified = notifiedSlots.length > 0;
                return (
                <tr 
                  key={client.id} 
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedClientAppointments(clientAppointments);
                    setSelectedClientNotifiedSlots(notifiedSlots);
                    setIsAppointmentModalOpen(true);
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-deep-blue dark:text-white text-base">{client.name}</div>
                    <div className="text-gray-500 dark:text-gray-400">{client.phone}</div>
                    {isNotified && (
                      <div className="sm:hidden mt-2">
                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                          <Clock className="w-2.5 h-2.5 mr-1" /> Gemeldet
                        </span>
                      </div>
                    )}
                    <div className="sm:hidden mt-2 flex flex-wrap gap-1">
                      {client.serviceTypes.slice(0, 2).map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded">
                          {s}
                        </span>
                      ))}
                      {client.serviceTypes.length > 2 && <span className="text-[10px] text-gray-400">+{client.serviceTypes.length - 2}</span>}
                    </div>
                    <div className="sm:hidden mt-1 flex items-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {client.preferredTimes.length > 0 ? client.preferredTimes.join(", ") : "Alle Zeiten"}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto scrollbar-thin">
                      {client.serviceTypes.slice(0, 5).map((s: string) => (
                        <span key={s} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded">
                          {s}
                        </span>
                      ))}
                      {client.serviceTypes.length > 5 && (
                        <span className="text-xs text-gray-400">+{client.serviceTypes.length - 5}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="flex items-center text-gray-600 dark:text-gray-400 font-medium">
                      {client.preferredTimes.length > 0 ? client.preferredTimes.join(", ") : "Alle Zeiten"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {isNotified ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                          <Clock className="w-2.5 h-2.5 mr-1" /> Gemeldet
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-800 text-gray-500 border border-transparent">
                          Inaktiv
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${hasAppointment ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                      {hasAppointment ? 'Ja' : 'Nein'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(client);
                        }}
                        className="text-gray-400 hover:text-deep-blue dark:hover:text-white p-2 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(client);
                        }}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {clients.length === 0 ? "Keine Kunden vorhanden. Füge deinen ersten Kunden hinzu!" : "Keine Kunden entsprechen den Suchkriterien."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditMode ? "Kunde bearbeiten" : "Kunde hinzufügen"}
        headerClassName="bg-deep-blue"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Max Mustermann"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Telefon</label>
            <Input 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 000 000000"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistungen</label>
            <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
              <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                <Input
                  placeholder="Dienstleistung suchen..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[200px]">
                {[...business?.serviceTypes || []]
                  .filter(s => s.toLowerCase().startsWith(serviceSearch.toLowerCase()))
                  .sort((a, b) => a.localeCompare(b))
                  .map((service: string) => (
                  <label key={service} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service)}
                      onChange={() => toggleService(service)}
                      className="accent-accent shrink-0"
                    />
                    <span className="truncate">{service}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 p-2 mt-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isCustomService}
                onChange={() => setIsCustomService(!isCustomService)}
                className="accent-accent shrink-0"
              />
              <span className="truncate">Individuell...</span>
            </label>
            {isCustomService && renderCustomServicesList()}
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Bevorzugte Zeit</label>
            <div className="grid grid-cols-3 gap-2">
              {['Vormittag', 'Nachmittag', 'Abend'].map((time) => (
                <button
                  key={time}
                  onClick={() => toggleTime(time)}
                  className={`p-2 rounded-lg text-xs font-bold uppercase tracking-wider text-center transition-colors ${
                    selectedTimes.includes(time) 
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-800/50' 
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg p-4 flex items-start gap-3">
            <input 
              type="checkbox" 
              id="consent" 
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-accent focus:ring-accent"
            />
            <label htmlFor="consent" className="text-sm text-gray-600 dark:text-gray-400 leading-tight">
              Kunde hat der <span className="font-bold text-deep-blue dark:text-white border-b-2 border-accent">SMS-Benachrichtigung</span> und der Verarbeitung seiner Daten gemäß DSGVO ausdrücklich zugestimmt.
            </label>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold disabled:opacity-50" 
              onClick={handleSaveClient}
              disabled={isSubmitting || !name || !phone || !consentGiven}
            >
              {isSubmitting ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Kunde löschen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diesen Kunden wirklich löschen?</p>
              <p className="text-sm opacity-90">
                {clientToDelete?.name} wird unwiderruflich aus der Datenbank entfernt.
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={handleDeleteClient}
            >
              Endgültig löschen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isAppointmentModalOpen} 
        onClose={() => setIsAppointmentModalOpen(false)} 
        title="Termindetails"
        headerClassName="bg-indigo-500"
      >
        <div className="space-y-6">
          {selectedClientNotifiedSlots.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Gemeldete freie Termine
              </h4>
              <div className="space-y-2">
                {selectedClientNotifiedSlots.map((slot, index) => (
                  <div key={index} className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-lg">
                    <div className="font-bold text-orange-900 dark:text-orange-300 text-sm mb-1">{slot.serviceType}</div>
                    <div className="flex gap-4 text-xs text-orange-800 dark:text-orange-400">
                      <span>{format(new Date(slot.date), 'dd.MM.yyyy')}</span>
                      <span>{slot.time} Uhr</span>
                      {slot.employeeName && <span>{slot.employeeName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Gebuchte Termine
            </h4>
            {selectedClientAppointments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg border border-dashed border-gray-200 dark:border-slate-700">Dieser Kunde hat aktuell keine festen Termine.</p>
            ) : (
              <div className="space-y-3">
                {selectedClientAppointments.map((slot, index) => (
                <div 
                  key={index} 
                  className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group"
                  onClick={() => handleEditSlot(slot)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-deep-blue dark:text-white">{slot.serviceType}</div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSlot(slot);
                        }}
                        className="p-1 text-gray-400 hover:text-accent"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSlot(slot.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 w-16 shrink-0">Datum:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{slot.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 w-16 shrink-0">Uhrzeit:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{slot.time} Uhr</span>
                    </div>
                    {slot.employeeName && (
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">Mitarbeiter:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{slot.employeeName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pt-4">
            <Button variant="outline" className="w-full dark:border-slate-700 dark:text-white" onClick={() => setIsAppointmentModalOpen(false)}>Schließen</Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isDeleteAppointmentModalOpen} onClose={() => setIsDeleteAppointmentModalOpen(false)} title="Termin löschen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diesen Termin wirklich löschen?</p>
              <p className="text-sm opacity-90">
                Der Termin wird unwiderruflich aus der Datenbank entfernt.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteAppointmentModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" 
              onClick={confirmDeleteSlot}
            >
              Endgültig löschen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isEditSlotModalOpen} 
        onClose={() => {
          setIsEditSlotModalOpen(false);
          setIsCustomSlotService(false);
          setCustomSlotService("");
        }} 
        title="Termin bearbeiten"
        headerClassName="bg-deep-blue"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Datum</label>
            <Input 
              type="date" 
              value={newSlotDate} 
              onChange={(e) => setNewSlotDate(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Uhrzeit</label>
              <Input 
                type="time" 
                value={newSlotTime} 
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter (Optional)</label>
              <button
                type="button"
                onClick={() => setIsSlotEmployeeDropdownOpen(!isSlotEmployeeDropdownOpen)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium dark:text-white"
              >
                <span>{newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee)?.name : "Kein spezifischer Mitarbeiter"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isSlotEmployeeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSlotEmployeeDropdownOpen && (
                <div className="mt-2 flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin">
                  <button
                    onClick={() => { setNewSlotEmployee(""); setIsSlotEmployeeDropdownOpen(false); }}
                    className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors border-2 ${
                      newSlotEmployee === "" 
                        ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Kein spezifischer Mitarbeiter
                  </button>
                  {[...business?.employees || []].sort((a, b) => a.name.localeCompare(b)).map((emp: any) => (
                    <button
                      key={emp.id}
                      onClick={() => { setNewSlotEmployee(emp.id); setIsSlotEmployeeDropdownOpen(false); }}
                      className={`p-3 rounded-lg text-sm font-medium text-left transition-colors border-2 ${
                        newSlotEmployee === emp.id 
                          ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {emp.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistung</label>
            <button
              type="button"
              onClick={() => setIsSlotServiceDropdownOpen(!isSlotServiceDropdownOpen)}
              className="flex items-center justify-between w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium dark:text-white mb-2"
            >
              <span>{isCustomSlotService ? "Individuell..." : (newSlotService || "Dienstleistung auswählen")}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isSlotServiceDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSlotServiceDropdownOpen && (
              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin mb-2">
                {[...business?.serviceTypes || []].sort((a, b) => a.localeCompare(b)).map((service: string) => (
                  <button
                    key={service}
                    onClick={() => {
                      setIsCustomSlotService(false);
                      setNewSlotService(service);
                      setIsSlotServiceDropdownOpen(false);
                    }}
                    className={`p-3 rounded-lg text-sm font-medium text-left transition-colors border-2 ${
                      !isCustomSlotService && newSlotService === service 
                        ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {service}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setIsCustomSlotService(true);
                    setIsSlotServiceDropdownOpen(false);
                  }}
                  className={`w-full p-3 rounded-lg text-sm font-medium text-left transition-colors border-2 ${
                    isCustomSlotService 
                      ? 'bg-accent/20 text-deep-blue dark:text-white border-accent' 
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Individuell...
                </button>
              </div>
            )}
            {isCustomSlotService && (
              <Input 
                placeholder="Eigene Dienstleistung..." 
                value={customSlotService}
                onChange={(e) => setCustomSlotService(e.target.value)}
                className="mt-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsEditSlotModalOpen(false)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold disabled:opacity-50" 
              onClick={handleSaveSlot}
              disabled={isSavingSlot || !newSlotDate || !newSlotTime || (!isCustomSlotService && !newSlotService) || (isCustomSlotService && !customSlotService.trim())}
            >
              {isSavingSlot ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
