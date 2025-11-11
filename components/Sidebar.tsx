import React from 'react';
import { View } from '../types';

interface SidebarProps {
    activeView: View;
    setActiveView: (view: View) => void;
    onReset: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onReset }) => {
    
    const navItems: { id: View; label: string; icon: React.ReactElement }[] = [
        { id: 'home', label: 'Inicio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg> },
        { id: 'summary', label: 'Resumen de Sesgos', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg> },
        { id: 'demographics', label: 'Análisis Demográfico', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg> },
        { id: 'dispositions', label: 'Resultados del Caso', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.572 2.082a1 1 0 011.856 0l1.25 4.582a1 1 0 00.948.691h4.869a1 1 0 01.626 1.834l-3.94 2.855a1 1 0 00-.364 1.118l1.25 4.583a1 1 0 01-1.522 1.18l-3.94-2.855a1 1 0 00-1.175 0l-3.94 2.855a1 1 0 01-1.522-1.18l1.25-4.583a1 1 0 00-.364-1.118L2.082 9.189a1 1 0 01.626-1.834h4.869a1 1 0 00.948-.691l1.25-4.582z" clipRule="evenodd" /></svg> },
        { id: 'sentencing', label: 'Análisis de Sentencias', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1.333H3.333A1.333 1.333 0 002 5.667v10.666c0 .734.599 1.334 1.333 1.334h13.334c.734 0 1.333-.6 1.333-1.334V5.667A1.333 1.333 0 0016.667 4.333H11V3a1 1 0 00-1-1zm-6.667 4.667a.667.667 0 01.667-.667h1.333a.667.667 0 010 1.333H4a.667.667 0 01-.667-.667zm0 2.667a.667.667 0 01.667-.667h5.333a.667.667 0 110 1.333H4a.667.667 0 01-.667-.667zm0 2.666a.667.667 0 01.667-.666h9.333a.667.667 0 110 1.333H4a.667.667 0 01-.667-.666z" clipRule="evenodd" /></svg> },
        { id: 'duration', label: 'Duración Procesal', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.5-11.5a.5.5 0 00-1 0v5.793L13.146 16.146a.5.5 0 00.708-.708L10 11.293V6.5z" clipRule="evenodd" /></svg> },
        { id: 'intersectional', label: 'Análisis Interseccional', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C3.41 4.515 10 .5 10 .5s6.588 4.015 9.542 9.5c-2.952 5.485-9.542 9.5-9.542 9.5S3.41 15.485.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg> },
        { id: 'reports', label: 'Generar Informes', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 1a1 1 0 000 2h8a1 1 0 100-2H6zM6 9a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" /></svg> },
    ];

    return (
        <aside className="no-print bg-sidebar text-sidebar-text w-64 p-4 flex flex-col space-y-4 h-full shadow-lg">
            <div className="text-center py-4 border-b border-gray-700">
                <h2 className="text-xl font-bold">Análisis de Sesgos</h2>
            </div>
            <nav className="flex-1">
                <ul className="space-y-2">
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center space-x-3 p-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === item.id ? 'bg-primary text-white' : 'hover:bg-sidebar-hover hover:text-white'
                                }`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="pt-4 border-t border-gray-700">
                <button
                    onClick={onReset}
                    className="w-full flex items-center justify-center space-x-3 p-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm10 15a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 01-1 1z" clipRule="evenodd" /></svg>
                    <span>Cargar Nuevo Archivo</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
