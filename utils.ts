import { CaseData } from './types';

// Simplified function to standardize race strings
const standardizeRace = (race: string | undefined): string => {
    if (!race || race === 'N/A') return 'Unknown';
    const r = race.toLowerCase();
    if (r.includes('hispanic')) return 'Hispanic';
    if (r.includes('black')) return 'Black';
    if (r.includes('white')) return 'White';
    if (r.includes('asian')) return 'ASIAN';
    if (r.trim() === '') return 'Unknown';
    // Capitalize first letter for display
    const standardized = r.charAt(0).toUpperCase() + r.slice(1);
    return standardized === 'N/a' ? 'Unknown' : standardized;
};


// Main function to parse, clean, and standardize raw CSV data
export const parseAndCleanData = (csvText: string): { data: CaseData[], error: string | null } => {
    const parsed = (window as any).d3.csvParse(csvText);

    if (!parsed.columns || parsed.length === 0) {
        return { data: [], error: 'El archivo CSV está vacío o tiene un formato incorrecto.' };
    }

    // These are the headers we expect in the CSV, mapping directly to our CaseData model
    const requiredHeaders = [
        'ID_CASO', 'FECHA_RECEPCION', 'RAZA', 'GENERO', 'EDAD_AL_INCIDENTE',
        'DISPOSICION_CARGO', 'TIPO_SENTENCIA', 'TERMINO_COMPROMISO',
        'UNIDAD_COMPROMISO', 'DURACION_CASO_EN_DIAS'
    ];
    
    // Check if all required headers are present
    const missingHeaders = requiredHeaders.filter(h => !parsed.columns.includes(h));
    if (missingHeaders.length > 0) {
        return { data: [], error: `Faltan las siguientes columnas obligatorias: ${missingHeaders.join(', ')}` };
    }

    // Pass 1: Pre-calculate medians for imputation for 'N/A' or invalid values
    const validAges = parsed
        .map((row: any) => parseInt(row['EDAD_AL_INCIDENTE'], 10))
        .filter((age: number) => !isNaN(age) && age > 0 && age < 120);

    const validDurations = parsed
        .map((row: any) => parseInt(row['DURACION_CASO_EN_DIAS'], 10))
        .filter((duration: number) => !isNaN(duration) && duration >= 0);

    const calculateMedian = (arr: number[]): number => {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    const medianAge = Math.round(calculateMedian(validAges)) || 30; // Fallback to 30
    const medianDuration = Math.round(calculateMedian(validDurations)) || 365; // Fallback to 365 days

    // Pass 2: Map, clean, and standardize data
    const cleanedData: CaseData[] = parsed.map((row: any): CaseData | null => {
        // --- Data Cleaning and Type Conversion ---
        const fechaRecepcion = new Date(row['FECHA_RECEPCION']);
        if (isNaN(fechaRecepcion.getTime())) {
            return null; // Skip rows with invalid dates
        }

        const parsedAge = parseInt(row['EDAD_AL_INCIDENTE'], 10);
        const ageAtIncident = !isNaN(parsedAge) && parsedAge > 0 && parsedAge < 120 ? parsedAge : medianAge;
        
        const parsedDuration = parseInt(row['DURACION_CASO_EN_DIAS'], 10);
        const caseDuration = !isNaN(parsedDuration) && parsedDuration >= 0 ? parsedDuration : medianDuration;

        const race = standardizeRace(row['RAZA']);
        const gender = row['GENERO'] === 'N/A' ? 'Unknown' : row['GENERO'];

        if (race === 'Unknown' || gender === 'Unknown') {
            return null; // Skip rows with unknown demographics for cleaner analysis
        }
        
        const caseData: CaseData = {
            ID_CASO: row['ID_CASO'] || '',
            ID_PARTICIPANTE_CASO: row['ID_PARTICIPANTE_CASO'] || '',
            FECHA_RECEPCION: fechaRecepcion,
            RAZA: race,
            GENERO: gender,
            EDAD_AL_INCIDENTE: ageAtIncident,
            // Prefer updated offense category, fallback to original
            CATEGORIA_DELITO: row['CATEGORIA_DELITO_ACTUALIZADA'] || row['CATEGORIA_DELITO'] || 'Unknown',
            DISPOSICION_CARGO: row['DISPOSICION_CARGO'] || 'Unknown',
            TIPO_SENTENCIA: row['TIPO_SENTENCIA'] || 'Unknown',
            TERMINO_COMPROMISO: row['TERMINO_COMPROMISO'] === 'N/A' ? '' : row['TERMINO_COMPROMISO'],
            UNIDAD_COMPROMISO: row['UNIDAD_COMPROMISO'] === 'N/A' ? '' : row['UNIDAD_COMPROMISO'],
            DURACION_CASO_EN_DIAS: caseDuration,
            CIUDAD_INCIDENTE: row['CIUDAD_INCIDENTE'] === 'N/A' ? 'Unknown' : row['CIUDAD_INCIDENTE'],
            JUEZ_SENTENCIA: row['JUEZ_SENTENCIA'] === 'N/A' ? 'Unknown' : row['JUEZ_SENTENCIA'],
        };
        
        // Calculate sentence in years and attach it
        caseData.SENTENCE_IN_YEARS = convertSentenceToYears(caseData.TERMINO_COMPROMISO, caseData.UNIDAD_COMPROMISO);
        
        return caseData;

    }).filter((d): d is CaseData => d !== null); // Filter out the null (invalid) rows

    if (cleanedData.length === 0) {
        return { data: [], error: 'No se encontraron registros válidos en el archivo. Verifique las columnas y el formato de los datos.' };
    }

    return { data: cleanedData, error: null };
};

export const convertSentenceToYears = (term: number | string, unit: string): number | undefined => {
    const termStr = String(term).toLowerCase();
    const unitLower = String(unit).toLowerCase();

    if (termStr === 'n/a' || termStr === '' || unitLower === 'n/a' || unitLower === '') {
        return undefined;
    }

    if (termStr.includes('life') || unitLower.includes('life')) {
        return 99; // Special code for life sentence
    }

    const numericTerm = parseFloat(termStr);
    if (isNaN(numericTerm)) {
        return undefined;
    }

    if (unitLower.includes('year')) {
        return numericTerm;
    } else if (unitLower.includes('month')) {
        return numericTerm / 12;
    } else if (unitLower.includes('day')) {
        return numericTerm / 365.25;
    }

    return undefined;
};


export const getAgeGroup = (age: number): string => {
    if (age < 25) return '< 25';
    if (age >= 25 && age <= 40) return '25-40';
    return '> 40';
};

export function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

export const createDataSummaryForAI = (data: CaseData[]): string => {
    if (!data || data.length === 0) {
        return "No hay datos cargados actualmente.";
    }

    const totalCases = data.length;

    const raceCounts = data.reduce((acc, d) => { acc[d.RAZA] = (acc[d.RAZA] || 0) + 1; return acc; }, {} as Record<string, number>);
    const raceDistribution = Object.entries(raceCounts).map(([race, count]) => `${race}: ${((count / totalCases) * 100).toFixed(1)}%`).join(', ');

    const genderCounts = data.reduce((acc, d) => { acc[d.GENERO] = (acc[d.GENERO] || 0) + 1; return acc; }, {} as Record<string, number>);
    const genderDistribution = Object.entries(genderCounts).map(([gender, count]) => `${gender}: ${((count / totalCases) * 100).toFixed(1)}%`).join(', ');

    const offenseCounts = data.reduce((acc, d) => { acc[d.CATEGORIA_DELITO] = (acc[d.CATEGORIA_DELITO] || 0) + 1; return acc; }, {} as Record<string, number>);
    const topOffenses = Object.entries(offenseCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([offense, count]) => `${offense} (${count} casos)`).join(', ');

    const sentencedCases = data.filter(d => d.SENTENCE_IN_YEARS !== undefined && d.SENTENCE_IN_YEARS < 99); // Exclude life sentences from avg
    const avgSentence = sentencedCases.length > 0
        ? sentencedCases.reduce((acc, d) => acc + (d.SENTENCE_IN_YEARS || 0), 0) / sentencedCases.length
        : 0;

    const avgDuration = data.reduce((acc, d) => acc + d.DURACION_CASO_EN_DIAS, 0) / totalCases;

    return `
Resumen del conjunto de datos actual:
- Número total de casos: ${totalCases}
- Distribución por raza: ${raceDistribution}
- Distribución por género: ${genderDistribution}
- Principales categorías de delitos: ${topOffenses}
- Duración promedio de la sentencia (excluyendo cadena perpetua): ${avgSentence.toFixed(2)} años
- Duración promedio del caso: ${avgDuration.toFixed(0)} días.
Utiliza este resumen para responder preguntas sobre los datos.
    `;
};