
import React, { useState } from 'react';
import { ShieldCheck, Lock, Loader2, Server, Key, CheckCircle, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';

const OAuthHandler: React.FC = () => {
  const { setAuthentication, setCurrentUser } = useAppContext();
  const [authStage, setAuthStage] = useState<'idle' | 'redirecting' | 'requesting_code' | 'exchanging_token' | 'complete'>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing Secure Login...');

  const handleLogin = async () => {
    setAuthStage('redirecting');
    setStatusMessage("Connecting to Identity Provider...");
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      setAuthStage('exchanging_token');
      setStatusMessage("Verifying Credentials...");
      
      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let userData;
      if (userDoc.exists()) {
        userData = userDoc.data();
      } else {
        // Create new user
        userData = {
          id: user.uid,
          email: user.email || '',
          name: user.displayName || 'Unknown User',
          role: 'Technician', // Default role
          companyId: 'default-company',
          permissions: []
        };
        await setDoc(userDocRef, userData);
      }

      setCurrentUser(userData as User);
      setAuthStage('complete');
      setStatusMessage(`Welcome back, ${userData.name}`);
      
      setTimeout(() => {
        setAuthentication(true);
      }, 1000);

    } catch (error) {
      console.error("Login failed:", error);
      setAuthStage('idle');
      setStatusMessage("Login failed. Please try again.");
    }
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full" />

        <div className="z-10 w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20">
                    <Lock size={32} />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Restoration<span className="text-blue-500">AI</span> Secure Login</h1>
                <p className="text-slate-400 text-xs mt-1 font-mono">Firebase Authentication</p>
            </div>

            <div className="space-y-6 relative">
                {/* Connecting Line */}
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-800 -z-10" />

                {/* Step 1: Authorization */}
                <div className={`flex items-center space-x-4 transition-opacity duration-500 ${authStage === 'redirecting' || authStage === 'requesting_code' || authStage === 'exchanging_token' || authStage === 'complete' ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center bg-slate-900 transition-colors duration-500 ${authStage === 'redirecting' ? 'border-blue-500 text-blue-500 animate-pulse' : (authStage !== 'idle' ? 'border-green-500 text-green-500' : 'border-slate-700 text-slate-700')}`}>
                        {authStage === 'redirecting' ? <Loader2 size={20} className="animate-spin" /> : (authStage !== 'idle' ? <CheckCircle size={20} /> : <Server size={20} />)}
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${authStage === 'redirecting' ? 'text-blue-400' : 'text-white'}`}>Authorization Request</h3>
                        <p className="text-[10px] text-slate-500">Google Sign-In</p>
                    </div>
                </div>

                {/* Step 2: Token Exchange */}
                <div className={`flex items-center space-x-4 transition-opacity duration-500 ${authStage === 'exchanging_token' || authStage === 'complete' ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center bg-slate-900 transition-colors duration-500 ${authStage === 'exchanging_token' ? 'border-indigo-500 text-indigo-500 animate-pulse' : (authStage === 'complete' ? 'border-green-500 text-green-500' : 'border-slate-700 text-slate-700')}`}>
                        {authStage === 'exchanging_token' ? <Loader2 size={20} className="animate-spin" /> : (authStage === 'complete' ? <CheckCircle size={20} /> : <ArrowRight size={20} />)}
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${authStage === 'exchanging_token' ? 'text-indigo-400' : 'text-white'}`}>Verifying User</h3>
                        <p className="text-[10px] text-slate-500">Checking Firestore Database</p>
                    </div>
                </div>

                 {/* Step 3: Session */}
                 <div className={`flex items-center space-x-4 transition-opacity duration-500 ${authStage === 'complete' ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center bg-slate-900 transition-colors duration-500 ${authStage === 'complete' ? 'border-emerald-500 text-emerald-500' : 'border-slate-700 text-slate-700'}`}>
                        {authStage === 'complete' ? <ShieldCheck size={20} /> : <Key size={20} />}
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${authStage === 'complete' ? 'text-emerald-400' : 'text-white'}`}>Session Granted</h3>
                        <p className="text-[10px] text-slate-500">Authenticated</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-4">
                 <p className="text-xs font-mono text-blue-400 animate-pulse">{statusMessage}</p>
                 
                 <div className="grid grid-cols-1 gap-2">
                   {authStage === 'idle' && (
                     <button 
                       onClick={handleLogin}
                       className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center space-x-2"
                     >
                       <span>Sign In with Google</span>
                       <ArrowRight size={16} />
                     </button>
                   )}
                 </div>
            </div>
        </div>
        
        <div className="mt-8 flex items-center space-x-2 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
            <Lock size={12} />
            <span>256-bit TLS Encryption</span>
        </div>
    </div>
  );
};

export default OAuthHandler;
