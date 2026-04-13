import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Bell, CheckCircle, Trash2, Calendar, Clock, User, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";

export function Notifications() {
  const { businessId } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    const q = query(
      collection(db, `businesses/${businessId}/notifications`),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/notifications`);
    });

    return () => unsub();
  }, [businessId]);

  const markAsRead = async (id: string) => {
    if (!businessId) return;
    try {
      await updateDoc(doc(db, `businesses/${businessId}/notifications`, id), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    if (!businessId || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, `businesses/${businessId}/notifications`, n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string) => {
    if (!businessId) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/notifications`, id));
    } catch (error) {
      console.error("Error deleting notification", error);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Benachrichtigungen</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            className="text-xs font-bold uppercase tracking-widest"
          >
            Alle als gelesen markieren
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-card-dark rounded-xl border border-dashed border-gray-200 dark:border-slate-800 p-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-deep-blue dark:text-white mb-1">Keine Benachrichtigungen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sobald Kunden auf SMS antworten, erscheinen sie hier.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id}
              className={`relative bg-white dark:bg-card-dark rounded-xl border transition-all p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center ${
                notif.read 
                  ? "border-gray-100 dark:border-slate-800 opacity-75" 
                  : "border-accent/30 shadow-md shadow-accent/5 ring-1 ring-accent/10"
              }`}
              onClick={() => !notif.read && markAsRead(notif.id)}
            >
              {!notif.read && (
                <div className="absolute top-0 left-0 w-1 h-full bg-accent rounded-l-xl" />
              )}
              
              <div className={`p-3 rounded-full shrink-0 ${
                notif.type === 'booking_confirmed' 
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" 
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              }`}>
                {notif.type === 'booking_confirmed' ? <CheckCircle className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-deep-blue dark:text-white truncate">
                    {notif.clientName}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase shrink-0 ml-2">
                    {notif.timestamp ? format(new Date(notif.timestamp), 'HH:mm • dd.MM', { locale: de }) : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {notif.message}
                </p>
                
                {notif.slotInfo && (
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                      <Calendar className="h-3 w-3" />
                      {notif.slotInfo.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                      <Clock className="h-3 w-3" />
                      {notif.slotInfo.time} Uhr
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                      <User className="h-3 w-3" />
                      {notif.slotInfo.serviceType}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 self-end sm:self-center">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
