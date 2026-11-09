import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Cloud, BookOpen } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { authRedirectUrl, authConfigured, supabase } from '../../services/auth';

interface AuthViewProps {
  onContinueOffline: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onContinueOffline }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setError('Enter your email address.');
    if (mode !== 'reset' && password.length < 8) return setError('Use a password with at least 8 characters.');
    if (mode === 'signup' && password !== confirmPassword) return setError('Those passwords do not match yet.');
    if (!supabase) return setError('Email accounts are not configured in this app build yet.');

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: authRedirectUrl },
        });
        if (signUpError) throw signUpError;
        setMessage(data.session
          ? 'Your account is ready. Your progress will sync to this account.'
          : 'Check your inbox to verify your email, then return here and sign in.');
        if (data.session) setMode('signin');
      } else if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: authRedirectUrl });
        if (resetError) throw resetError;
        setMessage('If an account exists for that email, a password reset link is on its way.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInError) throw signInError;
      }
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : '';
      if (/invalid login credentials|email not confirmed/i.test(text)) {
        setError(/email not confirmed/i.test(text)
          ? 'Verify your email from the message we sent, then sign in again.'
          : 'That email and password did not match. Check them or create an account.');
      } else if (/already registered|already exists/i.test(text)) {
        setError('An account already uses that email. Sign in or reset its password.');
      } else {
        setError(text || 'We could not complete that request. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell min-h-screen px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <header className="text-center mb-7">
          <BrandMark className="h-16 w-16 mx-auto mb-4 shadow-xl" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">A calmer way to improve</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-50">Daba Dojo</h1>
          <p className="mt-2 text-sm leading-6 text-stone-400">Your lessons, practice and progress, together in one place.</p>
        </header>

        <section className="rounded-3xl border border-stone-700/80 bg-stone-900/95 p-6 shadow-2xl sm:p-7">
          {authConfigured ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-900/80 bg-emerald-950/40 p-3.5">
                <Cloud className="h-5 w-5 shrink-0 text-emerald-300" />
                <p className="text-xs leading-5 text-stone-300">Sign in once. Your training progress syncs privately across your devices.</p>
              </div>
              {mode !== 'reset' && (
                <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-stone-950 p-1">
                  <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'}`}>Sign in</button>
                  <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'}`}>Create account</button>
                </div>
              )}
              <h2 className="mb-1 text-xl font-bold text-stone-100">{mode === 'signup' ? 'Start your learning plan' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h2>
              <p className="mb-5 text-sm text-stone-400">{mode === 'signup' ? 'A few details and your progress can follow you.' : mode === 'reset' ? 'We’ll send a secure reset link if the account exists.' : 'Pick up where your last session ended.'}</p>

              <form onSubmit={submit} className="space-y-4">
                <label className="block text-sm font-semibold text-stone-300">
                  Email address
                  <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-3 text-base text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-emerald-500" placeholder="you@example.com" />
                </label>
                {mode !== 'reset' && (
                  <>
                    <label className="block text-sm font-semibold text-stone-300">
                      Password
                      <span className="relative mt-1.5 block">
                        <input type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-3 pr-12 text-base text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-emerald-500" placeholder="At least 8 characters" />
                        <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-500 hover:text-stone-200" aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      </span>
                    </label>
                    {mode === 'signup' && (
                      <label className="block text-sm font-semibold text-stone-300">
                        Confirm password
                        <input type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-3 text-base text-stone-100 outline-none transition focus:border-emerald-500" placeholder="Type it again" />
                      </label>
                    )}
                  </>
                )}
                {error && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/50 px-3 py-2.5 text-sm leading-5 text-red-200">{error}</p>}
                {message && <p role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/50 px-3 py-2.5 text-sm leading-5 text-emerald-200">{message}</p>}
                <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60">
                  {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
                  {!busy && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                {mode === 'signin' ? <button onClick={() => { setMode('reset'); setError(''); setMessage(''); }} className="text-stone-400 underline decoration-stone-600 underline-offset-4 hover:text-stone-200">Forgot password?</button> : <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className="text-stone-400 underline decoration-stone-600 underline-offset-4 hover:text-stone-200">Back to sign in</button>}
                <span className="flex items-center gap-1.5 text-stone-500"><ShieldCheck className="h-3.5 w-3.5" /> Private progress</span>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-300"><Cloud className="h-6 w-6" /></div>
              <h2 className="text-xl font-bold text-stone-100">Accounts are being connected</h2>
              <p className="mt-2 text-sm leading-6 text-stone-400">Email sign-in becomes available when the app’s secure account service is configured. You can still explore lessons and save progress on this device.</p>
              <p className="mt-3 text-xs leading-5 text-stone-500">For now, local progress stays on this device. It does not sync to your email yet.</p>
              <button onClick={onContinueOffline} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400">Explore on this device <ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-stone-500"><BookOpen className="h-3.5 w-3.5" />Short lessons. Useful practice. Clear progress.<a href="/privacy.html" className="ml-2 underline decoration-stone-700 underline-offset-4 hover:text-stone-300">Privacy</a></div>
      </div>
    </main>
  );
};
