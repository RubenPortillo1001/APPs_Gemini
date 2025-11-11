// This is a large component containing all analysis logic and views.
// For a larger application, these sections would be split into separate files.

import React, 'useMemo', useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { CaseData, View, FilterState } from '../types';
import Card from './Card';
import Alert from './Alert';
import { getAgeGroup } from '../utils';
import { jsPDF } from "jspdf";

declare global {
    interface Window {
        html2canvas: any;
    }
}

interface DashboardProps {
    data: CaseData[];
    activeView: View;
    uniqueValues: {
        offenseCategories: string[];
        incidentCities: string[];
    };
}

// Chart color palette
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const RACE_COLORS: { [key: string]: string } = {
    'Black': '#3b82f6',
    'White': '#ef4444',
    'Hispanic': '#f97316',
    'ASIAN': '#22c55e',
    'Other': '#8b5cf6',
    'Unknown': '#6b7280',
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm">
          <p className="font-bold">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toLocaleString()}${entry.unit || ''}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
};


const Dashboard: React.FC<DashboardProps> = ({ data, activeView, uniqueValues }) => {
    
    const yearExtent = useMemo(() => {
        const years = data.map(d => d.FECHA_RECEPCION.getFullYear());
        return [Math.min(...years), Math.max(...years)] as [number, number];
    }, [data]);

    const [filters, setFilters] = useState<FilterState>({
        yearRange: yearExtent,
        offenseCategory: 'All',
        incidentCity: 'All',
    });
    
    const [thresholds, setThresholds] = useState({
        representation: { under: 10, over: 60 },
        disposition: 15,
        sentencing: 1.5,
        duration: 60,
    });

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const year = d.FECHA_RECEPCION.getFullYear();
            const yearMatch = year >= filters.yearRange[0] && year <= filters.yearRange[1];
            const offenseMatch = filters.offenseCategory === 'All' || d.CATEGORIA_DELITO === filters.offenseCategory;
            const cityMatch = filters.incidentCity === 'All' || d.CIUDAD_INCIDENTE === filters.incidentCity;
            return yearMatch && offenseMatch && cityMatch;
        });
    }, [data, filters]);

    const handleExportPDF = () => {
        const input = document.getElementById('pdf-content');
        if (input) {
            const sidebar = document.querySelector('.no-print');
            (sidebar as HTMLElement).style.display = 'none';

            window.html2canvas(input, { scale: 2 }).then((canvas: any) => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'px',
                    format: 'a4'
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                const width = pdfWidth;
                const height = width / ratio;
                
                let position = 0;
                let heightLeft = height;

                pdf.addImage(imgData, 'PNG', 0, position, width, height);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = position - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, width, height);
                    heightLeft -= pdfHeight;
                }

                pdf.save('informe_sesgos.pdf');
                (sidebar as HTMLElement).style.display = 'flex';
            });
        }
    };
    
     const handleExportCSV = (summary: boolean) => {
        let csvContent = "data:text/csv;charset=utf-8,";
        let rows: any[] = [];
        let filename = 'datos_procesados.csv';

        if(summary) {
            const races = [...new Set(filteredData.map(d => d.RAZA))];
            rows.push(['Raza', 'Total Casos', 'Sentencia Promedio (Años)']);
            races.forEach(race => {
                const groupData = filteredData.filter(d => d.RAZA === race);
                const avgSentence = groupData.reduce((acc, d) => acc + (d.SENTENCE_IN_YEARS || 0), 0) / groupData.length;
                rows.push([race, groupData.length, avgSentence.toFixed(2)]);
            });
            filename = 'resumen_sesgos.csv';
        } else {
            rows = [Object.keys(filteredData[0])];
            filteredData.forEach(item => {
                rows.push(Object.values(item).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v));
            });
        }
        
        rows.forEach(function(rowArray) {
            let row = rowArray.join(",");
            csvContent += row + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const renderContent = () => {
        switch (activeView) {
            case 'home': return <DataSummary data={data} />;
            case 'summary': return <BiasSummaryDashboard data={filteredData} thresholds={thresholds} />;
            case 'demographics': return <DemographicAnalysis data={filteredData} thresholds={thresholds} />;
            case 'dispositions': return <DispositionAnalysis data={filteredData} thresholds={thresholds} />;
            case 'sentencing': return <SentencingAnalysis data={filteredData} thresholds={thresholds} />;
            case 'duration': return <DurationAnalysis data={filteredData} thresholds={thresholds} />;
            case 'intersectional': return <IntersectionalAnalysis data={filteredData} />;
            case 'reports': return (
                <Card title="Generación de Informes">
                    <div className="space-y-4">
                        <p>Exporte los análisis actuales y datos procesados.</p>
                        <div className="flex space-x-4">
                            <button onClick={handleExportPDF} className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition-colors">Exportar a PDF</button>
                            <button onClick={() => handleExportCSV(false)} className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors">Exportar Datos Procesados (CSV)</button>
                            <button onClick={() => handleExportCSV(true)} className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors">Exportar Resumen (CSV)</button>
                        </div>
                        <div className="pt-8 text-sm text-gray-600">
                            <h4 className="font-bold mb-2">Referencias</h4>
                            <p><strong>Estudio de Referencia:</strong> Sargent, J., & Weber, M. (2022). <i>Identifying biases in legal data: An algorithmic fairness perspective</i>. arXiv preprint arXiv:2208.09946.</p>
                            <p className="mt-2"><strong>Metodología:</strong> Los scores y alertas de sesgo se basan en comparaciones de proporciones y promedios entre grupos demográficos, con umbrales predefinidos inspirados en el estudio de referencia.</p>
                        </div>
                    </div>
                </Card>
            );
            default: return <div>Seleccione una vista</div>;
        }
    };
    
    const showFilters = ['demographics', 'dispositions', 'sentencing', 'duration', 'intersectional'].includes(activeView);

    return (
        <div id="pdf-content">
            {showFilters && (
                <Card title="Filtros Interactivos" className="mb-6 no-print">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Rango de Años ({filters.yearRange[0]} - {filters.yearRange[1]})</label>
                            <div className="flex space-x-2">
                                <input type="range" min={yearExtent[0]} max={yearExtent[1]} value={filters.yearRange[0]} onChange={(e) => setFilters(f => ({...f, yearRange: [Math.min(parseInt(e.target.value), f.yearRange[1]-1), f.yearRange[1]]}))} className="w-full" />
                                <input type="range" min={yearExtent[0]} max={yearExtent[1]} value={filters.yearRange[1]} onChange={(e) => setFilters(f => ({...f, yearRange: [f.yearRange[0], Math.max(parseInt(e.target.value), f.yearRange[0]+1)]}))} className="w-full" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="offense" className="block text-sm font-medium text-gray-700">Categoría de Delito</label>
                            <select id="offense" value={filters.offenseCategory} onChange={e => setFilters({...filters, offenseCategory: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                                <option>All</option>
                                {uniqueValues.offenseCategories.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                             <label htmlFor="city" className="block text-sm font-medium text-gray-700">Ciudad del Incidente</label>
                            <select id="city" value={filters.incidentCity} onChange={e => setFilters({...filters, incidentCity: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                                <option>All</option>
                                {uniqueValues.incidentCities.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </Card>
            )}
            {renderContent()}
        </div>
    );
};


// Sub-components for different views

const DataSummary: React.FC<{ data: CaseData[] }> = ({ data }) => {
    const stats = useMemo(() => {
        if (!data) return null;
        const years = data.map(d => d.FECHA_RECEPCION.getFullYear());
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const uniqueRaces = new Set(data.map(d => d.RAZA)).size;
        const uniqueOffenses = new Set(data.map(d => d.CATEGORIA_DELITO)).size;
        return {
            totalCases: data.length,
            dateRange: `${minYear} - ${maxYear}`,
            uniqueRaces,
            uniqueOffenses
        }
    }, [data]);

    const columnDescriptions = [
        { name: 'ID_CASO', description: 'Identificador único para cada caso.' },
        { name: 'FECHA_RECEPCION', description: 'Fecha en que la unidad de revisión recibió el caso.' },
        { name: 'RAZA', description: 'Raza del acusado (autoinformada o registrada por la policía).' },
        { name: 'GENERO', description: 'Género del acusado.' },
        { name: 'EDAD_AL_INCIDENTE', description: 'Edad del acusado en el momento del delito.' },
        { name: 'CATEGORIA_DELITO', description: 'Clasificación general del tipo de delito.' },
        { name: 'DISPOSICION_CARGO', description: 'Resultado final del cargo (ej. culpable, desestimado).' },
        { name: 'TIPO_SENTENCIA', description: 'Tipo de sentencia impuesta (ej. prisión, libertad condicional).' },
        { name: 'DURACION_CASO_EN_DIAS', description: 'Número de días desde la acusación hasta la sentencia.' },
    ];

    return (
        <div className="space-y-6">
            <Card title="Estadísticas Básicas del Dataset">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{stats?.totalCases.toLocaleString()}</p>
                        <p className="text-sm text-gray-500">Total de Casos</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{stats?.dateRange}</p>
                        <p className="text-sm text-gray-500">Rango de Fechas</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{stats?.uniqueRaces}</p>
                        <p className="text-sm text-gray-500">Grupos Raciales</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{stats?.uniqueOffenses}</p>
                        <p className="text-sm text-gray-500">Categorías de Delitos</p>
                    </div>
                </div>
            </Card>
            <Card title="Descripción de Columnas Principales">
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Nombre de Columna</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {columnDescriptions.map((col, i) => (
                               <tr key={col.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                   <td className="px-4 py-2 whitespace-nowrap font-mono text-gray-800">{col.name}</td>
                                   <td className="px-4 py-2 text-gray-700">{col.description}</td>
                               </tr>
                           ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

const DemographicAnalysis: React.FC<{ data: CaseData[]; thresholds: any }> = ({ data, thresholds }) => {
    const memoizedStats = useMemo(() => {
        const raceCounts = data.reduce((acc, d) => { acc[d.RAZA] = (acc[d.RAZA] || 0) + 1; return acc; }, {} as Record<string, number>);
        const genderCounts = data.reduce((acc, d) => { acc[d.GENERO] = (acc[d.GENERO] || 0) + 1; return acc; }, {} as Record<string, number>);
        
        const total = data.length;
        const raceData = Object.entries(raceCounts).map(([name, value]) => ({ name, value, percentage: (value / total) * 100 }));
        const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value, percentage: (value / total) * 100 }));
        
        const ageCounts = data.reduce((acc, d) => {
            const age = d.EDAD_AL_INCIDENTE;
            if (age && age > 0) {
                const bin = Math.floor(age / 5) * 5; // Bins of 5 years
                const binName = `${bin}-${bin + 4}`;
                acc[binName] = (acc[binName] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const ageData = Object.entries(ageCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => parseInt(a.name.split('-')[0]) - parseInt(b.name.split('-')[0]));

        const representationAlerts = raceData.filter(r => r.percentage < thresholds.representation.under || r.percentage > thresholds.representation.over);

        return { raceData, genderData, ageData, representationAlerts };
    }, [data, thresholds]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis Demográfico</h2>
            {memoizedStats.representationAlerts.length > 0 && (
                <Alert type="warning" title="Alerta de Representación Desproporcionada">
                    <ul>{memoizedStats.representationAlerts.map(r => <li key={r.name}>{`${r.name} representa el ${r.percentage.toFixed(1)}% de los casos, lo cual está fuera del umbral de normalidad (${thresholds.representation.under}%-${thresholds.representation.over}%).`}</li>)}</ul>
                </Alert>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Distribución por Raza">
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={memoizedStats.raceData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Casos">
                                {memoizedStats.raceData.map(entry => <Cell key={`cell-${entry.name}`} fill={RACE_COLORS[entry.name] || '#8884d8'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                 <Card title="Distribución por Género">
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                             <Pie data={memoizedStats.genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry) => `${entry.name} (${(entry.percent * 100).toFixed(1)}%)`}>
                                {memoizedStats.genderData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>
             <Card title="Distribución por Edad en el Incidente">
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={memoizedStats.ageData}>
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis dataKey="name" name="Rango de Edad" interval={0} angle={-30} textAnchor="end" height={50} />
                         <YAxis />
                         <Tooltip content={<CustomTooltip />} />
                         <Legend verticalAlign="top" />
                         <Bar dataKey="value" name="Número de Casos" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
             </Card>
        </div>
    );
};

const BiasSummaryDashboard: React.FC<{ data: CaseData[]; thresholds: any }> = ({ data, thresholds }) => {
    // Simplified scoring logic for demonstration
    const scores = useMemo(() => {
        if (data.length === 0) return { rep: 100, disp: 100, sent: 100, dur: 100, global: 100, findings: [] };

        // Representation
        const raceCounts = data.reduce((acc, d) => { acc[d.RAZA] = (acc[d.RAZA] || 0) + 1; return acc; }, {} as Record<string, number>);
        const total = data.length;
        const raceData = Object.entries(raceCounts).map(([name, value]) => ({ name, value, percentage: (value / total) * 100 }));
        const maxRepDeviation = Math.max(...raceData.map(r => Math.abs(r.percentage - (100 / raceData.length))));
        const repScore = Math.max(0, 100 - maxRepDeviation * 2);

        // Disposition (Conviction Rate)
        const dispositions = data.reduce((acc, d) => {
            if (!acc[d.RAZA]) acc[d.RAZA] = { total: 0, guilty: 0 };
            acc[d.RAZA].total++;
            if (d.DISPOSICION_CARGO.toLowerCase().includes('guilty')) {
                acc[d.RAZA].guilty++;
            }
            return acc;
        }, {} as Record<string, { total: number; guilty: number }>);
        const dispRates = Object.values(dispositions).map(v => (v.guilty / v.total) * 100);
        const maxDispDiff = dispRates.length > 1 ? Math.max(...dispRates) - Math.min(...dispRates) : 0;
        const dispScore = Math.max(0, 100 - maxDispDiff * 2.5);

        // Sentencing
        const sentencesByRace = data.reduce((acc, d) => {
            if(d.SENTENCE_IN_YEARS !== undefined) {
                if (!acc[d.RAZA]) acc[d.RAZA] = [];
                acc[d.RAZA].push(d.SENTENCE_IN_YEARS);
            }
            return acc;
        }, {} as Record<string, number[]>);
        const avgSentences = Object.values(sentencesByRace).map(s => s.reduce((a,b) => a+b, 0) / s.length).filter(v => !isNaN(v));
        const minAvgSentence = Math.min(...avgSentences);
        const sentRatio = avgSentences.length > 1 && minAvgSentence > 0 ? Math.max(...avgSentences) / minAvgSentence : 1;
        const sentScore = Math.max(0, 100 - (sentRatio - 1) * 50);

        // Duration
        const durationsByRace = data.reduce((acc, d) => {
            if (!acc[d.RAZA]) acc[d.RAZA] = [];
            acc[d.RAZA].push(d.DURACION_CASO_EN_DIAS);
            return acc;
        }, {} as Record<string, number[]>);
        const avgDurations = Object.values(durationsByRace).map(s => s.reduce((a,b) => a+b, 0) / s.length).filter(v => !isNaN(v));
        const maxDurDiff = avgDurations.length > 1 ? Math.max(...avgDurations) - Math.min(...avgDurations) : 0;
        const durScore = Math.max(0, 100 - maxDurDiff / 5);
        
        const globalScore = (repScore + dispScore + sentScore + durScore) / 4;

        return { rep: repScore, disp: dispScore, sent: sentScore, dur: durScore, global: globalScore };
    }, [data]);
    
    const getScoreColor = (score: number) => {
        if (score < 50) return 'text-danger-text';
        if (score < 80) return 'text-warning-text';
        return 'text-success-text';
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Panel de Resumen de Sesgos</h2>
            <Card title="Scorecard de Equidad">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className={`text-4xl font-bold ${getScoreColor(scores.global)}`}>{scores.global.toFixed(0)}</p>
                        <p className="text-sm font-semibold text-gray-600">Score Global</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className={`text-3xl font-bold ${getScoreColor(scores.rep)}`}>{scores.rep.toFixed(0)}</p>
                        <p className="text-sm text-gray-500">Representación</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className={`text-3xl font-bold ${getScoreColor(scores.disp)}`}>{scores.disp.toFixed(0)}</p>
                        <p className="text-sm text-gray-500">Disposiciones</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className={`text-3xl font-bold ${getScoreColor(scores.sent)}`}>{scores.sent.toFixed(0)}</p>
                        <p className="text-sm text-gray-500">Sentencias</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className={`text-3xl font-bold ${getScoreColor(scores.dur)}`}>{scores.dur.toFixed(0)}</p>
                        <p className="text-sm text-gray-500">Duración</p>
                    </div>
                </div>
            </Card>
             <Card title="Recomendaciones Automatizadas">
                <p>Basado en los scores, las áreas prioritarias para una revisión más profunda son:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    {scores.disp < 80 && <li><strong>Resultados del Caso:</strong> Investigar por qué las tasas de culpabilidad varían significativamente entre grupos.</li>}
                    {scores.sent < 80 && <li><strong>Severidad de Sentencias:</strong> Analizar las sentencias por tipo de delito y juez para entender las disparidades en la duración.</li>}
                    {scores.dur < 80 && <li><strong>Duración Procesal:</strong> Identificar cuellos de botella en el sistema que afectan desproporcionadamente a ciertos grupos.</li>}
                     {scores.global >= 80 && <li>Los indicadores generales de sesgo son bajos. Se recomienda un análisis más detallado a nivel interseccional.</li>}
                </ul>
            </Card>
        </div>
    );
};

const DispositionAnalysis: React.FC<{ data: CaseData[], thresholds: any }> = ({ data, thresholds }) => {
    const memoizedStats = useMemo(() => {
        const races = [...new Set(data.map(d => d.RAZA))];
        const keyDispositions = {
            'Declarado Culpable': (d: string) => d.toLowerCase().includes('guilty'),
            'Desestimado (Nolle)': (d: string) => d.toLowerCase().includes('nolle'),
        };

        const statsByRace: { [key: string]: { [key: string]: number, total: number } } = {};
        
        data.forEach(d => {
            if (!statsByRace[d.RAZA]) {
                statsByRace[d.RAZA] = { 'Declarado Culpable': 0, 'Desestimado (Nolle)': 0, total: 0 };
            }
            statsByRace[d.RAZA].total++;
            for (const [key, check] of Object.entries(keyDispositions)) {
                if (check(d.DISPOSICION_CARGO)) {
                    statsByRace[d.RAZA][key]++;
                }
            }
        });

        const chartData = races.map(race => {
            const stats = statsByRace[race];
            const result: { name: string, [key: string]: any } = { name: race };
            for (const key of Object.keys(keyDispositions)) {
                result[key] = stats ? (stats[key] / stats.total * 100) : 0;
            }
            return result;
        });
        
        const rates: { [key:string]: number[] } = {};
        chartData.forEach(d => {
            for(const key in d) {
                if (key !== 'name') {
                    if(!rates[key]) rates[key] = [];
                    rates[key].push(d[key]);
                }
            }
        });

        const alerts: { disposition: string, diff: number }[] = [];
        for (const [key, values] of Object.entries(rates)) {
            const diff = Math.max(...values) - Math.min(...values);
            if (diff > thresholds.disposition) {
                alerts.push({ disposition: key, diff: Math.round(diff) });
            }
        }
        
        return { chartData, alerts, statsByRace };
    }, [data, thresholds]);
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Resultados del Caso</h2>
            {memoizedStats.alerts.map(alert => (
                <Alert key={alert.disposition} type="danger" title="Sesgo Potencial Detectado">
                    La diferencia en la tasa de "<strong>{alert.disposition}</strong>" entre grupos raciales es del <strong>{alert.diff}%</strong>, superando el umbral del {thresholds.disposition}%.
                </Alert>
            ))}
            <Card title="Comparación de Tasas de Disposición por Raza (%)">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={memoizedStats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip content={<CustomTooltip unit="%" />} />
                        <Legend />
                        <Bar dataKey="Declarado Culpable" fill="#ef4444" />
                        <Bar dataKey="Desestimado (Nolle)" fill="#22c55e" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};
const SentencingAnalysis: React.FC<{ data: CaseData[], thresholds: any }> = ({ data, thresholds }) => {
     const memoizedStats = useMemo(() => {
        const dataWithSentence = data.filter(d => d.SENTENCE_IN_YEARS !== undefined && d.SENTENCE_IN_YEARS < 99); // Exclude 'Natural Life'
        
        const statsByRace = dataWithSentence.reduce((acc, d) => {
            if (!acc[d.RAZA]) acc[d.RAZA] = [];
            acc[d.RAZA].push(d.SENTENCE_IN_YEARS!);
            return acc;
        }, {} as Record<string, number[]>);

        const chartData = Object.entries(statsByRace).map(([race, sentences]) => ({
            name: race,
            'Sentencia Promedio': sentences.reduce((a, b) => a + b, 0) / sentences.length,
        }));

        const averages = chartData.map(d => d['Sentencia Promedio']).filter(avg => avg > 0);
        let disparityRatio = 1;
        let maxAvg = 0, minAvg = 0;
        if (averages.length > 1) {
            maxAvg = Math.max(...averages);
            minAvg = Math.min(...averages);
            if (minAvg > 0) {
                disparityRatio = maxAvg / minAvg;
            }
        }

        const tableData = dataWithSentence.reduce((acc, d) => {
            const key = `${d.RAZA} - ${d.CATEGORIA_DELITO}`;
            if (!acc[key]) acc[key] = { race: d.RAZA, offense: d.CATEGORIA_DELITO, sentences: [] };
            acc[key].sentences.push(d.SENTENCE_IN_YEARS!);
            return acc;
        }, {} as Record<string, { race: string, offense: string, sentences: number[] }>);

        const topTableData = Object.values(tableData).map(d => ({
            ...d,
            avgSentence: d.sentences.reduce((a, b) => a + b, 0) / d.sentences.length,
            count: d.sentences.length,
        })).filter(d => d.count > 5).sort((a,b) => b.count - a.count).slice(0, 10);

        return { chartData, disparityRatio, topTableData };
    }, [data]);
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Severidad de Sentencias</h2>
            {memoizedStats.disparityRatio > thresholds.sentencing && (
                <Alert type="danger" title="Disparidad Significativa en Sentencias">
                    La sentencia promedio para un grupo es <strong>{memoizedStats.disparityRatio.toFixed(2)} veces mayor</strong> que para otro, superando el umbral de {thresholds.sentencing}.
                </Alert>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Sentencia Promedio por Raza (Años)">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={memoizedStats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Sentencia Promedio" name="Años">
                                {memoizedStats.chartData.map(entry => <Cell key={`cell-${entry.name}`} fill={RACE_COLORS[entry.name] || '#8884d8'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                <Card title="Sentencia Promedio por Delito y Raza (Top 10)">
                    <div className="overflow-x-auto text-sm">
                        <table className="min-w-full">
                            <thead><tr className="border-b"><th className="text-left py-1">Delito/Raza</th><th className="text-right py-1">Prom. Años</th></tr></thead>
                            <tbody>
                                {memoizedStats.topTableData.map(d => (
                                    <tr key={`${d.race}-${d.offense}`} className="border-b">
                                        <td className="py-1"><strong>{d.offense}</strong><br/><span className="text-gray-600">{d.race} ({d.count} casos)</span></td>
                                        <td className="text-right py-1 font-semibold">{d.avgSentence.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};
const DurationAnalysis: React.FC<{ data: CaseData[], thresholds: any }> = ({ data, thresholds }) => {
    const memoizedStats = useMemo(() => {
        const statsByRace = data.reduce((acc, d) => {
            if (d.DURACION_CASO_EN_DIAS > 0) {
                if (!acc[d.RAZA]) acc[d.RAZA] = [];
                acc[d.RAZA].push(d.DURACION_CASO_EN_DIAS);
            }
            return acc;
        }, {} as Record<string, number[]>);

        const chartData = Object.entries(statsByRace).map(([race, durations]) => ({
            name: race,
            'Duración Promedio (Días)': durations.reduce((a, b) => a + b, 0) / durations.length,
        }));

        const averages = chartData.map(d => d['Duración Promedio (Días)']);
        const diff = averages.length > 1 ? Math.max(...averages) - Math.min(...averages) : 0;

        const scatterData = data
            .filter(d => d.SENTENCE_IN_YEARS !== undefined && d.DURACION_CASO_EN_DIAS > 0 && d.SENTENCE_IN_YEARS < 99)
            .map(d => ({
                race: d.RAZA,
                duration: d.DURACION_CASO_EN_DIAS,
                sentence: d.SENTENCE_IN_YEARS,
            }));

        return { chartData, diff, scatterData };
    }, [data]);
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Duración Procesal</h2>
            {memoizedStats.diff > thresholds.duration && (
                <Alert type="warning" title="Sesgo Temporal Detectado">
                    La diferencia en la duración promedio del caso entre grupos es de <strong>{memoizedStats.diff.toFixed(0)} días</strong>, superando el umbral de {thresholds.duration} días.
                </Alert>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Duración Promedio del Caso por Raza">
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={memoizedStats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Duración Promedio (Días)">
                                {memoizedStats.chartData.map(entry => <Cell key={`cell-${entry.name}`} fill={RACE_COLORS[entry.name] || '#8884d8'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                <Card title="Correlación Duración vs. Sentencia">
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart>
                            <CartesianGrid />
                            <XAxis type="number" dataKey="sentence" name="Sentencia (Años)" unit="años" />
                            <YAxis type="number" dataKey="duration" name="Duración (Días)" unit="días" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Legend />
                            {Object.keys(RACE_COLORS).map(race => (
                                <Scatter key={race} name={race} data={memoizedStats.scatterData.filter(d => d.race === race)} fill={RACE_COLORS[race]} />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
};
const IntersectionalAnalysis: React.FC<{ data: CaseData[] }> = ({ data }) => {
     const memoizedData = useMemo(() => {
        const intersectionalData = data.map(d => ({
            ...d,
            ageGroup: getAgeGroup(d.EDAD_AL_INCIDENTE),
            intersection: `${d.RAZA}-${d.GENERO}-${getAgeGroup(d.EDAD_AL_INCIDENTE)}`,
            isGuilty: d.DISPOSICION_CARGO.toLowerCase().includes('guilty'),
        }));

        const stats = intersectionalData.reduce((acc, d) => {
            if(!acc[d.intersection]) acc[d.intersection] = { total: 0, guilty: 0, avgSentence: [], avgDuration: []};
            acc[d.intersection].total++;
            if(d.isGuilty) acc[d.intersection].guilty++;
            if(d.SENTENCE_IN_YEARS) acc[d.intersection].avgSentence.push(d.SENTENCE_IN_YEARS);
            if(d.DURACION_CASO_EN_DIAS) acc[d.intersection].avgDuration.push(d.DURACION_CASO_EN_DIAS);
            return acc;
        }, {} as Record<string, {total: number, guilty: number, avgSentence: number[], avgDuration: number[]}>);
        
        return Object.entries(stats).map(([intersection, values]) => ({
            intersection,
            count: values.total,
            convictionRate: (values.guilty / values.total * 100).toFixed(1),
            avgSentence: (values.avgSentence.reduce((a, b) => a + b, 0) / values.avgSentence.length || 0).toFixed(2),
            avgDuration: (values.avgDuration.reduce((a, b) => a + b, 0) / values.avgDuration.length || 0).toFixed(0)
        })).sort((a,b) => b.count - a.count);

    }, [data]);
    
     return (
         <Card title="Análisis Interseccional (Raza, Género y Edad)">
            <p className="text-sm text-gray-600 mb-4">Esta tabla muestra los resultados para combinaciones demográficas. Identifica grupos con peores resultados.</p>
             <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Grupo Interseccional</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Total Casos</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Tasa Condena (%)</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Sentencia Prom. (Años)</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Duración Prom. (Días)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {memoizedData.slice(0, 20).map((row, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">{row.intersection}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{row.count}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{row.convictionRate}%</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{row.avgSentence}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{row.avgDuration}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
         </Card>
     );
};

export default Dashboard;