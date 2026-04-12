import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Plus, Trash2, StickyNote, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Modal } from "../components/ui/modal";

interface Note {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

const COLORS = [
  { name: 'Gelb', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-400' },
  { name: 'Blau', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-400' },
  { name: 'Grün', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-400' },
  { name: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-200 dark:border-pink-800', dot: 'bg-pink-400' },
  { name: 'Lila', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-400' },
];

interface NoteCardProps {
  key?: string;
  note: Note;
  onSave: (note: Note) => void;
  onDelete: (id: string) => void;
}

function NoteCard({ note, onSave, onDelete }: NoteCardProps) {
  const [text, setText] = useState(note.text);
  const [color, setColor] = useState(note.color);
  const [isSaved, setIsSaved] = useState(false);

  // Sync with prop if it changes from DB (optional, but good if another device changes it)
  useEffect(() => {
    setText(note.text);
    setColor(note.color);
  }, [note.text, note.color]);

  const hasChanged = text !== note.text || color !== note.color;

  const handleSave = () => {
    onSave({ ...note, text, color });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const colorInfo = COLORS.find(c => c.bg === color) || COLORS[0];

  return (
    <div 
      className={cn(
        "group relative flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:shadow-md",
        color,
        colorInfo.border
      )}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.bg}
              onClick={() => setColor(c.bg)}
              className={cn(
                "w-4 h-4 rounded-full border border-black/5 transition-transform hover:scale-125",
                c.dot,
                color === c.bg ? "ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500" : ""
              )}
            />
          ))}
        </div>
        <button 
          onClick={() => onDelete(note.id)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Notiz schreiben..."
        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-deep-blue dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none min-h-[150px] text-sm leading-relaxed"
      />
      
      <div className="mt-4 pt-4 border-t border-black/5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        <span>{new Date(note.createdAt).toLocaleDateString('de-DE')}</span>
        <button 
          onClick={handleSave}
          disabled={!hasChanged}
          className={cn(
            "px-3 py-1 rounded transition-all duration-300 font-bold flex items-center gap-1.5",
            isSaved 
              ? "bg-green-500 text-white" 
              : hasChanged 
                ? "bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover" 
                : "bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
          )}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              Gespeichert
            </>
          ) : (
            "Speichern"
          )}
        </button>
      </div>
    </div>
  );
}

export function Notes() {
  const { businessId } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsub = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedNotes = data.notes || [];
        if (typeof fetchedNotes === 'string') {
          setNotes([{
            id: Date.now().toString(),
            text: fetchedNotes,
            color: COLORS[0].bg,
            createdAt: new Date().toISOString()
          }]);
        } else {
          setNotes(fetchedNotes);
        }
      }
    });

    return () => unsub();
  }, [businessId]);

  const saveNote = useCallback(async (updatedNote: Note) => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      const docSnap = await getDoc(doc(db, "businesses", businessId));
      const currentNotes = docSnap.data()?.notes || [];
      
      let newNotes;
      const exists = currentNotes.find((n: Note) => n.id === updatedNote.id);
      if (exists) {
        newNotes = currentNotes.map((n: Note) => n.id === updatedNote.id ? updatedNote : n);
      } else {
        newNotes = [updatedNote, ...currentNotes];
      }

      await updateDoc(doc(db, "businesses", businessId), {
        notes: newNotes
      });
      
      // Remove from localNotes if it was a new note
      setLocalNotes(prev => prev.filter(n => n.id !== updatedNote.id));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setIsSaving(false);
    }
  }, [businessId]);

  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      text: "",
      color: COLORS[0].bg,
      createdAt: new Date().toISOString()
    };
    setLocalNotes(prev => [newNote, ...prev]);
  };

  const deleteNote = (id: string) => {
    setNoteToDelete(id);
  };

  const confirmDelete = async () => {
    if (noteToDelete && businessId) {
      // Check if it's a local note
      if (localNotes.find(n => n.id === noteToDelete)) {
        setLocalNotes(prev => prev.filter(n => n.id !== noteToDelete));
        setNoteToDelete(null);
        return;
      }

      setIsSaving(true);
      try {
        const docSnap = await getDoc(doc(db, "businesses", businessId));
        const currentNotes = docSnap.data()?.notes || [];
        const newNotes = currentNotes.filter((n: Note) => n.id !== noteToDelete);
        
        await updateDoc(doc(db, "businesses", businessId), {
          notes: newNotes
        });
        setNoteToDelete(null);
      } catch (error) {
        console.error("Error deleting note:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const allNotes: Note[] = [...localNotes, ...notes];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Notizen</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
            {saveSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
          <Button 
            onClick={addNote}
            className="bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Neue Notiz
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        {allNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
            <StickyNote className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">Noch keine Notizen vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neue Notiz", um zu starten.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allNotes.map((note) => (
              <NoteCard 
                key={note.id} 
                note={note} 
                onSave={saveNote} 
                onDelete={deleteNote} 
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title="Notiz löschen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diese Notiz wirklich löschen?</p>
              <p className="text-sm opacity-90">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setNoteToDelete(null)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={confirmDelete}
            >
              Löschen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
