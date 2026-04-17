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
import { Calendar, CheckCircle, Users, Plus, MoreVertical, Edit2, Trash2, AlertTriangle, Calendar as CalendarIcon, Clock, ChevronDown, X } from "lucide-react";
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
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [isCustomFreeService, setIsCustomFreeService] = useState(false);
  const [customFreeService, setCustomFreeService] = useState("");
  const [customFreeServices, setCustomFreeServices] = useState<string[]>([]);
  const [isCustomNotifyService, setIsCustomNotifyService] = useState(false);
  const [customNotifyService, setCustomNotifyService] = useState("");
  const [customNotifyServices, setCustomNotifyServices] = useState<string[]>([]);
  
  const [editingCustomIndex, setEditingCustomIndex] = useState<{type: 'booked' | 'free' | 'notify', index: number} | null>(null);
  const [editingCustomValue, setEditingCustomValue] = useState("");

  const [confirmDeleteCustomIndex, setConfirmDeleteCustomIndex] = useState<{type: 'booked' | 'free' | 'notify', index: number} | null>(null);

  const renderCustomServicesList = (type: 'booked' | 'free' | 'notify') => {
    const list = type === 'booked' ? customServices : type === 'free' ? customFreeServices : customNotifyServices;
    const setList = type === 'booked' ? setCustomServices : type === 'free' ? setCustomFreeServices : setCustomNotifyServices;
    const input = type === 'booked' ? customService : type === 'free' ? customFreeService : customNotifyService;
    const setInput = type === 'booked' ? setCustomService : type === 'free' ? setCustomFreeService : setCustomNotifyService;

    const addService = () => {
      if (input.trim()) {
        setList([...list, input.trim()]);
        setInput("");
      }
    };

    const removeService = (index: number) => {
      setList(list.filter((_, i) => i !== index));
      setConfirmDeleteCustomIndex(null);
    };

    const startEdit = (index: number) => {
      setEditingCustomIndex({ type, index });
      setEditingCustomValue(list[index]);
      setConfirmDeleteCustomIndex(null);
    };

    const saveEdit = () => {
      if (editingCustomIndex && editingCustomValue.trim()) {
        const newList = [...list];
        newList[editingCustomIndex.index] = editingCustomValue.trim();
        setList(newList);
        setEditingCustomIndex(null);
        setEditingCustomValue("");
      }
    };

    return (
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <Input 
            placeholder="Eigene Dienstleistung..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
        
        {list.length > 0 && (
          <div className="space-y-1 mt-2">
            {list.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {editingCustomIndex?.type === type && editingCustomIndex?.index === index ? (
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
                ) : confirmDeleteCustomIndex?.type === type && confirmDeleteCustomIndex?.index === index ? (
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
                      <button onClick={() => setConfirmDeleteCustomIndex({ type, index })} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
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

  const [notifiedFilterEmployee, setNotifiedFilterEmployee] = useState("");
  const [notifiedFilterClient, setNotifiedFilterClient] = useState("");
  const [notifiedFilterDate, setNotifiedFilterDate] = useState("");

  const [isFreeSlotsModalOpen, setIsFreeSlotsModalOpen] = useState(false);
  const [isBookedSlotsModalOpen, setIsBookedSlotsModalOpen] = useState(false);
  const [bookedFilterEmployee, setBookedFilterEmployee] = useState("");
  const [bookedFilterService, setBookedFilterService] = useState("");
  const [isCreateFreeSlotModalOpen, setIsCreateFreeSlotModalOpen] = useState(false);
  const [newSlotServices, setNewSlotServices] = useState<string[]>([]);
  const [isManualBooking, setIsManualBooking] = useState(false);
  const [slotToManuallyBook, setSlotToManuallyBook] = useState<any>(null);
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
        const localNowString = `${format(now, 'yyyy-MM-dd')}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const futureAppointments = slots.filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString);

        const filteredClients = allActiveClients.filter((client: any) => {
          // Requirement: Only clients with existing future appointments
          const hasFutureAppointment = futureAppointments.some(s => s.bookedBy === client.name);
          if (!hasFutureAppointment) return false;

          const matchesService = newSlotServices.length === 0 || 
            !client.serviceTypes || client.serviceTypes.length === 0 ||
            client.serviceTypes?.some((s: string) => newSlotServices.includes(s));
          return matchesService;
        });

        // Add priority info
        const clientsWithPriority = filteredClients.map((client: any) => {
          const clientAppts = futureAppointments.filter(s => s.bookedBy === client.name);
          
          let isPriority = false;
          if (newSlotDate) {
            const slotDate = new Date(newSlotDate);
            isPriority = clientAppts.some(appt => {
              const apptDate = new Date(appt.date);
              const diffTime = Math.abs(apptDate.getTime() - slotDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 7;
            });
          }
          
          return { ...client, isPriority };
        });

        setMatchingClients(clientsWithPriority);
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
            // Use a simple POST with text/plain to avoid CORS preflight if the worker is sensitive
            // or ensure trailing slash is present
            await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
              method: "POST",
              mode: "cors",
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

  useEffect(() => {
    if (isModalOpen && newSlotTime) {
      setTimeout(() => {
        const element = document.getElementById(`time-slot-${newSlotTime.replace(':', '-')}`);
        if (element) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isModalOpen, newSlotTime]);

  useEffect(() => {
    if (isCreateFreeSlotModalOpen && newSlotTime) {
      setTimeout(() => {
        const element = document.getElementById(`free-time-slot-${newSlotTime.replace(':', '-')}`);
        if (element) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isCreateFreeSlotModalOpen, newSlotTime]);

  const handleCreateFreeSlot = async () => {
    const allServices = [...newSlotServices];
    if (isCustomFreeService && customFreeService.trim()) {
      allServices.push(customFreeService.trim());
    }
    const finalServices = [...allServices, ...customFreeServices].filter(Boolean);

    if (!businessId || !newSlotDate || !newSlotTime) return;
    setIsSubmitting(true);

    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    
    let serviceTypeString = "";
    if (finalServices && finalServices.length > 0) {
      serviceTypeString = finalServices.join(", ");
    }
    if (employee) {
      serviceTypeString += serviceTypeString ? ` bei ${employee.name}` : `Bei ${employee.name}`;
    }
    if (!serviceTypeString) {
      serviceTypeString = "Freier Termin";
    }

    try {
      await runTransaction(db, async (transaction) => {
        // Double check server-side if this employee already has a slot at this time
        const slotsQuery = query(
          collection(db, `businesses/${businessId}/slots`),
          where("date", "==", newSlotDate),
          where("time", "==", newSlotTime)
        );
        const snapshot = await getDocs(slotsQuery);
        const existingSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (newSlotEmployee) {
          const employeeConflict = existingSlots.find((s: any) => s.employeeId === newSlotEmployee);
          if (employeeConflict) {
            throw new Error("Dieser Mitarbeiter hat zu der gewählten Zeit bereits einen Eintrag (Termin oder freien Platz).");
          }
        }

        const newSlotRef = doc(collection(db, `businesses/${businessId}/slots`));
        const newSlotId = newSlotRef.id;
        transaction.set(newSlotRef, {
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
        (window as any).__lastCreatedSlotId = newSlotId;
      });

      const lastSlotId = (window as any).__lastCreatedSlotId;
      if (lastSlotId) {
        try {
          const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              slotId: lastSlotId,
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
          } else {
            console.warn("Worker response not ok:", response.status);
          }
        } catch (workerErr) {
          console.error("Error calling worker", workerErr);
          // If it's a "Failed to fetch", it's usually CORS or network.
          // We show a more helpful message.
          setWorkerError("Der Termin wurde erstellt, aber die automatische Benachrichtigung konnte nicht ausgelöst werden (Netzwerkfehler).");
        }
      }

      setIsCreateFreeSlotModalOpen(false);
      setNewSlotServices([]);
      setIsCustomFreeService(false);
      setCustomFreeService("");
      setCustomFreeServices([]);
    } catch (error: any) {
      console.error("Error creating free slot", error);
      setWorkerError(error.message || "Fehler beim Erstellen des freien Termins.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBookedSlot = async () => {
    const employee = newSlotEmployee ? business?.employees?.find((e: any) => e.id === newSlotEmployee) : null;
    
    const allServices = [...newSlotServices];
    if (isCustomService && customService.trim()) {
      allServices.push(customService.trim());
    }
    const combinedCustomServices = [...customServices];
    const finalServices = [...allServices, ...combinedCustomServices].filter(Boolean).join(", ");

    if (!businessId || !newSlotDate || !newSlotTime || !finalServices || !clientName) return;
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        // Double check server-side if this slot is still available for the specific employee
        const slotsQuery = query(
          collection(db, `businesses/${businessId}/slots`),
          where("date", "==", newSlotDate),
          where("time", "==", newSlotTime),
          where("status", "==", "booked")
        );
        const snapshot = await getDocs(slotsQuery);
        const bookedSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check if the specific employee already has a booking
        if (newSlotEmployee) {
          const employeeConflict = bookedSlots.find((s: any) => s.employeeId === newSlotEmployee && s.id !== editingSlotId);
          if (employeeConflict) {
            throw new Error("Dieser Mitarbeiter hat zu der gewählten Zeit bereits einen Termin.");
          }
        }

        // Check overall capacity if no employee is selected (or just skip if business rules allow multiple bookings)
        const capacity = getCapacityForTime(newSlotTime, newSlotDate);
        if (bookedSlots.length >= capacity && !editingSlotId) {
          throw new Error("Zu dieser Zeit ist die maximale Kapazität bereits erreicht.");
        }

        if (isEditMode && editingSlotId) {
          transaction.update(doc(db, `businesses/${businessId}/slots`, editingSlotId), {
            date: newSlotDate,
            time: newSlotTime,
            serviceType: finalServices,
            employeeId: newSlotEmployee || null,
            employeeName: employee?.name || "",
            bookedBy: clientName,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Check for existing open slot to "consume"
          const openSlotsQuery = query(
            collection(db, `businesses/${businessId}/slots`),
            where("date", "==", newSlotDate),
            where("time", "==", newSlotTime),
            where("status", "==", "open")
          );
          const openSnapshot = await getDocs(openSlotsQuery);
          const existingOpenSlot = openSnapshot.docs.find(d => {
            const data = d.data();
            return !newSlotEmployee || data.employeeId === newSlotEmployee || !data.employeeId;
          });

          if (existingOpenSlot) {
            transaction.update(existingOpenSlot.ref, {
              status: "booked",
              bookedBy: clientName,
              bookedAt: new Date().toISOString(),
              serviceType: finalServices,
              employeeId: newSlotEmployee || null,
              employeeName: employee?.name || null
            });
          } else {
            const newSlotRef = doc(collection(db, `businesses/${businessId}/slots`));
            transaction.set(newSlotRef, {
              date: newSlotDate,
              time: newSlotTime,
              serviceType: finalServices,
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
      });

      // Rest of the logic (deleting future appointments etc.) stays the same but after transaction
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
      setCustomServices([]);
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
    
    const allServices = slot.serviceType ? slot.serviceType.split(", ") : [];
    const employee = business?.employees?.find((e: any) => e.id === slot.employeeId);
    const availableServices = employee?.serviceTypes || business?.serviceTypes || [];
    
    const standard = allServices.filter((s: string) => availableServices.includes(s));
    const custom = allServices.filter((s: string) => !availableServices.includes(s));
    
    setNewSlotServices(standard);
    setCustomServices(custom);
    setIsCustomService(custom.length > 0);
    setCustomService("");
    
    setNewSlotEmployee(slot.employeeId || "");
    setClientName(slot.bookedBy);
    setIsModalOpen(true);
  };

  const handleNotifyMoreClients = async () => {
    const allServices = additionalServiceType ? additionalServiceType.split(', ') : [];
    if (isCustomNotifyService && customNotifyService.trim()) {
      allServices.push(customNotifyService.trim());
    }
    const combinedCustomServices = [...customNotifyServices];
    const finalServices = [...allServices, ...combinedCustomServices].filter(Boolean).join(', ');

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
      const response = await fetch("https://slotfiller-notifier.nahbar.workers.dev/", {
        method: "POST",
        mode: "cors",
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
      setCustomNotifyServices([]);
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

  const openNotifiedClientsModalForSlot = useCallback((slot: any) => {
    setSelectedOpenSlot(slot);
    setNotifiedFilterDate(slot.date);
    setNotifiedFilterEmployee(slot.employeeName || "");
    setNotifiedFilterClient("");
    setIsNotifiedClientsModalOpen(true);
  }, []);

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
            setNewSlotServices([]);
            setNewSlotEmployee("");
            setIsModalOpen(true);
          }} 
          className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
        >
          <Plus className="mr-2 h-5 w-5" /> Termin eintragen
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
      </div>

      <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 dark:bg-slate-800/50 shrink-0">
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
                            setIsManualBooking(true);
                            setNewSlotDate(slot.date);
                            setNewSlotTime(slot.time);
                            setNewSlotServices([]);
                            setNewSlotEmployee("");
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
                          setNewSlotServices([]);
                          setNewSlotEmployee("");
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
                          setNewSlotServices([]);
                          setNewSlotEmployee("");
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

      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setIsEditMode(false);
        setEditingSlotId(null);
        setIsCustomService(false);
        setCustomService("");
      }} 
      title={isEditMode ? "Termin bearbeiten" : "Termin eintragen"}
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

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Uhrzeit</label>
            <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[200px] p-1 scrollbar-thin">
              {timeSlots.map((time) => {
                const timeSlotsData = slots.filter(s => s.date === newSlotDate && s.time === time);
                const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
                const capacity = getCapacityForTime(time, newSlotDate);
                const remainingCapacity = capacity - bookedCount;
                
                return (
                  <button
                    key={time}
                    id={`time-slot-${time.replace(':', '-')}`}
                    onClick={() => setNewSlotTime(time)}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                      newSlotTime === time 
                        ? 'bg-accent/20 text-deep-blue dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{time}</span>
                      <span className={`text-[10px] font-bold ${remainingCapacity > 0 ? 'text-accent' : 'text-red-500'}`}>
                        {remainingCapacity}/{capacity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-8">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
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
                  .filter(e => e.name.toLowerCase().startsWith(slotEmployeeSearch.toLowerCase()))
                  .filter(e => {
                    const isBooked = slots.some(s => 
                      s.date === newSlotDate && 
                      s.time === newSlotTime && 
                      s.status === 'booked' && 
                      s.employeeId === e.id &&
                      s.id !== editingSlotId
                    );
                    return !isBooked;
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
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

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistung</label>
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
                {(() => {
                  const employee = business?.employees?.find((e: any) => e.id === newSlotEmployee);
                  const availableServices = employee?.serviceTypes || business?.serviceTypes || [];
                  return [...availableServices]
                    .filter(s => s.toLowerCase().startsWith(slotServiceSearch.toLowerCase()))
                    .sort((a, b) => a.localeCompare(b))
                    .map((service: string) => (
                    <label
                      key={service}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newSlotServices.includes(service)}
                        onChange={() => {
                          if (newSlotServices.includes(service)) {
                            setNewSlotServices(newSlotServices.filter(s => s !== service));
                          } else {
                            setNewSlotServices([...newSlotServices, service]);
                          }
                        }}
                        className="accent-accent"
                      />
                      <span>{service}</span>
                    </label>
                  ));
                })()}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                  <label className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCustomService}
                      onChange={() => setIsCustomService(!isCustomService)}
                      className="accent-accent"
                    />
                    <span>Individuell...</span>
                  </label>
              </div>
            </div>
            {isCustomService && renderCustomServicesList('booked')}
          </div>

          <div className="space-y-3 mt-8">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Name des Kunden</label>
            <Input 
              placeholder="Kunde suchen oder Name eingeben..." 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {clients
                .filter(c => c.name.toLowerCase().startsWith(clientName.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((client: any) => (
                <div 
                  key={client.id}
                  onClick={() => setClientName(client.name)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${clientName === client.name ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${clientName === client.name ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                    {clientName === client.name && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                  </div>
                </div>
              ))}
              {clients.filter(c => c.name.toLowerCase().startsWith(clientName.toLowerCase())).length === 0 && (
                <div className="px-3 py-4 text-sm text-center text-gray-400">Kein Kunde gefunden</div>
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

      <Modal 
        isOpen={isNotifiedClientsModalOpen} 
        onClose={() => setIsNotifiedClientsModalOpen(false)} 
        title="Gemeldete Termine"
        headerClassName="bg-orange-500"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Users className="h-4 w-4" />
              </span>
              <Input 
                placeholder="Mitarbeiter..." 
                value={notifiedFilterEmployee}
                onChange={(e) => setNotifiedFilterEmployee(e.target.value)}
                className="h-10 text-sm pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Users className="h-4 w-4" />
              </span>
              <Input 
                placeholder="Kunde..." 
                value={notifiedFilterClient}
                onChange={(e) => setNotifiedFilterClient(e.target.value)}
                className="h-10 text-sm pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div>
              <Input 
                type="date"
                value={notifiedFilterDate}
                onChange={(e) => setNotifiedFilterDate(e.target.value)}
                className="h-10 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
            {filteredReportedSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">Keine gemeldeten Termine</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Passe deine Filter an oder melde neue freie Slots.</p>
              </div>
            ) : (
              filteredReportedSlots.map((slot) => (
                <div key={slot.id} className="group relative bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/50 transition-all">
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
          {selectedOpenSlot && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button 
                className="w-full bg-accent text-white hover:bg-accent-hover font-bold"
                onClick={() => {
                  setIsNotifiedClientsModalOpen(false);
                  setAdditionalClients([]);
                  setClientSearch("");
                  setAdditionalEmployeeId(selectedOpenSlot?.employeeId || "");
                  setAdditionalServiceType("");
                  setIsNotifyMoreModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Weitere Kunden benachrichtigen
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal 
        isOpen={isNotifyMoreModalOpen} 
        onClose={() => {
          setIsNotifyMoreModalOpen(false);
          setIsCustomNotifyService(false);
          setCustomNotifyService("");
          setSlotServiceSearch("");
          setSlotEmployeeSearch("");
        }} 
        title="Weitere Kunden benachrichtigen"
        headerClassName="bg-accent"
      >
        <div className="space-y-6">
          <div className="mb-6">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium text-deep-blue dark:text-white">
              {selectedOpenSlot?.employeeName || "Kein Mitarbeiter ausgewählt"}
            </div>
          </div>

          <div className="mt-8">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistungen</label>
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
                {(() => {
                  const employee = business?.employees?.find((e: any) => e.id === additionalEmployeeId);
                  const availableServices = employee?.serviceTypes || business?.serviceTypes || [];
                  return [...availableServices]
                    .filter(s => s.toLowerCase().startsWith(slotServiceSearch.toLowerCase()))
                    .sort((a, b) => a.localeCompare(b))
                    .map((service: string) => (
                    <label
                      key={service}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={additionalServiceType.split(', ').includes(service)}
                        onChange={() => {
                          const services = additionalServiceType ? additionalServiceType.split(', ').filter(Boolean) : [];
                          if (services.includes(service)) {
                            setAdditionalServiceType(services.filter(s => s !== service).join(', '));
                          } else {
                            setAdditionalServiceType([...services, service].join(', '));
                          }
                        }}
                        className="accent-accent"
                      />
                      <span>{service}</span>
                    </label>
                  ));
                })()}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                  <label className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCustomNotifyService}
                      onChange={() => setIsCustomNotifyService(!isCustomNotifyService)}
                      className="accent-accent"
                    />
                    <span>Individuell...</span>
                  </label>
              </div>
            </div>
            {isCustomNotifyService && renderCustomServicesList('notify')}
          </div>

          <div className="space-y-3">
            <Input 
              placeholder="Kunden suchen..." 
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
                {(() => {
                  const now = new Date();
                  const localNowString = `${format(now, 'yyyy-MM-dd')}T${format(now, 'HH:mm')}`;
                  const futureAppointments = slots.filter(s => s.status === 'booked' && `${s.date}T${s.time}` >= localNowString);
                  const selectedServices = additionalServiceType ? additionalServiceType.split(', ').filter(Boolean) : [];
                  
                  const available = clients.filter(c => {
                    const hasFutureAppointment = futureAppointments.some(s => s.bookedBy === c.name);
                    return c.active !== false && 
                      hasFutureAppointment &&
                      !(selectedOpenSlot?.notifiedClients || []).includes(c.id) &&
                      (selectedServices.length === 0 || selectedServices.some(s => c.serviceTypes?.includes(s)));
                  });

                  const withPriority = available.map(c => {
                    const clientAppts = futureAppointments.filter(s => s.bookedBy === c.name);
                    let isPriority = false;
                    if (selectedOpenSlot?.date) {
                      const slotDate = new Date(selectedOpenSlot.date);
                      isPriority = clientAppts.some(appt => {
                        const apptDate = new Date(appt.date);
                        const diffTime = Math.abs(apptDate.getTime() - slotDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 7;
                      });
                    }
                    return { ...c, isPriority };
                  });

                  const filtered = withPriority
                    .filter(c => c.name.toLowerCase().startsWith(clientSearch.toLowerCase()) || 
                                c.phone?.toLowerCase().startsWith(clientSearch.toLowerCase()))
                    .sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));

                  return (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">
                          Verfügbare Kunden ({available.length})
                          <span className="ml-2 text-[10px] text-accent lowercase font-normal italic">
                            (Nur Kunden mit Terminen)
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const priorityIds = withPriority.filter(c => c.isPriority).map(c => c.id);
                              setAdditionalClients(prev => {
                                const allSelected = priorityIds.every(id => prev.includes(id));
                                if (allSelected) return prev.filter(id => !priorityIds.includes(id));
                                return Array.from(new Set([...prev, ...priorityIds]));
                              });
                            }}
                            className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
                          >
                            Priorisierte wählen
                          </button>
                          <button 
                            onClick={() => {
                              setAdditionalClients(additionalClients.length === available.length ? [] : available.map(c => c.id));
                            }}
                            className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline border-l border-gray-200 dark:border-slate-700 pl-2"
                          >
                            {additionalClients.length === available.length ? 'Alle abwählen' : 'Alle auswählen'}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
                        {filtered.map(client => (
                          <div 
                            key={client.id}
                            onClick={() => setAdditionalClients(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}
                            className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${additionalClients.includes(client.id) ? 'bg-accent/5' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${additionalClients.includes(client.id) ? 'bg-accent border-accent' : 'border-gray-300 dark:border-slate-700'}`}>
                              {additionalClients.includes(client.id) && <div className="w-1.5 h-1.5 bg-deep-blue rounded-full" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                                {client.isPriority && (
                                  <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-bold uppercase tracking-tight">Priorität</span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">{client.phone}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
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

      <Modal 
        isOpen={isFreeSlotsModalOpen} 
        onClose={() => setIsFreeSlotsModalOpen(false)} 
        title="Freie Plätze heute"
        headerClassName="bg-indigo-500"
      >
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
                      setNewSlotServices([]);
                      setNewSlotEmployee("");
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
                      setNewSlotServices([]);
                      setNewSlotEmployee("");
                      setIsFreeSlotsModalOpen(false);
                      setIsCreateFreeSlotModalOpen(true);
                    }}
                  >
                    <span className="text-xs font-bold flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> Termin melden
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
      }} 
      title="Termin melden"
      headerClassName="bg-accent"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Datum</label>
            <Input 
              type="date" 
              value={newSlotDate} 
              onChange={(e) => setNewSlotDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Uhrzeit</label>
            <div className="overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 max-h-[200px] p-1 scrollbar-thin">
              {generateTimeSlots().map((time) => {
                const timeSlotsData = slots.filter(s => s.date === newSlotDate && s.time === time);
                const bookedCount = timeSlotsData.filter(s => s.status === 'booked').length;
                const capacity = getCapacityForTime(time, newSlotDate);
                const remainingCapacity = capacity - bookedCount;
                
                return (
                  <button
                    key={time}
                    id={`free-time-slot-${time.replace(':', '-')}`}
                    onClick={() => setNewSlotTime(time)}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                      newSlotTime === time 
                        ? 'bg-accent/20 text-deep-blue dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{time}</span>
                      <span className={`text-[10px] font-bold ${remainingCapacity > 0 ? 'text-accent' : 'text-red-500'}`}>
                        {remainingCapacity}/{capacity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Mitarbeiter</label>
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
                  .filter(e => e.name.toLowerCase().startsWith(slotEmployeeSearch.toLowerCase()))
                  .filter(e => {
                    const hasSlot = slots.some(s => 
                      s.date === newSlotDate && 
                      s.time === newSlotTime && 
                      s.employeeId === e.id &&
                      s.id !== editingSlotId
                    );
                    return !hasSlot;
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
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

          <div className="mt-8">
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Dienstleistungen</label>
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
                {(() => {
                  const employee = business?.employees?.find((e: any) => e.id === newSlotEmployee);
                  const availableServices = employee?.serviceTypes || business?.serviceTypes || [];
                  return [...availableServices]
                    .filter(s => s.toLowerCase().startsWith(slotServiceSearch.toLowerCase()))
                    .sort((a, b) => a.localeCompare(b))
                    .map((service: string) => (
                    <label
                      key={service}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newSlotServices.includes(service)}
                        onChange={() => {
                          if (newSlotServices.includes(service)) {
                            setNewSlotServices(newSlotServices.filter(s => s !== service));
                          } else {
                            setNewSlotServices([...newSlotServices, service]);
                          }
                        }}
                        className="accent-accent"
                      />
                      <span>{service}</span>
                    </label>
                  ));
                })()}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                  <label className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCustomFreeService}
                      onChange={() => setIsCustomFreeService(!isCustomFreeService)}
                      className="accent-accent"
                    />
                    <span>Individuell...</span>
                  </label>
              </div>
            </div>
            {isCustomFreeService && renderCustomServicesList('free')}
          </div>

          <div className="space-y-3">
            <Input 
              placeholder="Kunden suchen..." 
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">
                Passende Kunden ({matchingClients.length})
                <span className="ml-2 text-[10px] text-accent lowercase font-normal italic">
                  (Nur Kunden mit Terminen)
                </span>
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const priorityIds = matchingClients.filter(c => c.isPriority).map(c => c.id);
                    setSelectedClients(prev => {
                      const allSelected = priorityIds.every(id => prev.includes(id));
                      if (allSelected) return prev.filter(id => !priorityIds.includes(id));
                      return Array.from(new Set([...prev, ...priorityIds]));
                    });
                  }}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
                >
                  Priorisierte wählen
                </button>
                <button 
                  onClick={() => setSelectedClients(selectedClients.length === matchingClients.length ? [] : matchingClients.map(c => c.id))}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline border-l border-gray-200 dark:border-slate-700 pl-2"
                >
                  {selectedClients.length === matchingClients.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {matchingClients
                .filter(c => c.name.toLowerCase().startsWith(clientSearch.toLowerCase()))
                .sort((a, b) => b.isPriority - a.isPriority)
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
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-deep-blue dark:text-white">{client.name}</div>
                      {client.isPriority && (
                        <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-bold uppercase tracking-tight">Priorität</span>
                      )}
                    </div>
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

      <Modal 
        isOpen={isBookedSlotsModalOpen} 
        onClose={() => setIsBookedSlotsModalOpen(false)} 
        title="Termine heute"
        headerClassName="bg-accent"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-1.5">Mitarbeiter Filter</label>
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
              <label className="block text-[10px] font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-1.5">Dienstleistung Filter</label>
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
