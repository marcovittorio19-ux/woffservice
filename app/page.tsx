'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WoffServiceApp() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Dati Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingForm, setBookingForm] = useState({ 
    staffName: 'Vittorio', 
    numDogs: 1, 
    date: '', 
    time: '', 
    duration: 30 
  });

  const colors = { 
    cream: '#F5EFE6', 
    brown: '#4A342E',
    inputBg: '#EFEAE4'
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
  }, []);

  // Utility per gestire i calcoli temporali in minuti
  const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // CALCOLO INTELLIGENTE: Controlla la disponibilità specifica per lo STAFF selezionato
  useEffect(() => {
    const generateSlots = () => {
      if (!bookingForm.date || !bookingForm.duration || bookingForm.duration <= 0) {
        setAvailableSlots([]);
        return;
      }

      const slots = [];
      const startHour = 8; 
      const endHour = 22;  
      const requestedDuration = Number(bookingForm.duration);

      // Scansioniamo la giornata ogni 15 minuti
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) { 
          const currentStartMins = h * 60 + m;
          const currentEndMins = currentStartMins + requestedDuration;
          const currentTimeStr = minsToTime(currentStartMins);

          if (currentEndMins > endHour * 60) continue;

          // Per ogni slot, contiamo quanti cani ha lo STAFF selezionato in quel lasso di tempo
          const isStaffBusy = bookings.some(b => {
            // Consideriamo solo prenotazioni dello stesso giorno, dello STESSO STAFF e non annullate/rifiutate
            if (
              b.booking_date !== bookingForm.date || 
              b.staff_name !== bookingForm.staffName || 
              b.status === 'cancelled' || 
              b.status === 'rejected'
            ) return false;
            
            const existingStartMins = timeToMins(b.booking_time);
            const existingEndMins = existingStartMins + b.duration_minutes;

            // Verifica sovrapposizione temporale
            const overlaps = (currentStartMins < existingEndMins && currentEndMins > existingStartMins);
            
            // Se si sovrappone e il sitter ha già 2 o più cani, lo slot è occupato
            return overlaps && (b.num_dogs >= 2);
          });

          if (!isStaffBusy) slots.push(currentTimeStr);
        }
      }
      setAvailableSlots(slots);
    };

    generateSlots();
  }, [bookingForm.date, bookingForm.duration, bookingForm.staffName, bookings]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setProfile(data);
      fetchData(userId, data.is_admin);
    }
  };

  const fetchData = async (userId: string, isAdmin: boolean) => {
    // Carichiamo TUTTE le prenotazioni per permettere al sistema di calcolare la disponibilità di tutto lo staff
    let query = supabase.from('bookings').select('*').order('booking_date', { ascending: true });
    const { data } = await query;
    setBookings(data || []);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (view === 'register') {
      if (password !== confirmPassword) { alert("Le password non coincidono"); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data.user) {
        await supabase.from('profiles').upsert([{ id: data.user.id, email, first_name: firstName, last_name: lastName, phone, is_admin: false }]);
        alert("Account creato! Accedi ora.");
        setView('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Credenziali errate");
      else window.location.reload();
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    fetchData(session.user.id, profile?.is_admin);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.time) { alert("Seleziona un orario!"); return; }
    setLoading(true);
    const { error } = await supabase.from('bookings').insert([{
      user_id: session.user.id,
      client_name: `${profile.first_name} ${profile.last_name}`,
      phone: profile.phone,
      staff_name: bookingForm.staffName,
      num_dogs: bookingForm.numDogs,
      booking_date: bookingForm.date,
      booking_time: bookingForm.time,
      duration_minutes: Number(bookingForm.duration),
      status: 'pending'
    }]);
    if (error) alert(error.message);
    else { 
      alert("Richiesta inviata!"); 
      setBookingForm({...bookingForm, time: ''});
      fetchData(session.user.id, false); 
    }
    setLoading(false);
  };

  const getStatusLabel = (s: string) => {
    if (s === 'pending') return { t: 'IN ATTESA', c: '#D97706' };
    if (s === 'accepted') return { t: 'CONFERMATA', c: '#059669' };
    if (s === 'rejected') return { t: 'RIFIUTATA', c: '#DC2626' };
    return { t: 'ANNULLATA', c: '#9CA3AF' };
  };

  const inputStyle = "w-full p-4 rounded-2xl border-none bg-[#EFEAE4] text-[#4A342E] placeholder:text-[#4A342E]/40 font-bold outline-none transition-all focus:ring-2 focus:ring-brown/10";

  if (!session) {
    return (
      <div style={{ backgroundColor: colors.cream }} className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center">
          <h1 className="text-4xl font-black mb-1 tracking-tighter" style={{ color: colors.brown }}>WOFF SERVICE</h1>
          <p className="text-[10px] font-bold uppercase opacity-40 mb-8 tracking-[0.2em]">Pet Sitting Professionali</p>
          <form onSubmit={handleAuth} className="space-y-4 text-left">
            {view === 'register' && (
              <>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nome" className={inputStyle} onChange={e => setFirstName(e.target.value)} required />
                  <input type="text" placeholder="Cognome" className={inputStyle} onChange={e => setLastName(e.target.value)} required />
                </div>
                <input type="tel" placeholder="Cellulare" className={inputStyle} onChange={e => setPhone(e.target.value)} required />
              </>
            )}
            <input type="email" placeholder="Email" className={inputStyle} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className={inputStyle} onChange={e => setPassword(e.target.value)} required />
            {view === 'register' && <input type="password" placeholder="Ripeti Password" className={inputStyle} onChange={e => setConfirmPassword(e.target.value)} required />}
            <button style={{ backgroundColor: colors.brown }} className="w-full p-5 rounded-2xl text-white font-black uppercase tracking-widest mt-4 shadow-lg active:scale-95 transition-all">
              {view === 'login' ? 'ENTRA' : 'UNISCITI'}
            </button>
          </form>
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="mt-8 text-[11px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4 text-[#6B544D]">
            {view === 'login' ? "Crea un nuovo account" : "Hai già un profilo? Accedi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.brown }} className="min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Woff Service</h2>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="px-6 py-2 rounded-full border-2 border-brown font-black text-[10px] uppercase">Logout</button>
        </header>

        <main className="grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            <h1 className="text-6xl font-black uppercase italic leading-none tracking-tighter">
              {profile?.is_admin ? "GESTIONE\nRICHIESTE" : "LE TUE\nATTIVITÀ"}
            </h1>
            <div className="space-y-4">
              {bookings
                .filter(b => profile?.is_admin ? true : b.user_id === session.user.id)
                .map(b => {
                const s = getStatusLabel(b.status);
                return (
                  <div key={b.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-brown/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1">
                      <p className="font-black text-lg uppercase leading-tight">{b.staff_name}</p>
                      <p className="text-xs font-bold opacity-60">{b.booking_date} • {b.booking_time} ({b.duration_minutes}m)</p>
                      {profile?.is_admin && <p className="text-[10px] mt-2 font-black bg-cream p-1 px-2 rounded-lg inline-block">CLIENTE: {b.client_name} ({b.phone})</p>}
                    </div>
                    <span className="font-black text-[10px] px-4 py-1 rounded-full border-2" style={{ color: s.c, borderColor: s.c }}>{s.t}</span>
                    <div className="flex gap-2">
                      {profile?.is_admin && b.status === 'pending' ? (
                        <>
                          <button onClick={() => updateStatus(b.id, 'accepted')} className="bg-green-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">Accetta</button>
                          <button onClick={() => updateStatus(b.id, 'rejected')} className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">Rifiuta</button>
                        </>
                      ) : (
                        (b.status === 'pending' || profile?.is_admin) && b.status !== 'cancelled' && b.status !== 'rejected' && (
                          <button onClick={() => updateStatus(b.id, 'cancelled')} className="text-[10px] font-black uppercase underline opacity-30 p-2">Annulla</button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!profile?.is_admin && (
            <div className="lg:col-span-5">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-t-[12px] border-brown sticky top-12">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8 leading-none">PRENOTA<br/>UN AMICO</h3>
                <form onSubmit={handleBooking} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <select className={inputStyle} value={bookingForm.staffName} onChange={e => setBookingForm({...bookingForm, staffName: e.target.value, time: ''})}>
                      {['Vittorio', 'Filippo', 'Simone', 'Giulio', 'Suppa'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className={inputStyle} value={bookingForm.numDogs} onChange={e => setBookingForm({...bookingForm, numDogs: Number(e.target.value), time: ''})}>
                      <option value="1">1 Amico</option><option value="2">2 Amici</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" required className={inputStyle} value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value, time: ''})} />
                    <input type="number" placeholder="Minuti" className={inputStyle} value={bookingForm.duration} onChange={e => setBookingForm({...bookingForm, duration: Number(e.target.value), time: ''})} />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-black opacity-40 uppercase tracking-widest ml-2">Disponibilità per {bookingForm.staffName}</p>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 bg-cream/30 rounded-2xl border-2 border-dashed border-brown/10 custom-scrollbar">
                      {availableSlots.length > 0 ? (
                        availableSlots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookingForm({...bookingForm, time: slot})}
                            className={`p-2 rounded-xl font-bold text-xs transition-all ${
                              bookingForm.time === slot 
                              ? 'bg-[#4A342E] text-white shadow-lg scale-105' 
                              : 'bg-white text-[#4A342E] hover:bg-[#4A342E]/10'
                            }`}
                          >
                            {slot}
                          </button>
                        ))
                      ) : (
                        <p className="col-span-4 text-[10px] italic opacity-50 py-4 text-center">Nessuno slot libero</p>
                      )}
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !bookingForm.time} style={{ backgroundColor: colors.brown }} className="w-full p-6 rounded-[2.5rem] text-white font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30">
                    {loading ? 'INVIO...' : 'INVIA RICHIESTA'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4A342E20; border-radius: 10px; }
      `}</style>
    </div>
  );
}