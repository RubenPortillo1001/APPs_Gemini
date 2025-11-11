import { CaseData } from './types';

const REQUIRED_COLUMNS = [
    'ID_CASO', 'ID_PARTICIPANTE_CASO', 'FECHA_RECEPCION', 'RAZA', 'GENERO', 
    'EDAD_AL_INCIDENTE', 'CATEGORIA_DELITO', 'DISPOSICION_CARGO', 
    'TIPO_SENTENCIA', 'TERMINO_COMPROMISO', 'UNIDAD_COMPROMISO', 'DURACION_CASO_EN_DIAS'
];

export const parseAndCleanData = (csvText: string): { data: CaseData[], error: string | null } => {
    // Note: The user-provided CSV might have Spanish headers. We'll use d3's flexibility.
    const parsed = (window as any).d3.csvParse(csvText);

    if (!parsed.columns || parsed.length === 0) {
        return { data: [], error: 'El archivo CSV está vacío o tiene un formato incorrecto.' };
    }
    
    // Heuristically detect column names from the provided mapping
    const columnMap: {[key: string]: string} = {
      'CASE_ID': 'ID_CASO',
      'CASE_PARTICIPANT_ID': 'ID_PARTICIPANTE_CASO',
      'RECEIVED_DATE': 'FECHA_RECEPCION',
      'RACE': 'RAZA',
      'GENDER': 'GENERO',
      'AGE_AT_INCIDENT': 'EDAD_AL_INCIDENTE',
      'OFFENSE_CATEGORY': 'CATEGORIA_DELITO',
      'CHARGE_DISPOSITION': 'DISPOSICION_CARGO',
      'SENTENCE_TYPE': 'TIPO_SENTENCIA',
      'COMMITMENT_TERM': 'TERMINO_COMPROMISO',
      'COMMITMENT_UNIT': 'UNIDAD_COMPROMISO',
      'LENGTH_OF_CASE_in_Days': 'DURACION_CASO_EN_DIAS',
      'INCIDENT_CITY': 'CIUDAD_INCIDENTE',
      'SENTENCE_JUDGE': 'JUEZ_SENTENCIA',
    };

    const firstRow = parsed[0];
    const detectedMap: {[key: string]: string} = {};
    for (const key in columnMap) {
        if(firstRow.hasOwnProperty(columnMap[key])) {
            detectedMap[key] = columnMap[key];
        } else if (firstRow.hasOwnProperty(key)) {
            detectedMap[key] = key;
        }
    }

    const missingColumns = REQUIRED_COLUMNS.filter(col => {
       const engVersion = Object.keys(columnMap).find(key => columnMap[key] === col);
       return !detectedMap[engVersion!];
    });
    
    if (missingColumns.length > 0) {
        return { data: [], error: `Faltan las siguientes columnas obligatorias: ${missingColumns.join(', ')}` };
    }

    const cleanedData: CaseData[] = parsed.map((row: any) => {
        let race = row[detectedMap.RACE] || 'Unknown';
        if (race.toLowerCase().includes('hispanic')) {
            race = 'Hispanic';
        }

        const caseData: CaseData = {
            ID_CASO: row[detectedMap.CASE_ID],
            ID_PARTICIPANTE_CASO: row[detectedMap.CASE_PARTICIPANT_ID],
            FECHA_RECEPCION: new Date(row[detectedMap.RECEIVED_DATE]),
            RAZA: race,
            GENERO: row[detectedMap.GENDER] || 'Unknown',
            EDAD_AL_INCIDENTE: parseInt(row[detectedMap.AGE_AT_INCIDENT], 10) || 0,
            CATEGORIA_DELITO: row[detectedMap.OFFENSE_CATEGORY] || 'Unknown',
            DISPOSICION_CARGO: row[detectedMap.CHARGE_DISPOSITION] || 'Unknown',
            TIPO_SENTENCIA: row[detectedMap.SENTENCE_TYPE] || 'Unknown',
            TERMINO_COMPROMISO: row[detectedMap.COMMITMENT_TERM],
            UNIDAD_COMPROMISO: row[detectedMap.COMMITMENT_UNIT] || '',
            DURACION_CASO_EN_DIAS: parseInt(String(row[detectedMap.LENGTH_OF_CASE_in_Days]).replace(/,/g, ''), 10) || 0,
            CIUDAD_INCIDENTE: row[detectedMap.INCIDENT_CITY] || 'Unknown',
            JUEZ_SENTENCIA: row[detectedMap.SENTENCE_JUDGE] || 'Unknown',
        };
        caseData.SENTENCE_IN_YEARS = convertSentenceToYears(caseData.TERMINO_COMPROMISO, caseData.UNIDAD_COMPROMISO);
        return caseData;
    }).filter(d => d.RAZA !== 'Unknown' && d.GENERO !== 'Unknown' && !isNaN(d.FECHA_RECEPCION.getTime()));
    
    if (cleanedData.length === 0) {
      return { data: [], error: 'No se encontraron registros válidos en el archivo CSV después de la limpieza.'}
    }

    return { data: cleanedData, error: null };
};

export const convertSentenceToYears = (term: number | string, unit: string): number | undefined => {
    const numericTerm = parseFloat(String(term));
    if (isNaN(numericTerm)) {
        if(String(term).toLowerCase() === 'natural life') return 99;
        return undefined;
    }

    const unitLower = unit.toLowerCase();

    if (unitLower.includes('year')) {
        return numericTerm;
    } else if (unitLower.includes('month')) {
        return numericTerm / 12;
    } else if (unitLower.includes('day')) {
        return numericTerm / 365.25;
    } else if(unitLower.includes('life')) {
        return 99;
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

    const avgSentence = data.reduce((acc, d) => acc + (d.SENTENCE_IN_YEARS || 0), 0) / data.filter(d => d.SENTENCE_IN_YEARS !== undefined).length;
    const avgDuration = data.reduce((acc, d) => acc + d.DURACION_CASO_EN_DIAS, 0) / totalCases;

    return `
Resumen del conjunto de datos actual:
- Número total de casos: ${totalCases}
- Distribución por raza: ${raceDistribution}
- Distribución por género: ${genderDistribution}
- Principales categorías de delitos: ${topOffenses}
- Duración promedio de la sentencia (para los que tienen): ${avgSentence.toFixed(2)} años
- Duración promedio del caso: ${avgDuration.toFixed(0)} días.
Utiliza este resumen para responder preguntas sobre los datos.
    `;
};
