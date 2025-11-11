import React, { useState, useCallback } from 'react';

interface FileUploadProps {
    onDataLoaded: (data: string) => void;
    error: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, error }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
                alert('Por favor, selecciona un archivo CSV válido.');
                return;
            }
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                alert('El archivo es demasiado grande. El tamaño máximo es 10MB.');
                return;
            }
            setIsLoading(true);
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                onDataLoaded(text);
                setIsLoading(false);
            };
            reader.onerror = () => {
                alert('Error al leer el archivo. Por favor, inténtalo de nuevo.');
                setIsLoading(false);
            };
            reader.readAsText(file);
        }
    };

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    }, []);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
                alert('Por favor, arrastra un archivo CSV válido.');
                return;
            }
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('El archivo es demasiado grande. El tamaño máximo es 10MB.');
                return;
            }
            setIsLoading(true);
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                onDataLoaded(text);
                setIsLoading(false);
            };
            reader.onerror = () => {
                alert('Error al leer el archivo. Por favor, inténtalo de nuevo.');
                setIsLoading(false);
            };
            reader.readAsText(file);
        }
    }, [onDataLoaded]);

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
            <div className="text-center max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">Análisis de Sesgos en Justicia Criminal</h1>
                <p className="text-gray-300 mb-6">
                    Esta aplicación interactiva analiza sesgos en datos del sistema de justicia criminal. La metodología está inspirada en el estudio 
                    <a href="https://doi.org/10.48550/arXiv.2109.09946" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">
                        "Identifying biases in legal data: An algorithmic fairness perspective"
                    </a>
                    de Jackson Sargent y Melanie Weber. El objetivo es detectar y visualizar disparidades en representación y sentencias desde una perspectiva de equidad algorítmica.
                </p>
            </div>

            <div 
                className="w-full max-w-lg mt-8 p-8 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-primary hover:bg-gray-800 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4-4H7z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m3-3H7"></path></svg>
                        <p className="text-gray-400">Arrastra y suelta tu archivo CSV aquí</p>
                        <p className="text-gray-500 text-sm">o</p>
                        <button 
                            type="button" 
                            className="mt-2 bg-primary text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition-colors"
                            onClick={() => document.getElementById('file-upload')?.click()}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Cargando...' : 'Seleccionar Archivo'}
                        </button>
                        {fileName && <p className="text-green-400 mt-4 text-sm">Archivo seleccionado: {fileName}</p>}
                    </div>
                </label>
            </div>

            {error && (
                <div className="mt-6 bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-md max-w-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div className="mt-8 text-left max-w-lg text-gray-400 text-sm p-4 bg-gray-800 rounded-lg">
                <h3 className="font-bold text-white mb-2">Columnas Requeridas:</h3>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside">
                    <li>ID_CASO</li>
                    <li>FECHA_RECEPCION</li>
                    <li>RAZA</li>
                    <li>GENERO</li>
                    <li>EDAD_AL_INCIDENTE</li>
                    <li>CATEGORIA_DELITO</li>
                    <li>DISPOSICION_CARGO</li>
                    <li>TIPO_SENTENCIA</li>
                    <li>TERMINO_COMPROMISO</li>
                    <li>UNIDAD_COMPROMISO</li>
                    <li>DURACION_CASO_EN_DIAS</li>
                </ul>
            </div>

            <div className="mt-8 text-left max-w-3xl text-gray-400 text-sm p-6 bg-gray-800 rounded-lg">
                <h3 className="font-bold text-white text-lg mb-3">Fundamento Metodológico</h3>
                <p className="mb-4">
                    Este analizador se basa en los principios del siguiente artículo de investigación:
                </p>
                <div className="p-4 bg-gray-900 rounded">
                    <p className="font-semibold text-white">"Identifying biases in legal data: An algorithmic fairness perspective"</p>
                    <p className="text-gray-400"><strong>Autores:</strong> Jackson Sargent, Melanie Weber</p>
                    <p className="text-gray-500"><strong>Referencia:</strong> arXiv:2109.09946 [cs.CY]</p>
                    <a href="https://doi.org/10.48550/arXiv.2109.09946" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Ver publicación
                    </a>
                </div>
                <h4 className="font-bold text-white mt-4 mb-2">Concepto Clave</h4>
                <p>
                    El estudio propone un método para identificar y medir sesgos comparando dos modelos. Uno representa las decisiones de un "juez típico" (basado en los promedios de los datos), mientras que el otro simula un "juez justo" que aplica conceptos de equidad. Al contrastar las decisiones de ambos, es posible cuantificar sesgos existentes en los datos a través de diferentes grupos demográficos. Esta aplicación implementa una versión simplificada de dicho análisis para proporcionar métricas e indicadores de posibles disparidades.
                </p>
            </div>
        </div>
    );
};

export default FileUpload;