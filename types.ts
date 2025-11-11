export interface CaseData {
    ID_CASO: string;
    ID_PARTICIPANTE_CASO: string;
    FECHA_RECEPCION: Date;
    RAZA: string;
    GENERO: string;
    EDAD_AL_INCIDENTE: number;
    CATEGORIA_DELITO: string;
    DISPOSICION_CARGO: string;
    TIPO_SENTENCIA: string;
    TERMINO_COMPROMISO: number | string;
    UNIDAD_COMPROMISO: string;
    DURACION_CASO_EN_DIAS: number;
    CIUDAD_INCIDENTE: string;
    JUEZ_SENTENCIA: string;
    SENTENCE_IN_YEARS?: number;
}

export type View =
    | "home"
    | "demographics"
    | "dispositions"
    | "sentencing"
    | "duration"
    | "intersectional"
    | "summary"
    | "reports";

export interface FilterState {
    yearRange: [number, number];
    offenseCategory: string;
    incidentCity: string;
}
