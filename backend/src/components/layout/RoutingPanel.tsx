import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { TacticalButton } from '@/components/ui/TacticalButton';

interface RouteOption {
  id: string;
  type: string;
  rides: number;
  fare: number;
  duration: string;
  distance: string;
  result?: google.maps.DirectionsResult;
  routeIndex?: number;
  instructions: string[];
  fallbackPath?: { lat: number; lng: number }[];
}

interface RoutingPanelProps {
  activeStation: string;
  journeyStarted: boolean;
  routeOptions: RouteOption[];
  selectedRoute: RouteOption | null;
  handleSelectRoute: (option: RouteOption) => void;
  calculateRoute: () => void;
  setJourneyStarted: (started: boolean) => void;
  travelInfo: { distance: string; duration: string };
  instructions: string[];
  analyzeRoute: () => void;
  isAnalyzing: boolean;
  analysisResult: string | null;
  loading: boolean;
  routingPreference: string;
  setRoutingPreference: (pref: any) => void;
  startNavigation?: () => void;
}

export function RoutingPanel({
  activeStation,
  journeyStarted,
  routeOptions,
  selectedRoute,
  handleSelectRoute,
  calculateRoute,
  setJourneyStarted,
  travelInfo,
  instructions,
  analyzeRoute,
  isAnalyzing,
  analysisResult,
  loading,
  routingPreference,
  setRoutingPreference,
  startNavigation,
}: RoutingPanelProps) {
  return (
    <div className="w-full lg:max-w-md animate-in fade-in slide-in-from-bottom-10 duration-700 pointer-events-auto flex flex-col md:max-h-full min-h-0">
      <GlassCard className="p-4 md:p-8 flex flex-col min-h-0 md:overflow-y-auto custom-scrollbar" variant="teal">
        <div className="flex justify-between items-start mb-4 md:mb-6 flex-shrink-0">
          <div>
            <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em] mb-2">Destination</p>
            <h2 className="text-2xl md:text-3xl font-black leading-tight text-white">{activeStation}</h2>
          </div>
          <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
        </div>

        {journeyStarted && routeOptions.length > 0 ? (
          <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-0">
            {/* Route Options Carousel */}
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x -mx-4 md:-mx-8 px-4 md:px-8 custom-scrollbar flex-shrink-0">
              {routeOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectRoute(opt)}
                  className={`snap-start flex-shrink-0 flex flex-col items-start p-4 rounded-2xl border transition-all text-left min-w-[160px] active:scale-95 ${
                    selectedRoute?.id === opt.id
                      ? 'bg-teal-500/20 border-teal-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase mb-1 ${selectedRoute?.id === opt.id ? 'text-teal-400' : 'text-slate-400'}`}>
                    {opt.type}
                  </p>
                  <p className="text-lg font-black text-white">{opt.duration}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] md:text-xs text-slate-400 font-medium">
                    <span>{opt.distance}</span>
                    <span>•</span>
                    <span>₱{opt.fare}</span>
                    <span>•</span>
                    <span>{opt.rides} {opt.rides === 1 ? 'ride' : 'rides'}</span>
                  </div>
                </button>
              ))}
            </div>



            <div className="bg-slate-950/50 rounded-2xl md:rounded-3xl p-4 md:p-5 overflow-y-auto custom-scrollbar border border-white/5 max-h-32 flex-shrink-0 md:max-h-none md:h-64 md:flex-shrink md:min-h-[140px]">
              <div className="space-y-3 md:space-y-5">
                {instructions.map((step, i) => (
                  <div key={i} className="flex gap-4 items-start group/step">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-teal-400 group-hover/step:bg-teal-500 group-hover/step:text-slate-950 transition-all">
                      {i + 1}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed group-hover/step:text-slate-100 transition-colors" dangerouslySetInnerHTML={{ __html: step }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-shrink-0 mt-auto">
              <TacticalButton
                variant="outline"
                onClick={() => setJourneyStarted(false)}
                className="flex-1 !py-3 md:!py-4 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
              >
                Cancel
              </TacticalButton>
              <TacticalButton
                variant="primary"
                onClick={analyzeRoute}
                disabled={isAnalyzing}
                className="px-4 md:px-6 flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-5.636l-.707-.707M6.342 16.126a7.5 7.5 0 1111.316 0l.243.517a.5.5 0 01-.456.702H6.555a.5.5 0 01-.456-.702l.243-.517z" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">AI Analyze</span>
                  </>
                )}
              </TacticalButton>
            </div>
            
            {startNavigation && (
              <button 
                onClick={startNavigation}
                className="w-full flex-shrink-0 bg-teal-500 text-slate-950 font-black py-3 md:py-4 rounded-xl shadow-lg shadow-teal-500/20 uppercase tracking-widest hover:bg-teal-400 transition-colors active:scale-95"
              >
                Start 3D Navigation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700">
            {/* Preference Selector */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'recommended', label: 'Recommended', icon: '✨' },
                { id: 'fastest', label: 'Fastest', icon: '⚡' },
                { id: 'cheapest', label: 'Cheapest', icon: '💰' },
                { id: 'walk', label: 'Walk Only', icon: '🚶' }
              ].map((pref) => (
                <button
                  key={pref.id}
                  onClick={() => setRoutingPreference(pref.id)}
                  className={`p-2 md:p-3 rounded-lg md:rounded-xl border text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 md:gap-2 transition-all ${
                    routingPreference === pref.id
                      ? 'bg-teal-500/20 border-teal-500 text-teal-400'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span>{pref.icon}</span>
                  {pref.label}
                </button>
              ))}
            </div>

            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Calculating the best {routingPreference === 'walk' ? 'walking path' : 'multi-modal routes'} for your commute in Metro Manila.
            </p>
            <TacticalButton
              variant="primary"
              fullWidth
              onClick={calculateRoute}
              disabled={loading}
              className="!py-3 md:!py-5 !rounded-2xl md:!rounded-[2rem] shadow-xl md:shadow-2xl shadow-teal-500/20 flex items-center justify-center gap-2 md:gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Find Best Route
                </>
              )}
            </TacticalButton>
          </div>
        )}

        {/* AI Insights Layer */}
        {analysisResult && (
          <div className="mt-6 p-5 bg-teal-500/10 border border-teal-500/30 rounded-3xl animate-in zoom-in-95 duration-500 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-shimmer" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                <span className="text-[10px] font-black uppercase text-teal-400 tracking-[0.2em]">Gemini AI Assistant</span>
              </div>
            </div>
            <p className="text-xs text-white/90 leading-relaxed font-medium">{analysisResult}</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
