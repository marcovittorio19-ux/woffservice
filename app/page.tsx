'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WoffServiceApp() {
  // --- STATI ---
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'app'>('home');
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
  
  // Data minima: oggi
  const today = new Date().toISOString().split('T')[0];

  const [bookingForm, setBookingForm] = useState({ 
    staffName: 'Vittorio', 
    numDogs: 1, 
    date: today, 
    time: '', 
    duration: 30 
  });

  const colors = { 
    cream: '#FDFBF7', 
    brown: '#3C2A25',
    accent: '#A67C52'
  };

  // --- EFFETTI ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        setCurrentPage('app');
      }
    });
  }, []);

  // Calcolo Slot Disponibili
  useEffect(() => {
    const generateSlots = () => {
      if (!bookingForm.date || !bookingForm.duration) { setAvailableSlots([]); return; }
      const slots = [];
      const startHour = 8; const endHour = 22;
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          const start = h * 60 + m;
          const end = start + Number(bookingForm.duration);
          if (end > endHour * 60) continue;
          const isBusy = bookings.some(b => {
            if (b.booking_date !== bookingForm.date || b.staff_name !== bookingForm.staffName || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bStart = timeToMins(b.booking_time);
            const bEnd = bStart + b.duration_minutes;
            return (start < bEnd && end > bStart) && (b.num_dogs >= 2);
          });
          if (!isBusy) slots.push(minsToTime(start));
        }
      }
      setAvailableSlots(slots);
    };
    generateSlots();
  }, [bookingForm.date, bookingForm.duration, bookingForm.staffName, bookings]);

  // --- FUNZIONI UTILS ---
  const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) { setProfile(data); fetchData(); }
  };

  const fetchData = async () => {
    const { data } = await supabase.from('bookings').select('*').order('booking_date', { ascending: true });
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
        alert("Account creato! Conferma il tuo account sulla tua email!"); setView('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Credenziali errate"); else window.location.reload();
    }
    setLoading(false);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) { alert("Caricamento profilo..."); return; }
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
    
    if (!error) {
      alert("Richiesta inviata con successo!");
      setBookingForm({...bookingForm, time: ''});
      fetchData();
    } else { alert(error.message); }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  const inputStyle = "w-full p-4 rounded-2xl border-none bg-[#F0EBE5] text-[#3C2A25] font-bold outline-none focus:ring-2 focus:ring-[#3C2A25]/10";

  // --- RENDERING ---

  if (currentPage === 'home') {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.brown }} className="min-h-screen font-sans">
        <nav className="flex justify-between items-center p-8 max-w-7xl mx-auto">
          <h1 className="text-2xl font-black italic tracking-tighter">WOFF SERVICE</h1>
          <button onClick={() => setCurrentPage('app')} className="bg-[#3C2A25] text-white px-8 py-3 rounded-full font-bold uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Area Riservata</button>
        </nav>
        <main className="max-w-7xl mx-auto px-8 py-12 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <h2 className="text-7xl md:text-[90px] font-black italic leading-[0.8] tracking-tighter uppercase">IL MIGLIOR <br/> AMICO DEL <br/> <span className="text-[#FDFBF7] bg-[#3C2A25] px-4 py-1 inline-block">TUO CANE</span></h2>
              <p className="text-xl font-medium opacity-70 max-w-md">Servizio professionale di Pet Sitting. Prenota uno dei nostri Petsitter!</p>
              <button onClick={() => { setCurrentPage('app'); setView('register'); }} className="bg-[#3C2A25] text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl transition-all hover:scale-105">Prenota Ora</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="aspect-square bg-white rounded-[3rem] shadow-lg flex flex-col items-center justify-center p-6 border border-brown/5"><p className="font-black italic uppercase text-lg">Vittorio</p><p className="text-[9px] opacity-40 font-bold uppercase">Founder</p></div>
               <div className="aspect-[4/5] bg-brown text-white rounded-[3rem] mt-10 flex flex-col items-center justify-center p-6 shadow-2xl"><p className="font-black italic uppercase text-lg">Giulio</p><p className="text-[9px] opacity-40 font-bold uppercase">Staff</p></div>
               <div className="aspect-[4/5] bg-[#A67C52] text-white rounded-[3rem] -mt-10 flex flex-col items-center justify-center p-6 shadow-xl"><p className="font-black italic uppercase text-lg">Simone</p><p className="text-[9px] opacity-40 font-bold uppercase">Staff</p></div>
               <div className="aspect-square bg-white rounded-[3rem] shadow-lg flex flex-col items-center justify-center p-6 border border-brown/5"><p className="font-black italic uppercase text-lg">Filippo</p><p className="text-[9px] opacity-40 font-bold uppercase">Staff</p></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ backgroundColor: colors.cream }} className="min-h-screen flex flex-col items-center justify-center p-6">
        <button onClick={() => setCurrentPage('home')} className="mb-8 font-black uppercase text-[10px] tracking-widest opacity-30">← Esci</button>
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center border border-brown/5">
          <h1 className="text-3xl font-black mb-6 tracking-tighter" style={{ color: colors.brown }}>AREA RISERVATA</h1>
          <form onSubmit={handleAuth} className="space-y-3 text-left">
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
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="mt-8 text-[10px] font-black uppercase tracking-widest underline underline-offset-4 opacity-50">
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
          <button onClick={() => setCurrentPage('home')} className="text-xl font-black tracking-tighter uppercase italic">Woff Service</button>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="px-6 py-2 rounded-full border-2 border-brown font-black text-[10px] uppercase">Logout</button>
        </header>

        <main className="grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-10">
              {profile?.is_admin ? "PANNELLO\nCONTROLLO" : "LE TUE\nATTIVITÀ"}
            </h1>
            {bookings.filter(b => profile?.is_admin ? true : b.user_id === session.user.id).map(b => (
              <div key={b.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-brown/5 flex flex-col md:flex-row justify-between items-center gap-4 text-left">
                <div className="flex-1">
                  <p className="font-black text-lg uppercase">{b.staff_name}</p>
                  <p className="text-[10px] font-bold opacity-50 uppercase">{b.booking_date} @ {b.booking_time} ({b.duration_minutes}m)</p>
                  {profile?.is_admin && <p className="text-[9px] mt-2 font-black bg-cream p-1 px-2 rounded-lg inline-block uppercase">{b.client_name} - {b.phone}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-black text-[9px] px-3 py-1 rounded-full border border-brown/20 uppercase opacity-60">{b.status}</span>
                  {profile?.is_admin && b.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(b.id, 'accepted')} className="bg-green-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase">Sì</button>
                      <button onClick={() => updateStatus(b.id, 'rejected')} className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase">No</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!profile?.is_admin && (
            <div className="lg:col-span-5">
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-b-[8px] border-brown sticky top-12">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-8 leading-tight">PRENOTA<br/>UN AMICO</h3>
                <form onSubmit={handleBooking} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div>
                      <label className="text-[9px] font-black uppercase opacity-40 ml-2">Staff</label>
                      <select className={inputStyle} value={bookingForm.staffName} onChange={e => setBookingForm({...bookingForm, staffName: e.target.value, time: ''})}>
                        {['Vittorio', 'Filippo', 'Simone', 'Giulio', 'Suppa'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase opacity-40 ml-2">Cani</label>
                      <select className={inputStyle} value={bookingForm.numDogs} onChange={e => setBookingForm({...bookingForm, numDogs: Number(e.target.value), time: ''})}>
                        <option value="1">1 Cane</option><option value="2">2 Cani</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="text-[9px] font-black uppercase opacity-40 ml-2">Giorno</label>
                    <input type="date" min={today} required className={inputStyle} value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value, time: ''})} />
                  </div>

                  <div className="text-left">
                    <label className="text-[9px] font-black uppercase opacity-40 ml-2">Quanto tempo?</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {[30, 60, 90, 120].map(m => (
                        <button key={m} type="button" 
                          onClick={() => setBookingForm({...bookingForm, duration: m, time: ''})}
                          className={`p-3 rounded-xl font-black text-xs transition-all ${bookingForm.duration === m ? 'bg-brown text-white' : 'bg-[#F0EBE5] text-brown'}`}>
                          {m}'
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <p className="text-[9px] font-black opacity-30 uppercase tracking-widest ml-1 mb-2">Orari disponibili</p>
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-cream/50 rounded-xl border-2 border-dashed border-brown/10">
                      {availableSlots.length > 0 ? availableSlots.map(slot => (
                        <button key={slot} type="button" onClick={() => setBookingForm({...bookingForm, time: slot})}
                          className={`p-2 rounded-lg font-bold text-[10px] transition-all ${bookingForm.time === slot ? 'bg-brown text-white scale-105 shadow-md' : 'bg-white text-brown'}`}>
                          {slot}
                        </button>
                      )) : <p className="col-span-4 text-[9px] text-center opacity-40 py-4 italic">Nessuno slot libero</p>}
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !bookingForm.time} className="w-full p-5 rounded-[2rem] bg-brown text-white font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30">
                    {loading ? 'CARICAMENTO...' : 'INVIA PRENOTAZIONE'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
