import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { Plus, Trash2, Edit2, Clock, AlertTriangle, Search, Filter } from "lucide-react";

export function Clients() {
  const { businessId } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem("clients_searchQuery") || "");
  const [filterService, setFilterService] = useState(() => localStorage.getItem("clients_filterService") || "all");

  useEffect(() => {
    localStorage.setItem("clients_searchQuery", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem("clients_filterService", filterService);
  }, [filterService]);

  // Modal State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        setBusiness(docSnap.data());
      }
    });

    const q = query(
      collection(db, `businesses/${businessId}/clients`),
      orderBy("createdAt", "desc")
    );
    const unsubClients = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
    });

    return () => {
      unsubBusiness();
      unsubClients();
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

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingClientId(null);
    setName("");
    setPhone("");
    setSelectedServices([]);
    setSelectedTimes([]);
    setConsentGiven(false);
    setIsModalOpen(true);
  };

  const openEditModal = (client: any) => {
    setIsEditMode(true);
    setEditingClientId(client.id);
    setName(client.name);
    setPhone(client.phone);
    setSelectedServices(client.serviceTypes || []);
    setSelectedTimes(client.preferredTimes || []);
    setConsentGiven(client.consentGiven || false);
    setIsModalOpen(true);
  };

  const handleSaveClient = async () => {
    if (!businessId || !name || !phone || !consentGiven || selectedServices.length === 0) return;
    setIsSubmitting(true);

    try {
      if (isEditMode && editingClientId) {
        await updateDoc(doc(db, `businesses/${businessId}/clients`, editingClientId), {
          name,
          phone,
          serviceTypes: selectedServices,
          preferredTimes: selectedTimes,
          consentGiven
        });
      } else {
        await addDoc(collection(db, `businesses/${businessId}/clients`), {
          name,
          phone,
          serviceTypes: selectedServices,
          preferredTimes: selectedTimes,
          consentGiven,
          consentTimestamp: new Date().toISOString(),
          active: true,
          createdAt: new Date().toISOString()
        });
      }
      
      setIsModalOpen(false);
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          client.phone.includes(searchQuery);
    const matchesService = filterService === "all" || client.serviceTypes.includes(filterService);
    return matchesSearch && matchesService;
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1">Deine Kundenliste</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Alle Kunden</h1>
        </div>
        <Button onClick={openAddModal} className="w-full sm:w-auto bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold px-6 shadow-lg shadow-deep-blue/20 dark:shadow-accent/20">
          <Plus className="mr-2 h-5 w-5" /> Kunde hinzufügen
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Kunde suchen (Name oder Telefon)..." 
            className="pl-10 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
          <div className="relative flex-1 min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-accent appearance-none"
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
            >
              <option value="all">Alle Dienstleistungen</option>
              {business?.serviceTypes?.map((service: string) => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>
          {(filterService !== "all" || searchQuery !== "") && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setFilterService("all");
                setSearchQuery("");
              }}
              className="h-10 text-xs font-bold text-gray-500 dark:text-gray-400 dark:border-slate-800 hover:text-deep-blue dark:hover:text-white"
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-indigo-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-medium">Kundenidentität</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Dienstleistungen</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Bevorzugte Zeit</th>
                <th className="px-6 py-4 font-medium text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-deep-blue dark:text-white text-base">{client.name}</div>
                    <div className="text-gray-500 dark:text-gray-400">{client.phone}</div>
                    <div className="sm:hidden mt-2 flex flex-wrap gap-1">
                      {client.serviceTypes.slice(0, 2).map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded">
                          {s}
                        </span>
                      ))}
                      {client.serviceTypes.length > 2 && <span className="text-[10px] text-gray-400">+{client.serviceTypes.length - 2}</span>}
                    </div>
                    <div className="sm:hidden mt-1 flex items-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      <Clock className="h-3 w-3 mr-1" />
                      {client.preferredTimes.length > 0 ? client.preferredTimes.join(", ") : "Alle Zeiten"}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-2">
                      {client.serviceTypes.map((s: string) => (
                        <span key={s} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="flex items-center text-gray-600 dark:text-gray-400 font-medium">
                      <Clock className="h-4 w-4 mr-2" />
                      {client.preferredTimes.length > 0 ? client.preferredTimes.join(", ") : "Alle Zeiten"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(client)}
                        className="text-gray-400 hover:text-deep-blue dark:hover:text-white p-2 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => confirmDelete(client)}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {clients.length === 0 ? "Keine Kunden vorhanden. Füge deinen ersten Kunden hinzu!" : "Keine Kunden entsprechen den Suchkriterien."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditMode ? "Kunde bearbeiten" : "Kunde hinzufügen"}>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Vollständiger Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Max Mustermann"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Telefonnummer</label>
            <Input 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 000 000000"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Gewünschte Services</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {business?.serviceTypes?.map((service: string) => (
                <button
                  key={service}
                  onClick={() => toggleService(service)}
                  className={`p-3 rounded-lg text-sm font-medium text-left transition-colors ${
                    selectedServices.includes(service) 
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-800/50' 
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Zeitpräferenz</label>
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
              disabled={isSubmitting || !name || !phone || !consentGiven || selectedServices.length === 0}
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
    </div>
  );
}
