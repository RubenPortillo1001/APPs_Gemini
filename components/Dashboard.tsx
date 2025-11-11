// This is a large component containing all analysis logic and views.
// For a larger application, these sections would be split into separate files.

import React, { useMemo, useState, useEffect } from 'react';
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

// Sub-components for different views

const DataSummary: React.FC<{ data: CaseData[] }> = ({ data }) => {
    const stats = useMemo(() => {
        if (!data || data.length === 0) {
            return {
                totalCases: 0,
                dateRange: 'N/A',
                uniqueRaces: 0,
                uniqueOffenses: 0
            };
        }
        const years = data.map(d => d.FECHA_RECEPCION.getFullYear()).filter(y => !isNaN(y));
        const minYear = years.length > 0 ? Math.min(...years) : 'N/A';
        const maxYear = years.length > 0 ? Math.max(...years) : '';
        const uniqueRaces = new Set(data.map(d => d.RAZA)).size;
        const uniqueOffenses = new Set(data.map(d => d.CATEGORIA_DELITO)).size;
        return {
            totalCases: data.length,
            dateRange: years.length > 0 ? `${minYear} - ${maxYear}` : 'N/A',
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
        if (data.length === 0) return { rep: 100, disp: 100, sent: 100, dur: 100, global: 100, findings: [] as string[] };

        let findings: string[] = [];

        // Representation Score
        const raceCounts = data.reduce((acc, d) => { acc[d.RAZA] = (acc[d.RAZA] || 0) + 1; return acc; }, {} as Record<string, number>);
        const total = data.length;
        const raceData = Object.entries(raceCounts).map(([name, value]) => ({ name, value, percentage: (value / total) * 100 }));
        const maxRepDeviation = raceData.length > 0 ? Math.max(...raceData.map(r => Math.abs(r.percentage - (100 / raceData.length)))) : 0;
        const repScore = Math.max(0, 100 - maxRepDeviation * 2);
        if (repScore < 70) findings.push("Existe una desviación significativa en la representación demográfica.");

        // Disposition Score (Example: difference in 'Guilty' pleas between races)
        const guiltyData = data.filter(d => d.DISPOSICION_CARGO.toLowerCase().includes('guilty'));
        const guiltyByRace = guiltyData.reduce((acc, d) => { acc[d.RAZA] = (acc[d.RAZA] || 0) + 1; return acc; }, {} as Record<string, number>);
        const guiltyRates = raceData.map(r => (guiltyByRace[r.name] || 0) / r.value);
        const maxDispRateDiff = guiltyRates.length > 0 ? (Math.max(...guiltyRates) - Math.min(...guiltyRates)) * 100 : 0;
        const dispScore = Math.max(0, 100 - maxDispRateDiff * 2);
        if (dispScore < 70) findings.push("Hay disparidades notables en los resultados de 'culpable' entre grupos raciales.");

        // Sentencing Score
        const races = [...new Set(data.map(d => d.RAZA))];
        const avgSentences = races.map(race => {
            const group = data.filter(d => d.RAZA === race && d.SENTENCE_IN_YEARS !== undefined && d.SENTENCE_IN_YEARS < 99);
            return group.length > 0 ? group.reduce((acc, d) => acc + (d.SENTENCE_IN_YEARS || 0), 0) / group.length : 0;
        }).filter(avg => avg > 0);
        const maxSentDiff = avgSentences.length > 1 ? (Math.max(...avgSentences) / Math.min(...avgSentences)) : 1;
        const sentScore = Math.max(0, 100 - (maxSentDiff - 1) * 50);
        if (sentScore < 70) findings.push("Se observan diferencias significativas en la duración promedio de las sentencias.");

        // Duration Score
        const avgDurations = races.map(race => {
            const group = data.filter(d => d.RAZA === race);
            return group.length > 0 ? group.reduce((acc, d) => acc + d.DURACION_CASO_EN_DIAS, 0) / group.length : 0;
        });
        const maxDurDiff = avgDurations.length > 0 ? (Math.max(...avgDurations) - Math.min(...avgDurations)) : 0;
        const durScore = Math.max(0, 100 - (maxDurDiff / 30)); // 1 point deduction per 30 days difference
        if (durScore < 70) findings.push("La duración procesal promedio varía considerablemente entre grupos.");

        const globalScore = (repScore + dispScore + sentScore + durScore) / 4;

        return { rep: repScore, disp: dispScore, sent: sentScore, dur: durScore, global: globalScore, findings };
    }, [data]);

    const getScoreColor = (score: number) => {
        if (score > 85) return 'text-green-600';
        if (score > 65) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Resumen de Indicadores de Sesgo</h2>
            <Card title="Puntuación Global de Equidad">
                <div className="text-center">
                    <p className={`text-7xl font-bold ${getScoreColor(scores.global)}`}>{scores.global.toFixed(0)}</p>
                    <p className="text-gray-500">Sobre 100 (Mayor es mejor)</p>
                    <p className="mt-2 max-w-2xl mx-auto">Esta puntuación es un agregado de los indicadores de representación, resultados, sentencias y duración procesal. Un puntaje más bajo sugiere la presencia de posibles sesgos en los datos.</p>
                </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Representación">
                    <p className={`text-center text-5xl font-bold ${getScoreColor(scores.rep)}`}>{scores.rep.toFixed(0)}</p>
                </Card>
                <Card title="Resultados">
                    <p className={`text-center text-5xl font-bold ${getScoreColor(scores.disp)}`}>{scores.disp.toFixed(0)}</p>
                </Card>
                <Card title="Sentencias">
                    <p className={`text-center text-5xl font-bold ${getScoreColor(scores.sent)}`}>{scores.sent.toFixed(0)}</p>
                </Card>
                <Card title="Duración Procesal">
                    <p className={`text-center text-5xl font-bold ${getScoreColor(scores.dur)}`}>{scores.dur.toFixed(0)}</p>
                </Card>
            </div>
            {scores.findings.length > 0 && (
                <Alert type="danger" title="Hallazgos Principales">
                    <ul className="list-disc list-inside">
                        {scores.findings.map((finding, i) => <li key={i}>{finding}</li>)}
                    </ul>
                </Alert>
            )}
        </div>
    );
};

const DispositionAnalysis: React.FC<{ data: CaseData[]; thresholds: any }> = ({ data, thresholds }) => {
    const dispositionByRace = useMemo(() => {
        if (!data || data.length === 0) return [];
        const dispositions = [...new Set(data.map(d => d.DISPOSICION_CARGO))].slice(0, 5); // top 5
        const races = [...new Set(data.map(d => d.RAZA))];
        
        const result = dispositions.map(disposition => {
            const entry: { name: string; [key: string]: any } = { name: disposition };
            races.forEach(race => {
                entry[race] = data.filter(d => d.RAZA === race && d.DISPOSICION_CARGO === disposition).length;
            });
            return entry;
        });
        return result;
    }, [data]);

    const races = [...new Set(data.map(d => d.RAZA))];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Resultados del Caso</h2>
            <Card title="Distribución de Resultados por Raza (Top 5)">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={dispositionByRace} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        {races.map((race, i) => (
                            <Bar key={race} dataKey={race} stackId="a" fill={RACE_COLORS[race] || COLORS[i % COLORS.length]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

const SentencingAnalysis: React.FC<{ data: CaseData[]; thresholds: any }> = ({ data, thresholds }) => {
    const avgSentenceByRace = useMemo(() => {
        if (!data || data.length === 0) return [];
        const races = [...new Set(data.map(d => d.RAZA))];
        const result = races.map(race => {
            const group = data.filter(d => d.RAZA === race && d.SENTENCE_IN_YEARS !== undefined && d.SENTENCE_IN_YEARS < 99); // Exclude "life"
            const totalYears = group.reduce((acc, d) => acc + (d.SENTENCE_IN_YEARS || 0), 0);
            const avg = group.length > 0 ? totalYears / group.length : 0;
            return { name: race, avgSentence: parseFloat(avg.toFixed(2)) };
        });
        return result;
    }, [data]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Sentencias</h2>
            <Card title="Duración Promedio de la Sentencia por Raza (en años)">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={avgSentenceByRace}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="avgSentence" name="Sentencia Promedio" unit=" años">
                            {avgSentenceByRace.map(entry => <Cell key={`cell-${entry.name}`} fill={RACE_COLORS[entry.name] || '#8884d8'} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

const DurationAnalysis: React.FC<{ data: CaseData[]; thresholds: any }> = ({ data, thresholds }) => {
    const avgDurationByRace = useMemo(() => {
        if (!data || data.length === 0) return [];
        const races = [...new Set(data.map(d => d.RAZA))];
        const result = races.map(race => {
            const group = data.filter(d => d.RAZA === race);
            const totalDays = group.reduce((acc, d) => acc + d.DURACION_CASO_EN_DIAS, 0);
            const avg = group.length > 0 ? totalDays / group.length : 0;
            return { name: race, avgDuration: Math.round(avg) };
        });
        return result;
    }, [data]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis de Duración Procesal</h2>
            <Card title="Duración Promedio del Caso por Raza (en días)">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={avgDurationByRace}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="avgDuration" name="Duración Promedio" unit=" días">
                            {avgDurationByRace.map(entry => <Cell key={`cell-${entry.name}`} fill={RACE_COLORS[entry.name] || '#8884d8'} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

const IntersectionalAnalysis: React.FC<{ data: CaseData[] }> = ({ data }) => {
    const intersectionalData = useMemo(() => {
        return data
            .filter(d => d.SENTENCE_IN_YEARS !== undefined && d.SENTENCE_IN_YEARS < 99)
            .map(d => ({
                age: d.EDAD_AL_INCIDENTE,
                sentence: d.SENTENCE_IN_YEARS,
                race: d.RAZA
            }));
    }, [data]);
    
    const races = [...new Set(data.map(d => d.RAZA))];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Análisis Interseccional</h2>
            <Card title="Sentencia vs. Edad en el Incidente, por Raza">
                <p className="text-sm text-gray-600 mb-4">Cada punto representa un caso. Se excluyen sentencias de cadena perpetua para una mejor visualización.</p>
                <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="age" name="Edad en el Incidente" unit=" años" />
                        <YAxis type="number" dataKey="sentence" name="Sentencia" unit=" años" />
                        <ZAxis dataKey="race" name="Raza" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Legend />
                        {races.map((race, i) => (
                            <Scatter 
                                key={race} 
                                name={race} 
                                data={intersectionalData.filter(d => d.race === race)} 
                                fill={RACE_COLORS[race] || COLORS[i % COLORS.length]} 
                            />
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

// FIX: Added DashboardProps interface to resolve TypeScript error.
interface DashboardProps {
    data: CaseData[];
    activeView: View;
    uniqueValues: {
        offenseCategories: string[];
        incidentCities: string[];
    };
}

const Dashboard: React.FC<DashboardProps> = ({ data, activeView, uniqueValues }) => {
    
    const yearExtent = useMemo((): [number, number] => {
        const currentYear = new Date().getFullYear();
        const defaultRange: [number, number] = [currentYear - 20, currentYear];

        if (!data || data.length === 0) {
            return defaultRange;
        }
        
        const years = data
            .map(d => d.FECHA_RECEPCION ? d.FECHA_RECEPCION.getFullYear() : null)
            .filter((y): y is number => y !== null && !isNaN(y));

        if (years.length === 0) {
            return defaultRange;
        }
        
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        if (!isFinite(minYear) || !isFinite(maxYear)) {
            return defaultRange;
        }

        return [minYear, maxYear];
    }, [data]);

    const [filters, setFilters] = useState<FilterState>({
        yearRange: yearExtent,
        offenseCategory: 'All',
        incidentCity: 'All',
    });

    // This effect synchronizes the filter's year range with the data's actual year range.
    // It prevents crashes when new data is loaded by ensuring the range slider values
    // are always within the min/max bounds.
    useEffect(() => {
        setFilters(f => ({ ...f, yearRange: yearExtent }));
    }, [yearExtent]);
    
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
        if (filteredData.length === 0) {
            alert("No hay datos para exportar. Por favor, ajuste los filtros.");
            return;
        }

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

export default Dashboard;