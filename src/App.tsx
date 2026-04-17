/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSettings, AppSettings, saveSettings } from '@/lib/store';
import DailyRelease from '@/components/DailyRelease';
import AreaRelease from '@/components/AreaRelease';
import FocusedRelease from '@/components/FocusedRelease';
import CustomRelease from '@/components/CustomRelease';
import History from '@/components/History';
import Settings from '@/components/Settings';
import { Leaf, Globe, Target, User, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('daily');
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    document.documentElement.className = settings.theme;
  }, [settings.theme]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black tracking-[0.3em] text-foreground uppercase font-serif">SEDONA</h1>
          </div>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-full transition-all ${activeTab === 'settings' ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'daily' && <DailyRelease settings={settings} />}
            {activeTab === 'area' && <AreaRelease settings={settings} />}
            {activeTab === 'focused' && <FocusedRelease settings={settings} />}
            {activeTab === 'custom' && <CustomRelease settings={settings} />}
            {activeTab === 'history' && <History />}
            {activeTab === 'settings' && <Settings settings={settings} onSettingsChange={setSettings} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md pb-safe">
        <div className="container mx-auto px-4 h-16 flex items-center justify-around">
          <NavButton 
            active={activeTab === 'daily'} 
            onClick={() => setActiveTab('daily')} 
            icon={<Leaf className="w-5 h-5" />} 
            label="日常" 
          />
          <NavButton 
            active={activeTab === 'area'} 
            onClick={() => setActiveTab('area')} 
            icon={<Globe className="w-5 h-5" />} 
            label="领域" 
          />
          <NavButton 
            active={activeTab === 'focused'} 
            onClick={() => setActiveTab('focused')} 
            icon={<Target className="w-5 h-5" />} 
            label="集中" 
          />
          <NavButton 
            active={activeTab === 'custom'} 
            onClick={() => setActiveTab('custom')} 
            icon={<User className="w-5 h-5" />} 
            label="自定义" 
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
            icon={<HistoryIcon className="w-5 h-5" />} 
            label="历史" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator" 
          className="absolute -top-1 w-8 h-1 bg-primary rounded-full"
        />
      )}
    </button>
  );
}

