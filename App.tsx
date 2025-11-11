import React, { useState, useMemo, useEffect } from 'react';
import { CaseData, View } from './types';
import FileUpload from './components/FileUpload';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { parseAndCleanData } from './utils';
import { defaultDataCSV } from './default-data';
import VoiceAssistant from './components/VoiceAssistant';

type Screen = 'upload' | 'dashboard';

const App: React.FC = () => {
    const [data, setData] = useState<CaseData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<View>('home');
    const [screen, setScreen] = useState<Screen>('upload');

    useEffect(() => {
        // Start with a small delay to allow the upload screen to render first, improving user experience.
        setTimeout(() => {
            const { data: parsedData, error: parseError } = parseAndCleanData(defaultDataCSV);
            if (parseError) {
                setError(parseError);
                setData(null);
                setScreen('upload'); 
            } else {
                setData(parsedData);
                setError(null);
                setScreen('dashboard');
            }
        }, 100);
    }, []);

    const handleDataLoaded = (csvText: string) => {
        const { data: parsedData, error: parseError } = parseAndCleanData(csvText);
        if (parseError) {
            setError(parseError);
            setData(null);
            setScreen('upload');
        } else {
            setData(parsedData);
            setError(null);
            setActiveView('home');
            setScreen('dashboard');
        }
    };

    const handleReset = () => {
        setData(null);
        setError(null);
        setScreen('upload');
    };

    const uniqueValues = useMemo(() => {
        if (!data) return { offenseCategories: [], incidentCities: [] };
        const offenseCategories = [...new Set(data.map(d => d.CATEGORIA_DELITO))].sort();
        const incidentCities = [...new Set(data.map(d => d.CIUDAD_INCIDENTE))].sort();
        return { offenseCategories, incidentCities };
    }, [data]);
    
    if (screen === 'upload' || !data) {
        return <FileUpload onDataLoaded={handleDataLoaded} error={error} />;
    }

    return (
        <div className="flex h-screen bg-neutral-base">
            <Sidebar activeView={activeView} setActiveView={setActiveView} onReset={handleReset} />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <Dashboard 
                    data={data} 
                    activeView={activeView} 
                    uniqueValues={uniqueValues} 
                />
            </main>
            <VoiceAssistant data={data} />
        </div>
    );
};

export default App;