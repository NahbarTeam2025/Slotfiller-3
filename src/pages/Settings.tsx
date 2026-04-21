import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, getDocs, collection, writeBatch, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { deleteUser } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { format } from "date-fns";
import { Plus, X, MessageSquare, Save, CheckCircle2, Edit2, Trash2, AlertTriangle, ChevronDown, Sun, Moon, Settings as SettingsIcon, Search } from "lucide-react";
import { cn } from "../lib/utils";

export function Settings() {
  const { businessId, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    if (business && user) {
                              const isAdmin = (user.uid === businessId) || (business.adminEmails && business.adminEmails.some((admin: any) => 
                                (typeof admin === 'string' ? admin === user.email : admin.email === user.email)
                              ));
      if (!isAdmin) {
        navigate("/");
      }
    }
  }, [business, user, businessId, navigate]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  const DAYS = [
    { id: 'monday', label: 'Montag' },
    { id: 'tuesday', label: 'Dienstag' },
    { id: 'wednesday', label: 'Mittwoch' },
    { id: 'thursday', label: 'Donnerstag' },
    { id: 'friday', label: 'Freitag' },
    { id: 'saturday', label: 'Samstag' },
    { id: 'sunday', label: 'Sonntag' }
  ];

  const updateBusiness = async (updates: any) => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "businesses", businessId), updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating business", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    await updateBusiness({ name, openingHours });
  };

  // Form State
  const [name, setName] = useState("");
  const [openingHours, setOpeningHours] = useState<any>({
    monday: { open: "08:00", close: "18:00", closed: false },
    tuesday: { open: "08:00", close: "18:00", closed: false },
    wednesday: { open: "08:00", close: "18:00", closed: false },
    thursday: { open: "08:00", close: "18:00", closed: false },
    friday: { open: "08:00", close: "18:00", closed: false },
    saturday: { open: "08:00", close: "14:00", closed: false },
    sunday: { open: "08:00", close: "18:00", closed: true },
  });
  const [services, setServices] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [absenceSearch, setAbsenceSearch] = useState("");
  const [newService, setNewService] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [absences, setAbsences] = useState<any[]>([]);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [slotInterval, setSlotInterval] = useState("30");
  const [notificationExpiryMinutes, setNotificationExpiryMinutes] = useState("60");

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isDeleteAdminEmailModalOpen, setIsDeleteAdminEmailModalOpen] = useState(false);
  const [adminEmailToDelete, setAdminEmailToDelete] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeServices, setEmployeeServices] = useState<string[]>([]);
  const [employeeHours, setEmployeeHours] = useState<any>({
    monday: { open: "08:00", close: "18:00", closed: false },
    tuesday: { open: "08:00", close: "18:00", closed: false },
    wednesday: { open: "08:00", close: "18:00", closed: false },
    thursday: { open: "08:00", close: "18:00", closed: false },
    friday: { open: "08:00", close: "18:00", closed: false },
    saturday: { open: "08:00", close: "14:00", closed: false },
    sunday: { open: "08:00", close: "18:00", closed: true },
  });
  const [isEmployeeServiceDropdownOpen, setIsEmployeeServiceDropdownOpen] = useState(false);
  const [isCustomEmployeeService, setIsCustomEmployeeService] = useState(false);
  const [customEmployeeService, setCustomEmployeeService] = useState("");
  const [customEmployeeServices, setCustomEmployeeServices] = useState<string[]>([]);
  const [editingCustomEmployeeIndex, setEditingCustomEmployeeIndex] = useState<number | null>(null);
  const [editingCustomEmployeeValue, setEditingCustomEmployeeValue] = useState("");
  const [employeeServiceSearch, setEmployeeServiceSearch] = useState("");

  const [confirmDeleteCustomEmployeeIndex, setConfirmDeleteCustomEmployeeIndex] = useState<number | null>(null);
  const [adminEmails, setAdminEmails] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [editingAdminEmail, setEditingAdminEmail] = useState<string | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");

  const renderCustomEmployeeServicesList = () => {
    const addService = () => {
      if (customEmployeeService.trim()) {
        setCustomEmployeeServices([...customEmployeeServices, customEmployeeService.trim()]);
        setCustomEmployeeService("");
      }
    };

    const removeService = (index: number) => {
      setCustomEmployeeServices(customEmployeeServices.filter((_, i) => i !== index));
      setConfirmDeleteCustomEmployeeIndex(null);
    };

    const startEdit = (index: number) => {
      setEditingCustomEmployeeIndex(index);
      setEditingCustomEmployeeValue(customEmployeeServices[index]);
      setConfirmDeleteCustomEmployeeIndex(null);
    };

    const saveEdit = () => {
      if (editingCustomEmployeeIndex !== null && editingCustomEmployeeValue.trim()) {
        const newList = [...customEmployeeServices];
        newList[editingCustomEmployeeIndex] = editingCustomEmployeeValue.trim();
        setCustomEmployeeServices(newList);
        setEditingCustomEmployeeIndex(null);
        setEditingCustomEmployeeValue("");
      }
    };

    return (
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <Input 
            placeholder="Eigene Dienstleistung..." 
            value={customEmployeeService}
            onChange={(e) => setCustomEmployeeService(e.target.value)}
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
        
        {customEmployeeServices.length > 0 && (
          <div className="space-y-1 mt-2">
            {customEmployeeServices.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {editingCustomEmployeeIndex === index ? (
                  <div className="flex gap-2 w-full items-center">
                    <Input 
                      value={editingCustomEmployeeValue}
                      onChange={(e) => setEditingCustomEmployeeValue(e.target.value)}
                      className="h-8 text-xs flex-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          setEditingCustomEmployeeIndex(null);
                        }
                      }}
                    />
                    <button onClick={saveEdit} className="p-1 text-green-600 hover:text-green-700 transition-colors">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingCustomEmployeeIndex(null)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : confirmDeleteCustomEmployeeIndex === index ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-red-500">Wirklich löschen?</span>
                    <div className="flex gap-2">
                      <button onClick={() => removeService(index)} className="text-xs font-bold text-red-600 hover:text-red-700">Ja</button>
                      <button onClick={() => setConfirmDeleteCustomEmployeeIndex(null)} className="text-xs font-bold text-gray-500 hover:text-gray-700">Nein</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{service}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(index)} className="p-1 text-gray-400 hover:text-accent transition-colors">
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setConfirmDeleteCustomEmployeeIndex(index)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
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

  const [federalState, setFederalState] = useState("");
  const [appointmentStatusDelay, setAppointmentStatusDelay] = useState("0");
  const [dashboardEmployeeFocus, setDashboardEmployeeFocus] = useState("all");

  const [isInitialized, setIsInitialized] = useState(false);
  const [twilioPasswordInput, setTwilioPasswordInput] = useState("");
  const [isTwilioUnlocked, setIsTwilioUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState(false);

  const [isDeleteEmployeeModalOpen, setIsDeleteEmployeeModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);

  const [isDeleteAbsenceModalOpen, setIsDeleteAbsenceModalOpen] = useState(false);
  const [absenceToDelete, setAbsenceToDelete] = useState<any>(null);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [absenceData, setAbsenceData] = useState({ employeeId: "", type: "Urlaub", startDate: "", endDate: "" });
  const [absenceEmployeeSearch, setAbsenceEmployeeSearch] = useState("");
  const [isAbsenceEmployeeDropdownOpen, setIsAbsenceEmployeeDropdownOpen] = useState(false);

  const [isDeleteServiceModalOpen, setIsDeleteServiceModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editedServiceName, setEditedServiceName] = useState("");

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (!businessId || !auth.currentUser) return;
    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      // 1. Delete subcollections (slots, clients, notifications)
      const collectionsToDelete = ['slots', 'clients', 'notifications'];
      for (const coll of collectionsToDelete) {
        const snap = await getDocs(collection(db, `businesses/${businessId}/${coll}`));
        const batch = writeBatch(db);
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // 2. Delete business document
      await deleteDoc(doc(db, "businesses", businessId));

      // 3. Delete user from Firebase Auth
      await deleteUser(auth.currentUser);

      // Navigation is handled by AuthContext
    } catch (error: any) {
      console.error("Error deleting account", error);
      if (error.code === 'auth/requires-recent-login') {
        setDeleteAccountError("Um dein Konto zu löschen, musst du dich aus Sicherheitsgründen noch einmal neu einloggen.");
      } else {
        setDeleteAccountError("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleEditService = (service: string) => {
    setEditingService(service);
    setEditedServiceName(service);
  };

  const handleSaveService = async (oldName: string) => {
    if (!businessId || !editedServiceName.trim() || editedServiceName === oldName) {
      setEditingService(null);
      return;
    }
    const updatedServices = services.map(s => s === oldName ? editedServiceName.trim() : s);
    setServices(updatedServices);
    setEditingService(null);
    
    try {
      await updateDoc(doc(db, "businesses", businessId), {
        serviceTypes: updatedServices
      });
      // Optionally update clients
    } catch (error) {
      console.error("Error updating service:", error);
    }
  };

  useEffect(() => {
    if (!businessId) return;

    const unsub = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusiness(data);
        
        // Only set form state on initial load to prevent overwriting unsaved changes
        if (!isInitialized) {
          setName(data.name || "");
          if (data.openingHours) {
            setOpeningHours(data.openingHours);
          } else if (data.openTime && data.closeTime) {
            // Migration for old data
            const migrated: any = {};
            DAYS.forEach(day => {
              migrated[day.id] = { open: data.openTime, close: data.closeTime, closed: false };
            });
            setOpeningHours(migrated);
          }
          setServices(data.serviceTypes || []);
          setEmployees(data.employees || []);
          setAbsences(data.absences || []);
          setTwilioSid(data.twilioSid || "");
          setTwilioToken(data.twilioToken || "");
          setTwilioPhone(data.twilioPhone || "");
          setSlotInterval(data.slotInterval || "30");
          setNotificationExpiryMinutes(data.notificationExpiryMinutes || "60");
          setFederalState(data.federalState || "");
          setAppointmentStatusDelay(data.appointmentStatusDelay || "0");
          setDashboardEmployeeFocus(data.dashboardEmployeeFocus || "all");
          setAdminEmails(data.adminEmails || []);
          setIsInitialized(true);
        } else {
          // Keep services in sync since they can be added/removed directly
          setServices(data.serviceTypes || []);
          setEmployees(data.employees || []);
          setAbsences(data.absences || []);
        }
      }
    });

    return () => unsub();
  }, [businessId, isInitialized]);

  const handleAddService = async () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      const updatedServices = [...services, newService.trim()];
      setServices(updatedServices);
      setNewService("");
      
      if (businessId) {
        await updateDoc(doc(db, "businesses", businessId), {
          serviceTypes: updatedServices
        });
      }
    }
  };

  const handleRemoveService = async () => {
    if (!serviceToDelete || !businessId) return;
    const updatedServices = services.filter((s) => s !== serviceToDelete);
    setServices(updatedServices);
    setIsDeleteServiceModalOpen(false);
    
    try {
      // 1. Update business document
      await updateDoc(doc(db, "businesses", businessId), {
        serviceTypes: updatedServices
      });

      // 2. Update all clients who have this service
      const clientsSnap = await getDocs(collection(db, `businesses/${businessId}/clients`));
      const batch = writeBatch(db);
      let hasChanges = false;

      clientsSnap.docs.forEach(clientDoc => {
        const clientData = clientDoc.data();
        if (clientData.serviceTypes && clientData.serviceTypes.includes(serviceToDelete)) {
          const newClientServices = clientData.serviceTypes.filter((s: string) => s !== serviceToDelete);
          batch.update(clientDoc.ref, { serviceTypes: newClientServices });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error removing service and syncing clients:", error);
    } finally {
      setServiceToDelete(null);
    }
  };

  const handleAddEmployee = async () => {
    if (newEmployeeName.trim()) {
      const newEmployee = { 
        id: Date.now().toString(), 
        name: newEmployeeName.trim(),
        serviceTypes: services,
        workingHours: openingHours
      };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      setNewEmployeeName("");
      if (businessId) {
        await updateDoc(doc(db, "businesses", businessId), { employees: updatedEmployees });
      }
    }
  };

  const handleEditEmployee = (emp: any) => {
    setEditingEmployeeId(emp.id);
    setEmployeeName(emp.name);
    setEmployeePhone(emp.phone || "");
    
    const standardServices = services || [];
    const empServices = emp.serviceTypes || [];
    
    const standard = empServices.filter((s: string) => standardServices.includes(s));
    const custom = empServices.filter((s: string) => !standardServices.includes(s));
    
    setEmployeeServices(standard);
    setCustomEmployeeServices(custom);
    setIsCustomEmployeeService(custom.length > 0);
    setCustomEmployeeService("");
    setEmployeeServiceSearch("");
    
    setEmployeeHours(emp.workingHours || openingHours);
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!businessId || !employeeName.trim()) return;
    
    const allServices = [...employeeServices];
    if (isCustomEmployeeService && customEmployeeService.trim()) {
      allServices.push(customEmployeeService.trim());
    }
    const finalServices = [...allServices, ...customEmployeeServices].filter(Boolean);

    let updatedEmployees;
    if (editingEmployeeId) {
      updatedEmployees = employees.map(emp => 
        emp.id === editingEmployeeId 
          ? { ...emp, name: employeeName.trim(), phone: employeePhone.trim(), serviceTypes: finalServices, workingHours: employeeHours }
          : emp
      );
    } else {
      const newEmployee = {
        id: Date.now().toString(),
        name: employeeName.trim(),
        phone: employeePhone.trim(),
        serviceTypes: finalServices,
        workingHours: employeeHours
      };
      updatedEmployees = [...employees, newEmployee];
    }
    
    setEmployees(updatedEmployees);
    setIsEmployeeModalOpen(false);
    setIsCustomEmployeeService(false);
    setCustomEmployeeService("");
    setCustomEmployeeServices([]);
    
    await updateDoc(doc(db, "businesses", businessId), { employees: updatedEmployees });
  };

  const handleRemoveEmployee = async () => {
    if (!employeeToDelete) return;
    const updatedEmployees = employees.filter((e) => e.id !== employeeToDelete.id);
    setEmployees(updatedEmployees);
    setIsDeleteEmployeeModalOpen(false);
    setEmployeeToDelete(null);
    if (businessId) {
      await updateDoc(doc(db, "businesses", businessId), { employees: updatedEmployees });
    }
  };

  const handleRemoveAbsence = async () => {
    if (!absenceToDelete) return;
    const updatedAbsences = absences.filter((a) => a.id !== absenceToDelete.id);
    setAbsences(updatedAbsences);
    setIsDeleteAbsenceModalOpen(false);
    setAbsenceToDelete(null);
    if (businessId) {
      await updateDoc(doc(db, "businesses", businessId), { absences: updatedAbsences });
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete || !businessId) return;
    const updatedServices = services.filter((s) => s !== serviceToDelete);
    setServices(updatedServices);
    setIsDeleteServiceModalOpen(false);
    
    try {
      await updateDoc(doc(db, "businesses", businessId), { services: updatedServices });
    } catch (error) {
      console.error("Error deleting service", error);
    }
  };

  const handleEditAbsence = (abs: any) => {
    setEditingAbsenceId(abs.id);
    setAbsenceData({
      employeeId: abs.employeeId,
      type: abs.type,
      startDate: abs.startDate,
      endDate: abs.endDate
    });
    setIsAbsenceModalOpen(true);
  };

  const handleSaveAbsence = async () => {
    if (!businessId || !absenceData.employeeId || !absenceData.startDate || !absenceData.endDate) return;
    
    let updatedAbsences;
    if (editingAbsenceId) {
      updatedAbsences = absences.map(abs => 
        abs.id === editingAbsenceId 
          ? { ...abs, ...absenceData }
          : abs
      );
    } else {
      const newAbsenceEntry = {
        id: Date.now().toString(),
        ...absenceData
      };
      updatedAbsences = [...absences, newAbsenceEntry];
    }
    
    setAbsences(updatedAbsences);
    setIsAbsenceModalOpen(false);
    setEditingAbsenceId(null);
    setAbsenceData({ employeeId: "", type: "Urlaub", startDate: "", endDate: "" });
    
    await updateDoc(doc(db, "businesses", businessId), { absences: updatedAbsences });
  };

  const handleUnlockTwilio = (e: FormEvent) => {
    e.preventDefault();
    if (twilioPasswordInput === "Twilio") {
      setIsTwilioUnlocked(true);
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setTwilioPasswordInput("");
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setIsSaving(true);

    try {
      await updateDoc(doc(db, "businesses", businessId), {
        name,
        openingHours,
        serviceTypes: services,
        slotInterval,
        appointmentStatusDelay,
        twilioSid,
        twilioToken,
        twilioPhone
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!business) return <div className="p-8 dark:text-white">Lade Einstellungen...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Einstellungen & SMS</h1>
      </div>

      <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
        <div className="space-y-8">
          {/* Unternehmensprofil */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Unternehmensprofil</h3>
              {isSaving && <span className="text-[10px] font-bold text-accent animate-pulse uppercase tracking-widest">Speichert...</span>}
              {saveSuccess && <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Gespeichert</span>}
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name des Unternehmens</label>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => updateBusiness({ name })}
                  className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 text-deep-blue dark:text-white"
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Öffnungszeiten</label>
                {DAYS.map((day) => (
                  <div key={day.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                    <div className="w-24 shrink-0">
                      <span className="text-sm font-bold text-deep-blue dark:text-white">{day.label}</span>
                    </div>
                    
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center gap-2">
                        <Input 
                          type="time"
                          disabled={openingHours[day.id]?.closed}
                          value={openingHours[day.id]?.open || "08:00"} 
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], open: e.target.value}};
                            setOpeningHours(newHours);
                          }}
                          onBlur={() => updateBusiness({ openingHours })}
                          className="h-8 text-xs text-deep-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                        <span className="text-gray-400">-</span>
                        <Input 
                          type="time"
                          disabled={openingHours[day.id]?.closed}
                          value={openingHours[day.id]?.close || "18:00"} 
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], close: e.target.value}};
                            setOpeningHours(newHours);
                          }}
                          onBlur={() => updateBusiness({ openingHours })}
                          className="h-8 text-xs text-deep-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={openingHours[day.id]?.closed}
                          onChange={(e) => {
                            const newHours = {...openingHours, [day.id]: {...openingHours[day.id], closed: e.target.checked}};
                            setOpeningHours(newHours);
                            updateBusiness({ openingHours: newHours });
                          }}
                          className="rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Geschlossen</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dienstleistungen verwalten */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Dienstleistungen verwalten</h3>
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{services.length}</span>
            </div>
            <div className="mb-4">
              <Input
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Dienstleistung suchen..."
                className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {[...services]
                .sort((a, b) => a.localeCompare(b))
                .filter(s => s.toLowerCase().startsWith(serviceSearch.toLowerCase()))
                .map((service) => (
                <div key={service} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700">
                  {editingService === service ? (
                    <Input
                      value={editedServiceName}
                      onChange={(e) => setEditedServiceName(e.target.value)}
                      onBlur={() => handleSaveService(service)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveService(service)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-deep-blue dark:text-white">{service}</span>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleEditService(service)} className="text-gray-400 hover:text-accent">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => {
                      setServiceToDelete(service);
                      setIsDeleteServiceModalOpen(true);
                    }} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {services.filter(s => s.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400 uppercase tracking-widest">Keine Dienstleistung gefunden</div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
                placeholder="Weitere Dienstleistung hinzufügen..."
                className="border-dashed border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <Button onClick={handleAddService} variant="outline" className="border-dashed border-2 border-gray-200 dark:border-slate-700 text-accent hover:text-accent-hover hover:border-accent">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mitarbeiter Verwalten */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Mitarbeiter</h3>
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{employees.length}</span>
            </div>
            <div className="mb-4">
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Mitarbeiter suchen..."
                className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {[...employees]
                .sort((a, b) => a.name.localeCompare(b))
                .filter(emp => emp.name.toLowerCase().startsWith(employeeSearch.toLowerCase()))
                .map((emp) => (
                <div key={emp.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => handleEditEmployee(emp)}>
                  <div className="flex flex-col">
                    <span className="font-medium text-deep-blue dark:text-white">{emp.name}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {emp.serviceTypes && emp.serviceTypes.length > 0 ? (
                        <>
                          {emp.serviceTypes.slice(0, 2).map((s: string) => (
                            <span key={s} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded">
                              {s}
                            </span>
                          ))}
                          {emp.serviceTypes.length > 2 && (
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                              +{emp.serviceTypes.length - 2}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest">Keine Dienstleistungen</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleEditEmployee(emp); }} className="text-gray-400 hover:text-accent">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { 
                      e.stopPropagation(); 
                      setEmployeeToDelete(emp);
                      setIsDeleteEmployeeModalOpen(true);
                    }} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => {
                setEditingEmployeeId(null);
                setEmployeeName("");
                setEmployeePhone("");
                setEmployeeServices([]);
                setIsCustomEmployeeService(false);
                setCustomEmployeeService("");
                setCustomEmployeeServices([]);
                setEmployeeServiceSearch("");
                setEmployeeHours(openingHours);
                setIsEmployeeModalOpen(true);
              }} 
              className="w-full bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold"
            >
              <Plus className="h-4 w-4 mr-2" /> Mitarbeiter anlegen
            </Button>
          </div>

          {/* Kalender & Dashboard Filter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Wählen Sie einen Mitarbeiter aus, dessen Termine standardmäßig auf dem Dashboard und im Kalender angezeigt werden sollen.</p>
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              value={dashboardEmployeeFocus}
              onChange={(e) => {
                setDashboardEmployeeFocus(e.target.value);
                updateBusiness({ dashboardEmployeeFocus: e.target.value });
              }}
            >
              <option value="all">Alle Mitarbeiter anzeigen</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Abwesenheiten (Urlaub, Krankheit, Feiertage) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="mb-4">
              <Input
                value={absenceSearch}
                onChange={(e) => setAbsenceSearch(e.target.value)}
                placeholder="Abwesenheit suchen..."
                className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {[...absences]
                .sort((a, b) => {
                  const empA = employees.find(e => e.id === a.employeeId)?.name || "";
                  const empB = employees.find(e => e.id === b.employeeId)?.name || "";
                  return empA.localeCompare(empB) || a.startDate.localeCompare(b.startDate);
                })
                .filter(abs => {
                  const emp = employees.find(e => e.id === abs.employeeId);
                  const searchLower = absenceSearch.toLowerCase();
                  return (
                    emp?.name.toLowerCase().startsWith(searchLower) ||
                    abs.type.toLowerCase().startsWith(searchLower) ||
                    abs.startDate.startsWith(searchLower) ||
                    abs.endDate.startsWith(searchLower)
                  );
                })
                .map((abs) => {
                const emp = employees.find(e => e.id === abs.employeeId);
                return (
                  <div key={abs.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => handleEditAbsence(abs)}>
                    <div>
                      <span className="font-medium text-deep-blue dark:text-white block">{emp?.name || 'Unbekannt'} - {abs.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(abs.startDate), 'dd.MM.yyyy')} bis {format(new Date(abs.endDate), 'dd.MM.yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleEditAbsence(abs); }} className="text-gray-400 hover:text-accent">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setAbsenceToDelete(abs);
                        setIsDeleteAbsenceModalOpen(true);
                      }} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
              <Button 
                onClick={() => {
                  setEditingAbsenceId(null);
                  setAbsenceData({ employeeId: "", type: "Urlaub", startDate: "", endDate: "" });
                  setIsAbsenceModalOpen(true);
                }} 
                className="w-full bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold"
              >
                <Plus className="h-4 w-4 mr-2" /> Abwesenheit eintragen
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Kalender Einstellungen */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-4">Kalender Einstellungen</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Taktung der Termine (Minuten)</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  value={slotInterval}
                  onChange={(e) => {
                    setSlotInterval(e.target.value);
                    updateBusiness({ slotInterval: e.target.value });
                  }}
                >
                  <option value="5">5 Minuten</option>
                  <option value="15">15 Minuten</option>
                  <option value="30">30 Minuten</option>
                  <option value="60">60 Minuten</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Terminstatus Verzögerung (Kundenliste)</label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
                  Wie lange soll ein Termin in der Kundenliste noch als "Ja" angezeigt werden, nachdem die Uhrzeit bereits vergangen ist?
                </p>
                <select 
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  value={appointmentStatusDelay}
                  onChange={(e) => {
                    setAppointmentStatusDelay(e.target.value);
                    updateBusiness({ appointmentStatusDelay: e.target.value });
                  }}
                >
                  <option value="0">Sofort</option>
                  <option value="5">5 Minuten</option>
                  <option value="10">10 Minuten</option>
                  <option value="15">15 Minuten</option>
                  <option value="30">30 Minuten</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Benachrichtigungs-Ablaufzeit (Minuten vor Termin)</label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
                  Wie viele Minuten vor dem Termin sollen Kunden, die benachrichtigt wurden, die Info erhalten, dass der Termin nicht mehr verfügbar ist?
                </p>
                <select 
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  value={notificationExpiryMinutes}
                  onChange={(e) => {
                    setNotificationExpiryMinutes(e.target.value);
                    updateBusiness({ notificationExpiryMinutes: e.target.value });
                  }}
                >
                  <option value="15">15 Minuten</option>
                  <option value="30">30 Minuten</option>
                  <option value="60">60 Minuten (1 Stunde)</option>
                  <option value="120">120 Minuten (2 Stunden)</option>
                  <option value="1440">1440 Minuten (24 Stunden)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Feiertage (Bundesland Auswahl) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-4">Feiertage</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Wählen Sie Ihr Bundesland aus, um Feiertage automatisch im Kalender anzuzeigen.</p>
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              value={federalState}
              onChange={(e) => {
                setFederalState(e.target.value);
                updateBusiness({ federalState: e.target.value });
              }}
            >
              <option value="">Bundesland auswählen...</option>
              <option value="BW">Baden-Württemberg</option>
              <option value="BY">Bayern</option>
              <option value="BE">Berlin</option>
              <option value="BB">Brandenburg</option>
              <option value="HB">Bremen</option>
              <option value="HH">Hamburg</option>
              <option value="HE">Hessen</option>
              <option value="MV">Mecklenburg-Vorpommern</option>
              <option value="NI">Niedersachsen</option>
              <option value="NW">Nordrhein-Westfalen</option>
              <option value="RP">Rheinland-Pfalz</option>
              <option value="SL">Saarland</option>
              <option value="SN">Sachsen</option>
              <option value="ST">Sachsen-Anhalt</option>
              <option value="SH">Schleswig-Holstein</option>
              <option value="TH">Thüringen</option>
            </select>
          </div>

          {/* Aussehen (Theme) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-4">Aussehen</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Wähle dein bevorzugtes Design für die Anwendung.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => setTheme('light')}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-3 group",
                  theme === 'light' 
                    ? "border-accent bg-accent/5" 
                    : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-accent/40"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-orange-500">
                  <Sun className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-deep-blue dark:text-white">Hell</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Klassisches helles Design</p>
                </div>
                {theme === 'light' && <CheckCircle2 className="h-4 w-4 text-accent absolute top-3 right-3" />}
              </button>

              <button 
                onClick={() => setTheme('dark')}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-3 group relative",
                  theme === 'dark' 
                    ? "border-accent bg-accent/5" 
                    : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-accent/40"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 shadow-sm flex items-center justify-center text-indigo-400">
                  <Moon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-deep-blue dark:text-white">Dunkel</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Schonend für die Augen</p>
                </div>
                {theme === 'dark' && <CheckCircle2 className="h-4 w-4 text-accent absolute top-3 right-3" />}
              </button>

              <button 
                onClick={() => setTheme('system')}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-3 group relative",
                  theme === 'system' 
                    ? "border-accent bg-accent/5" 
                    : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-accent/40"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-slate-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-400">
                  <SettingsIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-deep-blue dark:text-white">System</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Folgt deinen Systemeinstellungen</p>
                </div>
                {theme === 'system' && <CheckCircle2 className="h-4 w-4 text-accent absolute top-3 right-3" />}
              </button>
            </div>
          </div>

          {/* Admin Zugriff */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 mb-6">
            <h3 className="text-xl font-bold text-deep-blue dark:text-white mb-6">Admin-Zugriff</h3>
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Administrator hinzufügen</label>
                </div>
                <div className="space-y-4 bg-gray-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Name</label>
                    <Input 
                      value={newAdminName} 
                      onChange={(e) => setNewAdminName(e.target.value)} 
                      placeholder="Name des Admins" 
                      className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">E-Mail</label>
                    <div className="flex gap-2">
                      <Input 
                        value={newAdminEmail} 
                        onChange={(e) => setNewAdminEmail(e.target.value)} 
                        placeholder="admin@firma.de" 
                        className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white flex-1" 
                      />
                      <Button onClick={() => {
                        if (newAdminEmail && newAdminName) {
                          const updatedEmails = [...adminEmails, { email: newAdminEmail, name: newAdminName }];
                          setAdminEmails(updatedEmails);
                          setNewAdminEmail("");
                          setNewAdminName("");
                          updateBusiness({ adminEmails: updatedEmails });
                        }
                      }} className="bg-accent text-white font-bold">Hinzufügen</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">Registrierte Admins</label>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{adminEmails.length}</span>
                </div>
                
                <div className="relative mb-4">
                  <Input
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Admin suchen..."
                    className="pl-8 h-9 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
                  {adminEmails
                    .filter((admin: any) => {
                      const name = typeof admin === 'string' ? "Unbekannter Mitarbeiter" : admin.name;
                      return name.toLowerCase().startsWith(adminSearch.toLowerCase());
                    })
                    .map((admin: any) => {
                      const email = typeof admin === 'string' ? admin : admin.email;
                      const name = typeof admin === 'string' ? "Unbekannter Mitarbeiter" : admin.name;
                      const isEditing = editingAdminEmail === email;

                      return (
                        <div key={email} className="flex flex-col p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 transition-all">
                          {isEditing ? (
                            <div className="space-y-3">
                              <Input 
                                value={editAdminName}
                                onChange={(e) => setEditAdminName(e.target.value)}
                                className="h-8 text-sm dark:bg-slate-900 border-accent/20"
                                placeholder="Name"
                              />
                              <div className="flex gap-2">
                                <Input 
                                  value={editAdminEmail}
                                  onChange={(e) => setEditAdminEmail(e.target.value)}
                                  className="h-8 text-sm dark:bg-slate-900 border-accent/20 flex-1"
                                  placeholder="E-Mail"
                                />
                                <div className="flex gap-1 shrink-0">
                                  <button 
                                    onClick={() => {
                                      const updated = adminEmails.map(a => {
                                        const curEmail = typeof a === 'string' ? a : a.email;
                                        if (curEmail === email) return { name: editAdminName, email: editAdminEmail };
                                        return a;
                                      });
                                      setAdminEmails(updated);
                                      updateBusiness({ adminEmails: updated });
                                      setEditingAdminEmail(null);
                                    }}
                                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => setEditingAdminEmail(null)}
                                    className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                  <span className="text-sm font-bold text-deep-blue dark:text-white leading-tight">{name}</span>
                                  <span className="text-xs text-gray-500 leading-tight mt-0.5">{email}</span>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button 
                                  onClick={() => {
                                    setEditingAdminEmail(email);
                                    setEditAdminName(name);
                                    setEditAdminEmail(email);
                                  }}
                                  className="p-2 text-gray-400 hover:text-accent hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setAdminEmailToDelete(email);
                                    setIsDeleteAdminEmailModalOpen(true);
                                  }} 
                                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Twilio Verbindung */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-full border border-red-100 dark:border-red-900/30">
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase">SMS-Anbieter (Twilio)</h3>
                <p className="font-bold text-deep-blue dark:text-white">Twilio Verbindung</p>
              </div>
            </div>

            {!isTwilioUnlocked ? (
              <form onSubmit={handleUnlockTwilio} className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Diese Einstellungen sind passwortgeschützt.</p>
                <div className="space-y-2">
                  <Input 
                    type="password"
                    value={twilioPasswordInput}
                    onChange={(e) => setTwilioPasswordInput(e.target.value)}
                    placeholder="Passwort eingeben..."
                    className={cn(
                      "bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white",
                      unlockError && "border-red-500 focus:ring-red-500"
                    )}
                  />
                  {unlockError && <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Falsches Passwort</p>}
                </div>
                <Button type="submit" className="w-full bg-deep-blue dark:bg-slate-800 text-white font-bold">
                  Freischalten
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Account SID</label>
                  <Input 
                    type="password"
                    value={twilioSid} 
                    onChange={(e) => setTwilioSid(e.target.value)}
                    onBlur={() => updateBusiness({ twilioSid })}
                    className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="AC..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Passwort (Auth Token)</label>
                  <Input 
                    type="password"
                    value={twilioToken} 
                    onChange={(e) => setTwilioToken(e.target.value)}
                    onBlur={() => updateBusiness({ twilioToken })}
                    className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="••••••••••••••••"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Absendernummer</label>
                    <Input 
                      value={twilioPhone} 
                      onChange={(e) => setTwilioPhone(e.target.value)}
                      onBlur={() => updateBusiness({ twilioPhone })}
                      className="bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="+49 (0) 000 00000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Standardregion</label>
                    <select className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent">
                      <option>Europa (West1)</option>
                      <option>US (East)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center pt-4 border-t border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    Verbindung sicher
                  </div>
                  <button className="text-xs font-bold tracking-widest text-deep-blue dark:text-accent uppercase hover:text-accent transition-colors">
                    Verbindung Testen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-red-100 dark:border-red-900/30">
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-6 border border-red-100 dark:border-red-900/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900 dark:text-red-400 uppercase tracking-widest">Gefahrenzone</h3>
              <p className="text-xs text-red-700/60 dark:text-red-500/60">Konto und Daten dauerhaft löschen</p>
            </div>
          </div>
          
          <p className="text-sm text-red-800 dark:text-red-400/80 mb-6">
            Wenn du dein Konto löschst, werden alle deine Daten, Kunden, Termine und Einstellungen unwiderruflich entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.
          </p>
          
          <Button 
            variant="outline" 
            className="border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-900/60 transition-all font-bold"
            onClick={() => setIsDeleteAccountModalOpen(true)}
          >
            Mein Konto dauerhaft löschen
          </Button>
        </div>
      </div>

      <Modal 
        isOpen={isDeleteAccountModalOpen} 
        onClose={() => setIsDeleteAccountModalOpen(false)} 
        title="Konto löschen"
        headerClassName="bg-red-600 text-white"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteAccountModalOpen(false)} disabled={isDeletingAccount}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold" 
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Wird gelöscht..." : "Endgültig löschen"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400">
            <p className="text-sm font-bold">ACHTUNG: Diese Aktion ist endgültig!</p>
            <p className="text-xs mt-2">Alle Daten, Kunden, Termine und Einstellungen werden gelöscht. Dies kann nicht rückgängig gemacht werden.</p>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEmployeeModalOpen} onClose={() => setIsEmployeeModalOpen(false)} title={editingEmployeeId ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"} footer={
        <div className="flex flex-col sm:flex-row justify-end gap-3 w-full">
          <Button variant="outline" className="flex-1 sm:flex-none dark:border-slate-700 dark:text-white" onClick={() => setIsEmployeeModalOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSaveEmployee} className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-white font-bold">{editingEmployeeId ? "Speichern" : "Anlegen"}</Button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Name</label>
            <Input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Max Mustermann" className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Telefonnummer (Optional)</label>
            <Input value={employeePhone} onChange={e => setEmployeePhone(e.target.value)} placeholder="+49 123 456789" className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-green-600 dark:text-green-400 uppercase mb-2">Angebotene Dienstleistungen</label>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3 leading-tight">Wählen Sie aus, welche Dienstleistungen dieser Mitarbeiter durchführen kann.</p>
            
            <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 flex flex-col">
              <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                <Input
                  placeholder="Dienstleistung suchen..."
                  value={employeeServiceSearch}
                  onChange={(e) => setEmployeeServiceSearch(e.target.value)}
                  className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div className="overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin max-h-[200px]">
                {[...services]
                  .filter(s => s.toLowerCase().startsWith(employeeServiceSearch.toLowerCase()))
                  .sort((a, b) => a.localeCompare(b))
                  .map((service: string) => (
                  <label key={service} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={employeeServices.includes(service)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEmployeeServices([...employeeServices, service]);
                        } else {
                          setEmployeeServices(employeeServices.filter(s => s !== service));
                        }
                      }}
                      className="accent-accent shrink-0"
                    />
                    <span className="truncate">{service}</span>
                  </label>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                    Keine Dienstleistungen verfügbar. Legen Sie zuerst Dienstleistungen an.
                  </div>
                )}
              </div>
            </div>
            
            <label className="flex items-center gap-2 p-2 mt-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isCustomEmployeeService}
                onChange={() => setIsCustomEmployeeService(!isCustomEmployeeService)}
                className="accent-accent shrink-0"
              />
              <span className="truncate">Individuell...</span>
            </label>
            {isCustomEmployeeService && renderCustomEmployeeServicesList()}
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mt-6 mb-2">Arbeitszeiten</label>
            <div className="space-y-3">
              {DAYS.map((day) => (
                <div key={day.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 overflow-x-auto">
                  <div className="w-24 shrink-0 font-medium text-sm text-deep-blue dark:text-white">{day.label}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmployeeHours({
                          ...employeeHours,
                          [day.id]: { ...employeeHours[day.id], closed: !employeeHours[day.id].closed }
                        });
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 dark:focus:ring-offset-slate-900",
                        employeeHours[day.id]?.closed ? "bg-red-500" : "bg-green-500"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform",
                        employeeHours[day.id]?.closed ? "left-0.5" : "translate-x-6 left-0.5"
                      )} />
                    </button>
                    {!employeeHours[day.id]?.closed && (
                      <div className="flex items-center gap-2 min-w-max">
                        <Input
                          type="time"
                          value={employeeHours[day.id]?.open || "08:00"}
                          onChange={(e) => setEmployeeHours({
                            ...employeeHours,
                            [day.id]: { ...employeeHours[day.id], open: e.target.value }
                          })}
                          className="w-24 h-8 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                        <Input
                          type="time"
                          value={employeeHours[day.id]?.close || "18:00"}
                          onChange={(e) => setEmployeeHours({
                            ...employeeHours,
                            [day.id]: { ...employeeHours[day.id], close: e.target.value }
                          })}
                          className="w-24 h-8 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      </div>
                    )}
                    {employeeHours[day.id]?.closed && (
                      <span className="text-sm font-bold text-red-500">Frei</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title={editingAbsenceId ? "Abwesenheit bearbeiten" : "Abwesenheit eintragen"} footer={
        <div className="flex flex-col sm:flex-row justify-end gap-3 w-full">
          <Button variant="outline" className="flex-1 sm:flex-none dark:border-slate-700 dark:text-white" onClick={() => setIsAbsenceModalOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSaveAbsence} className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-white font-bold">{editingAbsenceId ? "Speichern" : "Eintragen"}</Button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Mitarbeiter wählen</label>
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="p-2 border-b border-gray-200 dark:border-slate-700">
                <div className="relative">
                  <Input 
                    value={absenceEmployeeSearch}
                    onChange={(e) => setAbsenceEmployeeSearch(e.target.value)}
                    placeholder="Mitarbeiter suchen..."
                    className="pl-8 h-9 text-sm bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 shadow-sm"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700 py-1">
                {employees.filter(emp => emp.name.toLowerCase().startsWith(absenceEmployeeSearch.toLowerCase())).map((emp) => (
                  <div 
                    key={emp.id}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between group mx-1 rounded-lg mb-1",
                      absenceData.employeeId === emp.id 
                        ? "bg-accent text-white font-bold" 
                        : "text-deep-blue dark:text-white hover:bg-white dark:hover:bg-slate-700 shadow-none hover:shadow-sm"
                    )}
                    onClick={() => {
                      setAbsenceData({ ...absenceData, employeeId: emp.id });
                    }}
                  >
                    <span className="line-clamp-1">{emp.name}</span>
                    {absenceData.employeeId === emp.id && (
                      <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                    )}
                  </div>
                ))}
                {employees.filter(emp => emp.name.toLowerCase().startsWith(absenceEmployeeSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center italic">Keine Mitarbeiter gefunden</div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Art der Abwesenheit</label>
            <div className="relative">
                    <select 
                      value={absenceData.type}
                      onChange={(e) => setAbsenceData({ ...absenceData, type: e.target.value })}
                      className="flex h-10 w-full appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-deep-blue dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                <option value="Urlaub">Urlaub</option>
                <option value="Krankheit">Krankheit</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Von (Datum)</label>
              <Input type="date" value={absenceData.startDate} onChange={(e) => setAbsenceData({ ...absenceData, startDate: e.target.value })} className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm h-10" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Bis (Datum)</label>
              <Input type="date" value={absenceData.endDate} onChange={(e) => setAbsenceData({ ...absenceData, endDate: e.target.value })} min={absenceData.startDate || undefined} className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm h-10" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteEmployeeModalOpen} onClose={() => setIsDeleteEmployeeModalOpen(false)} title="Mitarbeiter löschen" footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteEmployeeModalOpen(false)}>Abbrechen</Button>
          <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleRemoveEmployee}>Endgültig löschen</Button>
        </div>
      }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Möchten Sie den Mitarbeiter <span className="font-bold text-deep-blue dark:text-white">{employeeToDelete?.name}</span> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>
      </Modal>

      <Modal isOpen={isDeleteAdminEmailModalOpen} onClose={() => setIsDeleteAdminEmailModalOpen(false)} title="Admin-E-Mail löschen" footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteAdminEmailModalOpen(false)}>Abbrechen</Button>
          <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={() => {
            if (adminEmailToDelete) {
                const updatedEmails = adminEmails.filter(admin => (typeof admin === 'string' ? admin !== adminEmailToDelete : admin.email !== adminEmailToDelete));
                setAdminEmails(updatedEmails);
                updateBusiness({ adminEmails: updatedEmails });
                setIsDeleteAdminEmailModalOpen(false);
                setAdminEmailToDelete(null);
            }
          }}>Endgültig löschen</Button>
        </div>
      }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Möchten Sie die E-Mail-Adresse <span className="font-bold text-deep-blue dark:text-white">{adminEmailToDelete}</span> wirklich aus den Admin-Zugriffen entfernen?
          </p>
        </div>
      </Modal>

      <Modal isOpen={isDeleteAbsenceModalOpen} onClose={() => setIsDeleteAbsenceModalOpen(false)} title="Abwesenheit löschen" footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteAbsenceModalOpen(false)}>Abbrechen</Button>
          <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleRemoveAbsence}>Endgültig löschen</Button>
        </div>
      }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Möchten Sie diese Abwesenheit wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>
      </Modal>

      <Modal isOpen={isDeleteServiceModalOpen} onClose={() => setIsDeleteServiceModalOpen(false)} title="Dienstleistung löschen" footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsDeleteServiceModalOpen(false)}>Abbrechen</Button>
          <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleDeleteService}>Endgültig löschen</Button>
        </div>
      }>
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400">
            <p className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Achtung!</p>
            <p className="text-xs mt-2">Möchten Sie die Dienstleistung "{serviceToDelete}" wirklich löschen? Alle Mitarbeiter, die diese Dienstleistung anbieten, werden aktualisiert. Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}